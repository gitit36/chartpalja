import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { consumeUnits, getBalance } from '@/lib/payment/entitlement'
import { READING_COST } from '@/lib/payment/products'
import { buildCompatibilitySummaryPrompt, scrubBreakdownKeyLeakage } from '@/lib/ai/fortune-prompt'
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload, MonthlyDatum } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import { callGemini } from '@/lib/ai/gemini'
import { canAccessPartnerEntry } from '@/lib/compat/access'
import { kstCenteredWeekDates } from '@/lib/saju/daily-util'
import { hydrateWeekSeries } from '@/lib/saju/hydrate-week-series'
import { weekdayLabelFromDate } from '@/lib/saju/week-chart-data'
import { pillarToHangul } from '@/lib/saju/hanja-hangul'
import { buildRelationshipSeries } from '@/lib/compat/relationship-score'

const MAX_YEAR_RANGE = 30
const THIS_YEAR = new Date().getFullYear()

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

type EntryRow = {
  id: string
  name: string
  gender: string
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  isLunar: boolean
  isLeapMonth: boolean
  sajuReportJson: unknown
}

function yearFactLines(
  nameA: string,
  nameB: string,
  chartA: ReturnType<typeof buildLifeChartData>,
  chartB: ReturnType<typeof buildLifeChartData>,
  reportA: SajuReportJson,
  reportB: SajuReportJson,
  birthYearA: number,
  birthYearB: number,
  yearStart: number,
  yearEnd: number,
): string {
  const payloadA = reportA.chartData as ChartPayload | undefined
  const payloadB = reportB.chartData as ChartPayload | undefined
  const rel = buildRelationshipSeries(reportA, birthYearA, reportB, birthYearB)
  const relMap = new Map(rel.map(p => [p.year, p]))
  const lines: string[] = []
  for (let y = yearStart; y <= yearEnd; y++) {
    const a = chartA?.data.find(d => d.year === y)
    const b = chartB?.data.find(d => d.year === y)
    const rawA = payloadA?.['연도별_타임라인']?.find(d => d.year === y)
    const rawB = payloadB?.['연도별_타임라인']?.find(d => d.year === y)
    const r = relMap.get(y)
    const swA = rawA?.['세운_pillar'] ? pillarToHangul(rawA['세운_pillar']) : (a?.sewoonPillar ? pillarToHangul(a.sewoonPillar) : '?')
    const swB = rawB?.['세운_pillar'] ? pillarToHangul(rawB['세운_pillar']) : (b?.sewoonPillar ? pillarToHangul(b.sewoonPillar) : '?')
    lines.push(
      `- ${y}년: ${nameA} ${a ? Math.round(a.score) : '?'}점(${a?.seasonTag ?? '?'}/${swA}) · ${nameB} ${b ? Math.round(b.score) : '?'}점(${b?.seasonTag ?? '?'}/${swB})`
      + (r ? ` · 관계점수 ${Math.round(r.score)}(${r.dots}점급)` : ''),
    )
  }
  return lines.join('\n')
}

function monthFactLines(
  nameA: string,
  nameB: string,
  reportA: SajuReportJson,
  reportB: SajuReportJson,
  monthStart: number,
  monthEnd: number,
  targetYear: number,
): string {
  const tlA = (reportA.chartData as ChartPayload | undefined)?.['월운_타임라인']?.data
  const tlB = (reportB.chartData as ChartPayload | undefined)?.['월운_타임라인']?.data
  const lines: string[] = [`기준 연도: ${targetYear}년`]
  for (let m = monthStart; m <= monthEnd; m++) {
    const a = tlA?.find((d: MonthlyDatum) => d.month === m)
    const b = tlB?.find((d: MonthlyDatum) => d.month === m)
    lines.push(
      `- ${m}월: ${nameA} ${a ? Math.round(a.scores['종합']) : '?'}점(${a?.['시즌태그']?.tag ?? '?'}/${a?.['간지'] ? pillarToHangul(a['간지']) : '?'})`
      + ` · ${nameB} ${b ? Math.round(b.scores['종합']) : '?'}점(${b?.['시즌태그']?.tag ?? '?'}/${b?.['간지'] ? pillarToHangul(b['간지']) : '?'})`,
    )
  }
  return lines.join('\n')
}

async function weekFactLines(
  nameA: string,
  nameB: string,
  entryA: EntryRow,
  entryB: EntryRow,
  selectedDates: string[],
): Promise<string> {
  const [seriesA, seriesB] = await Promise.all([
    hydrateWeekSeries(entryA),
    hydrateWeekSeries(entryB),
  ])
  const mapA = new Map(seriesA.days.map(d => [d.date, d]))
  const mapB = new Map(seriesB.days.map(d => [d.date, d]))
  const lines: string[] = []
  for (const date of selectedDates) {
    const a = mapA.get(date)
    const b = mapB.get(date)
    const wd = weekdayLabelFromDate(date).replace('요일', '')
    lines.push(
      `- ${date}(${wd}): ${nameA} ${a?.score != null ? Math.round(a.score) : '?'}점(${a?.seasonTag ?? '?'})`
      + ` · ${nameB} ${b?.score != null ? Math.round(b.score) : '?'}점(${b?.seasonTag ?? '?'})`,
    )
  }
  return lines.join('\n')
}

/**
 * 궁합 모드 구간/시점 해설.
 * 일반 구간 해설(period)과 동일하게 1주 차감. overlayId 필수.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const overlayId = request.nextUrl.searchParams.get('overlayId')
    const yearStr = request.nextUrl.searchParams.get('year')
    const yearEndStr = request.nextUrl.searchParams.get('yearEnd')
    const monthStr = request.nextUrl.searchParams.get('month')
    const monthEndStr = request.nextUrl.searchParams.get('monthEnd')
    const weekStartStr = request.nextUrl.searchParams.get('weekStart')
    const weekEndStr = request.nextUrl.searchParams.get('weekEnd')

    if (!overlayId) {
      return NextResponse.json({ error: 'overlayId가 필요합니다.' }, { status: 400 })
    }
    if (!yearStr && !monthStr && !weekStartStr) {
      return NextResponse.json({ error: 'year, month, or weekStart is required' }, { status: 400 })
    }

    const user = await getUserFromSession().catch(() => null)
    if (!user) {
      return NextResponse.json(
        { error: 'login_required', message: '궁합 해설을 보려면 로그인이 필요해요.' },
        { status: 401 },
      )
    }

    const guestId = getGuestId(request)
    const entry = await prisma.sajuEntry.findUnique({ where: { id } })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (entry.userId && entry.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!entry.userId && entry.guestId && entry.guestId !== guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const reportA = entry.sajuReportJson as SajuReportJson | null
    if (!reportA) return NextResponse.json({ error: 'No saju data' }, { status: 400 })

    const partner = await prisma.sajuEntry.findUnique({ where: { id: overlayId } })
    if (!partner?.sajuReportJson) {
      return NextResponse.json({ error: '비교 대상을 찾을 수 없습니다.' }, { status: 404 })
    }
    const allowed = await canAccessPartnerEntry(user.id, id, overlayId)
    if (!allowed) {
      return NextResponse.json({ error: 'Unauthorized partner' }, { status: 403 })
    }

    const reportB = partner.sajuReportJson as SajuReportJson
    const birthYearA = entry.birthDate ? parseInt(entry.birthDate.slice(0, 4), 10) : THIS_YEAR - 30
    const birthYearB = partner.birthDate ? parseInt(partner.birthDate.slice(0, 4), 10) : THIS_YEAR - 30
    const nameA = entry.name || '나'
    const nameB = partner.name || '상대'
    const chartA = buildLifeChartData(reportA.chartData as ChartPayload | undefined, reportA, birthYearA)
    const chartB = buildLifeChartData(reportB.chartData as ChartPayload | undefined, reportB, birthYearB)

    let cacheKey: string
    let periodLabel: string
    let startYear: number
    let endYear: number
    let periodFacts: string
    let responseMeta: Record<string, unknown> = {}

    if (weekStartStr) {
      const weekStart = parseInt(weekStartStr, 10)
      const weekEnd = weekEndStr ? parseInt(weekEndStr, 10) : weekStart
      if (isNaN(weekStart) || weekStart < 1 || weekStart > 7 || isNaN(weekEnd) || weekEnd < weekStart || weekEnd > 7) {
        return NextResponse.json({ error: 'invalid weekStart/weekEnd' }, { status: 400 })
      }
      const weekDates = kstCenteredWeekDates()
      const selectedDates = weekDates.slice(weekStart - 1, weekEnd)
      if (!selectedDates.length) {
        return NextResponse.json({ error: 'invalid week range' }, { status: 400 })
      }
      const startLabel = weekdayLabelFromDate(selectedDates[0]!).replace('요일', '')
      const endLabel = weekdayLabelFromDate(selectedDates[selectedDates.length - 1]!).replace('요일', '')
      periodLabel = selectedDates.length === 1
        ? `${selectedDates[0]} (${startLabel})`
        : `${selectedDates[0]}~${selectedDates[selectedDates.length - 1]} (${startLabel}~${endLabel})`
      cacheKey = selectedDates.length === 1
        ? `compatPeriod_v2_${overlayId}_week_${selectedDates[0]}`
        : `compatPeriod_v2_${overlayId}_week_${selectedDates[0]}_${selectedDates[selectedDates.length - 1]}`
      startYear = THIS_YEAR
      endYear = THIS_YEAR
      periodFacts = await weekFactLines(nameA, nameB, entry, partner, selectedDates)
      responseMeta = { weekStart, weekEnd: weekEnd > weekStart ? weekEnd : undefined, dates: selectedDates }
    } else if (monthStr) {
      const monthStart = parseInt(monthStr, 10)
      const monthEnd = monthEndStr ? parseInt(monthEndStr, 10) : monthStart
      if (
        isNaN(monthStart) || isNaN(monthEnd)
        || monthStart < 1 || monthStart > 12
        || monthEnd < monthStart || monthEnd > 12
      ) {
        return NextResponse.json({ error: 'invalid month/monthEnd' }, { status: 400 })
      }
      const targetYear =
        (reportA.chartData as ChartPayload | undefined)?.['월운_타임라인']?.target_year
        ?? THIS_YEAR
      periodLabel = monthStart === monthEnd
        ? `${targetYear}년 ${monthStart}월`
        : `${targetYear}년 ${monthStart}~${monthEnd}월`
      cacheKey = monthStart === monthEnd
        ? `compatPeriod_v2_${overlayId}_month_${targetYear}_${monthStart}`
        : `compatPeriod_v2_${overlayId}_month_${targetYear}_${monthStart}_${monthEnd}`
      startYear = targetYear
      endYear = targetYear
      periodFacts = monthFactLines(nameA, nameB, reportA, reportB, monthStart, monthEnd, targetYear)
      responseMeta = { month: monthStart, monthEnd: monthEnd > monthStart ? monthEnd : undefined, year: targetYear }
    } else {
      const yearStart = parseInt(yearStr!, 10)
      const yearEnd = yearEndStr ? parseInt(yearEndStr, 10) : yearStart
      if (isNaN(yearStart) || isNaN(yearEnd) || yearEnd < yearStart) {
        return NextResponse.json({ error: 'invalid year/yearEnd' }, { status: 400 })
      }
      if (yearEnd - yearStart + 1 > MAX_YEAR_RANGE) {
        return NextResponse.json({ error: `최대 ${MAX_YEAR_RANGE}년까지 선택할 수 있어요.` }, { status: 400 })
      }
      periodLabel = yearStart === yearEnd ? `${yearStart}년` : `${yearStart}~${yearEnd}년`
      cacheKey = yearStart === yearEnd
        ? `compatPeriod_v2_${overlayId}_year_${yearStart}`
        : `compatPeriod_v2_${overlayId}_year_${yearStart}_${yearEnd}`
      startYear = yearStart
      endYear = yearEnd
      periodFacts = yearFactLines(
        nameA, nameB, chartA, chartB, reportA, reportB, birthYearA, birthYearB, yearStart, yearEnd,
      )
      responseMeta = { year: yearStart, yearEnd: yearEnd > yearStart ? yearEnd : undefined }
    }

    const existingFortune = (entry.fortuneJson && typeof entry.fortuneJson === 'object')
      ? entry.fortuneJson as Record<string, unknown>
      : {}
    if (existingFortune[cacheKey]) {
      return NextResponse.json({
        ...responseMeta,
        summary: scrubBreakdownKeyLeakage(String(existingFortune[cacheKey])),
        cached: true,
      })
    }

    const balance = await getBalance(user.id)
    if (balance.ju < READING_COST.period) {
      return NextResponse.json(
        { error: '구간 해설 이용권이 부족합니다.', needed: READING_COST.period, ju: balance.ju },
        { status: 402 },
      )
    }

    const prompt = buildCompatibilitySummaryPrompt(
      reportA,
      reportB,
      entry.gender,
      partner.gender,
      nameA,
      nameB,
      startYear,
      endYear,
      { birthYearA, birthYearB, periodLabel, periodFacts },
    )
    const summary = scrubBreakdownKeyLeakage((await callGemini(prompt, {
      feature: 'period_compat',
      meta: { entryId: id, overlayId, cacheKey, periodLabel },
    })).trim())

    await prisma.sajuEntry.update({
      where: { id },
      data: { fortuneJson: { ...existingFortune, [cacheKey]: summary } as object },
    })
    await consumeUnits(user.id, READING_COST.period, 'use:period')

    return NextResponse.json({ ...responseMeta, summary })
  } catch (error) {
    console.error('GET /api/saju/[id]/fortune/compat error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
