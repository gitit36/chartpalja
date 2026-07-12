import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { consumeUnits, getBalance } from '@/lib/payment/entitlement'
import { READING_COST } from '@/lib/payment/products'
import { buildYearSummaryPrompt, buildRangeSummaryPrompt, buildMonthlySummaryPrompt, buildWeeklySummaryPrompt, scrubBreakdownKeyLeakage } from '@/lib/ai/fortune-prompt'
import type { SajuReportJson } from '@/types/saju-report'
import type { YearChartData } from '@/lib/ai/fortune-prompt'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import type { ChartPayload, YearlyDatum, MonthlyDatum } from '@/types/chart'
import { pillarToHangul } from '@/lib/saju/hanja-hangul'
import { callGemini } from '@/lib/ai/gemini'
import { kstCenteredWeekDates } from '@/lib/saju/daily-util'
import { hydrateWeekSeries } from '@/lib/saju/hydrate-week-series'
import { weekdayLabelFromDate } from '@/lib/saju/week-chart-data'

const MAX_YEAR_RANGE = 30

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

function buildYearChartDataFromSources(
  year: number,
  cd: { data: Array<Record<string, unknown>> } | null,
  rawTimeline: YearlyDatum[] | undefined,
): YearChartData {
  const yd = cd?.data.find((d: Record<string, unknown>) => d.year === year) as Record<string, unknown> | undefined
  const raw = rawTimeline?.find(d => d.year === year)

  const origRels = (raw?.['세운_관계_with_원국'] ?? []) as Array<{ with?: string; relations?: string[] }>
  const origStr = origRels.map(r => `${r.with ?? ''}: ${(r.relations ?? []).join(', ')}`).join(' / ')
  const dwRels = (raw?.['세운_관계_with_대운'] ?? []) as string[]
  const iljuRels = ((raw as unknown as Record<string, unknown> | undefined)?.['세운_일주관계'] ?? []) as string[]
  const dwTransition = (raw as unknown as Record<string, unknown> | undefined)?.['대운전환기'] as Record<string, unknown> | undefined
  let transStr = '해당없음'
  if (dwTransition?.['전환기'] === true) {
    const prevDw = dwTransition['이전대운'] as string | null
    const newDw = dwTransition['신규대운'] as string
    const transYear = dwTransition['전환연도'] as number
    transStr = `${transYear}년 대운교체 (${prevDw ? pillarToHangul(prevDw) : '?'}→${pillarToHangul(newDw)})`
  }

  const energy = raw?.indicators?.['에너지장']

  return {
    year,
    score: (yd?.score as number) ?? 50,
    trend: (yd?.trend as number) ?? undefined,
    seasonTag: (yd?.seasonTag as string) ?? undefined,
    seasonEmoji: (yd?.seasonEmoji as string) ?? undefined,
    seasonDesc: (yd?.seasonDesc as string) ?? undefined,
    energyTotal: (yd?.energyTotal as number) ?? undefined,
    energyDirection: (yd?.energyDirection as number) ?? undefined,
    energyKeys: energy?.keys ?? [],
    daewoonPillar: (yd?.daewoonPillar as string) ?? undefined,
    sewoonPillar: raw?.['세운_pillar'] ?? (yd?.sewoonPillar as string) ?? undefined,
    grade: (yd?.grade as string) ?? undefined,
    yongshinPower: (yd?.yongshinPower as number) ?? undefined,
    noblePower: (yd?.noblePower as number) ?? undefined,
    ohangBalance: (yd?.ohangBalance as number) ?? undefined,
    unseongCurve: (yd?.unseongCurve as number) ?? undefined,
    candleOpen: (yd?.open as number) ?? undefined,
    candleClose: (yd?.close as number) ?? undefined,
    candleHigh: (yd?.high as number) ?? undefined,
    candleLow: (yd?.low as number) ?? undefined,
    candleType: (yd?.candleType as string) ?? undefined,
    domainJob: (yd?.domainJob as number) ?? undefined,
    domainWealth: (yd?.domainWealth as number) ?? undefined,
    domainHealth: (yd?.domainHealth as number) ?? undefined,
    domainLove: (yd?.domainLove as number) ?? undefined,
    domainMarriage: (yd?.domainMarriage as number) ?? undefined,
    tengoBalance: raw?.indicators?.['십성밸런스']
      ? { ...(raw.indicators['십성밸런스'] as unknown as Record<string, number>) }
      : undefined,
    eventCareer: (yd?.eventCareer as number) ?? undefined,
    eventLove: (yd?.eventLove as number) ?? undefined,
    eventHealth: (yd?.eventHealth as number) ?? undefined,
    eventWealth: (yd?.eventWealth as number) ?? undefined,
    eventStudy: (yd?.eventStudy as number) ?? undefined,
    eventConflict: (yd?.eventConflict as number) ?? undefined,
    sewoonTgStem: raw?.['세운_십성_천간'] ?? undefined,
    sewoonTgBranch: raw?.['세운_십성_지지'] ?? undefined,
    sewoon12unseong: raw?.['세운_12운성'] ?? undefined,
    sewoonStemElement: raw?.['세운_stemElement'] ?? undefined,
    sewoonBranchElement: raw?.['세운_branchElement'] ?? undefined,
    sewoonRelsOrig: origStr || '없음',
    sewoonRelsDw: dwRels.join(', ') || '없음',
    sewoonIljuRel: iljuRels.join(', ') || '없음',
    gilshin: (raw?.['세운_신살_길신'] ?? []).join(', ') || '없음',
    hyungshal: (raw?.['세운_신살_흉살'] ?? []).join(', ') || '없음',
    daewoonTransition: transStr,
    breakdown: raw?.breakdown as Record<string, number> | undefined,
    trineHits: raw?.trine_hits as YearChartData['trineHits'],
    gongmangFactors: raw?.gongmang_factors as YearChartData['gongmangFactors'],
    shinsalContextAdj: raw?.shinsal_context_adj as Record<string, number> | undefined,
  }
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const yearStr = request.nextUrl.searchParams.get('year')
    const yearEndStr = request.nextUrl.searchParams.get('yearEnd')
    const monthStr = request.nextUrl.searchParams.get('month')
    const monthEndStr = request.nextUrl.searchParams.get('monthEnd')
    const weekStartStr = request.nextUrl.searchParams.get('weekStart')
    const weekEndStr = request.nextUrl.searchParams.get('weekEnd')
    const isMonthlyRequest = !!monthStr
    const isWeeklyRequest = !!weekStartStr

    if (!yearStr && !monthStr && !weekStartStr) {
      return NextResponse.json({ error: 'year, month, or weekStart is required' }, { status: 400 })
    }

    const user = await getUserFromSession().catch(() => null)
    const guestId = getGuestId(request)

    // LLM 비용 보호: 비로그인 게스트는 구간/연도 해설 API를 호출할 수 없다.
    if (!user) {
      return NextResponse.json(
        { error: 'login_required', message: '구간 해설을 보려면 로그인이 필요해요.' },
        { status: 401 }
      )
    }

    const entry = await prisma.sajuEntry.findUnique({ where: { id } })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (entry.userId && entry.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!entry.userId && entry.guestId && entry.guestId !== guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const report = entry.sajuReportJson as SajuReportJson | null
    if (!report) return NextResponse.json({ error: 'No saju data' }, { status: 400 })

    const birthYear = entry.birthDate ? parseInt(entry.birthDate.slice(0, 4), 10) : new Date().getFullYear() - 30
    const chartPayload = report.chartData as ChartPayload | undefined
    const chartData = chartPayload ? buildLifeChartData(chartPayload, report, birthYear) : null

    if (isWeeklyRequest) {
      const weekStart = parseInt(weekStartStr!, 10)
      const weekEnd = weekEndStr ? parseInt(weekEndStr, 10) : weekStart
      if (isNaN(weekStart) || weekStart < 1 || weekStart > 7 || isNaN(weekEnd) || weekEnd < weekStart || weekEnd > 7) {
        return NextResponse.json({ error: 'invalid weekStart/weekEnd' }, { status: 400 })
      }

      const weekDates = kstCenteredWeekDates()
      const selectedDates = weekDates.slice(weekStart - 1, weekEnd)
      if (!selectedDates.length) {
        return NextResponse.json({ error: 'invalid week range' }, { status: 400 })
      }

      // 날짜 기반 캐시 — 슬롯 인덱스(1~7)만 쓰면 날짜가 바뀌어도 옛 해설이 재사용됨
      const cacheKey = selectedDates.length === 1
        ? `weekSummary_${selectedDates[0]}`
        : `weekSummary_${selectedDates[0]}_${selectedDates[selectedDates.length - 1]}`
      const cached = entry.fortuneJson as Record<string, unknown> | null
      if (cached && typeof cached === 'object' && cached[cacheKey]) {
        return NextResponse.json({
          weekStart,
          weekEnd: weekEnd > weekStart ? weekEnd : undefined,
          dates: selectedDates,
          summary: scrubBreakdownKeyLeakage(String(cached[cacheKey])),
        })
      }

      const balance = await getBalance(user.id)
      if (balance.ju < READING_COST.period) {
        return NextResponse.json({ error: '구간 해설 이용권이 부족합니다.', needed: READING_COST.period, ju: balance.ju }, { status: 402 })
      }

      // 차트와 동일하게 hydrate(엔진 backfill 포함) 후 FACT 구성
      const weekSeries = await hydrateWeekSeries({
        id: entry.id,
        birthDate: entry.birthDate,
        birthTime: entry.birthTime,
        timeUnknown: entry.timeUnknown,
        gender: entry.gender,
        isLunar: entry.isLunar,
        isLeapMonth: entry.isLeapMonth,
        sajuReportJson: entry.sajuReportJson,
      })
      const byDate = new Map(weekSeries.days.map((d) => [d.date, d]))
      const days = selectedDates.map((date) => {
        const row = byDate.get(date)
        const chart = row?.chart
        return {
          date,
          weekday: weekdayLabelFromDate(date),
          score: row?.score ?? null,
          grade: row?.grade,
          seasonTag: row?.seasonTag,
          seasonEmoji: row?.seasonEmoji,
          seasonDesc: row?.seasonDesc,
          domains: row?.domains ?? null,
          yongshinPower: chart?.yongshinPower,
          energyTotal: chart?.energyTotal,
          energyDirection: chart?.energyDirection,
          breakdown: chart?.breakdown,
          shinsalTags: chart?.shinsalTags,
          shinsalContextAdj: chart?.shinsalContextAdj,
          events: chart?.events,
        }
      })

      if (days.some((d) => d.score == null)) {
        return NextResponse.json({ error: '일운 데이터가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.' }, { status: 409 })
      }

      const promptDays = days.map((d) => ({ ...d, score: d.score as number }))
      const prompt = buildWeeklySummaryPrompt(report, promptDays, { birthYear, job: entry.job })
      const summary = scrubBreakdownKeyLeakage((await callGemini(prompt, {
        feature: weekStart === weekEnd ? 'period_week' : 'period_week_range',
        meta: { entryId: id, weekStart, weekEnd, dates: selectedDates },
      })).trim())

      const existingFortune = (entry.fortuneJson ?? {}) as Record<string, unknown>
      await prisma.sajuEntry.update({
        where: { id },
        data: { fortuneJson: { ...existingFortune, [cacheKey]: summary } as object },
      })
      await consumeUnits(user.id, READING_COST.period, 'use:period')

      return NextResponse.json({
        weekStart,
        weekEnd: weekEnd > weekStart ? weekEnd : undefined,
        dates: selectedDates,
        summary,
      })
    }

    if (isMonthlyRequest) {
      const monthStart = parseInt(monthStr!, 10)
      const monthEnd = monthEndStr ? parseInt(monthEndStr, 10) : monthStart
      if (
        isNaN(monthStart) || isNaN(monthEnd)
        || monthStart < 1 || monthStart > 12
        || monthEnd < monthStart || monthEnd > 12
      ) {
        return NextResponse.json({ error: 'invalid month/monthEnd' }, { status: 400 })
      }

      const monthlyTimeline = chartPayload?.['월운_타임라인']?.data
      const targetYear = chartPayload?.['월운_타임라인']?.target_year ?? new Date().getFullYear()
      const cacheKey = monthStart === monthEnd
        ? `monthSummary_${targetYear}_${monthStart}`
        : `monthSummary_${targetYear}_${monthStart}_${monthEnd}`
      const cached = entry.fortuneJson as Record<string, unknown> | null
      if (cached && typeof cached === 'object' && cached[cacheKey]) {
        return NextResponse.json({
          month: monthStart,
          monthEnd: monthEnd > monthStart ? monthEnd : undefined,
          year: targetYear,
          summary: scrubBreakdownKeyLeakage(String(cached[cacheKey])),
        })
      }

      const balance = await getBalance(user.id)
      if (balance.ju < READING_COST.period) {
        return NextResponse.json({ error: '구간 해설 이용권이 부족합니다.', needed: READING_COST.period, ju: balance.ju }, { status: 402 })
      }

      const monthlyData: Array<{
        month: number; score: number; breakdown?: Record<string, number>;
        seasonTag?: string; seasonEmoji?: string;
        domainJob?: number; domainWealth?: number; domainHealth?: number; domainLove?: number; domainMarriage?: number;
        trineHits?: unknown[]; gongmangFactors?: Record<string, unknown>; shinsalContextAdj?: Record<string, number>;
        relationsOrig?: string; relationsDw?: string; relationsSw?: string;
        ganzi?: string; stemElement?: string; branchElement?: string;
      }> = []
      let missingMonths = 0
      for (let m = monthStart; m <= monthEnd; m++) {
        const md = monthlyTimeline?.find((d: MonthlyDatum) => d.month === m)
        if (md) {
          const mdAny = md as unknown as Record<string, unknown>
          const rOrig = mdAny['관계_with_원국'] as Array<{ with?: string; relations?: string[] }> | undefined
          const rOrigStr = rOrig?.map(r => `${r.with ?? ''}: ${(r.relations ?? []).join(', ')}`).join(' / ') || ''
          const rDw = (mdAny['관계_with_대운'] ?? []) as string[]
          const rSw = (mdAny['관계_with_세운'] ?? []) as string[]
          monthlyData.push({
            month: md.month, score: md.scores['종합'], breakdown: md.breakdown,
            seasonTag: md['시즌태그']?.tag, seasonEmoji: md['시즌태그']?.emoji,
            domainJob: md.scores['직업'], domainWealth: md.scores['재물'],
            domainHealth: md.scores['건강'], domainLove: md.scores['연애'],
            domainMarriage: md.scores['결혼'],
            trineHits: md.trine_hits as unknown[], gongmangFactors: md.gongmang_factors as unknown as Record<string, unknown> | undefined,
            shinsalContextAdj: md.shinsal_context_adj,
            relationsOrig: rOrigStr, relationsDw: rDw.join(', '), relationsSw: rSw.join(', '),
            ganzi: md['간지'], stemElement: md.stemElement, branchElement: md.branchElement,
          })
        } else {
          missingMonths++
        }
      }

      if (!monthlyData.length || missingMonths > 0) {
        return NextResponse.json({ error: '월운 데이터가 부족해요. 차트를 새로고침한 뒤 다시 시도해 주세요.' }, { status: 409 })
      }

      const yearRaw = chartPayload?.['연도별_타임라인']?.find((d) => d.year === targetYear)
      const yearCd = chartData?.data.find((d) => d.year === targetYear)
      const yearContextParts = [
        yearCd?.score != null ? `종합 ${Math.round(yearCd.score)}점` : '',
        yearCd?.seasonTag ? `시즌 ${yearCd.seasonTag}` : '',
        yearRaw?.['세운_pillar'] ? `세운 ${pillarToHangul(yearRaw['세운_pillar'])}` : '',
        yearCd?.daewoonPillar ? `대운 ${pillarToHangul(yearCd.daewoonPillar)}` : '',
      ].filter(Boolean)
      const yearContext = yearContextParts.length
        ? `${targetYear}년 기조: ${yearContextParts.join(' · ')}`
        : undefined

      const prompt = buildMonthlySummaryPrompt(report, monthlyData, targetYear, {
        birthYear,
        job: entry.job,
        yearContext,
      })
      const summary = scrubBreakdownKeyLeakage((await callGemini(prompt, {
        feature: monthStart === monthEnd ? 'period_month' : 'period_month_range',
        meta: { entryId: id, year: targetYear, monthStart, monthEnd },
      })).trim())

      const existingFortune = (entry.fortuneJson ?? {}) as Record<string, unknown>
      await prisma.sajuEntry.update({
        where: { id },
        data: { fortuneJson: { ...existingFortune, [cacheKey]: summary } as object },
      })

      await consumeUnits(user.id, READING_COST.period, 'use:period')

      return NextResponse.json({
        month: monthStart,
        monthEnd: monthEnd > monthStart ? monthEnd : undefined,
        year: targetYear,
        summary,
      })
    }

    const yearStart = parseInt(yearStr!, 10)
    if (isNaN(yearStart)) return NextResponse.json({ error: 'invalid year' }, { status: 400 })
    const yearEnd = yearEndStr ? parseInt(yearEndStr, 10) : yearStart
    if (isNaN(yearEnd) || yearEnd < yearStart) {
      return NextResponse.json({ error: 'invalid yearEnd' }, { status: 400 })
    }
    if (yearEnd - yearStart + 1 > MAX_YEAR_RANGE) {
      return NextResponse.json({ error: `연도 구간은 최대 ${MAX_YEAR_RANGE}년까지 선택할 수 있어요.` }, { status: 400 })
    }
    const isRange = yearEnd > yearStart

    const cacheKey = isRange ? `yearSummary_${yearStart}_${yearEnd}` : `yearSummary_${yearStart}`
    const cached = (entry.fortuneJson as Record<string, unknown> | null)
    if (cached && typeof cached === 'object' && cached[cacheKey]) {
      return NextResponse.json({ year: yearStart, yearEnd: isRange ? yearEnd : undefined, summary: scrubBreakdownKeyLeakage(String(cached[cacheKey])) })
    }

    const yearBalance = await getBalance(user.id)
    if (yearBalance.ju < READING_COST.period) {
      return NextResponse.json({ error: '구간 해설 이용권이 부족합니다.', needed: READING_COST.period, ju: yearBalance.ju }, { status: 402 })
    }

    let summary: string
    const rawTimeline = chartPayload?.['연도별_타임라인']

    if (isRange) {
      const yearDataArr: YearChartData[] = []
      for (let y = yearStart; y <= yearEnd; y++) {
        yearDataArr.push(buildYearChartDataFromSources(y, chartData, rawTimeline))
      }
      const prompt = buildRangeSummaryPrompt(report, yearDataArr, { birthYear, job: entry.job })
      summary = scrubBreakdownKeyLeakage((await callGemini(prompt, {
        feature: 'period_year_range',
        meta: { entryId: id, yearStart, yearEnd, years: yearEnd - yearStart + 1 },
      })).trim())
    } else {
      const yearChartData = buildYearChartDataFromSources(yearStart, chartData, rawTimeline)
      const prompt = buildYearSummaryPrompt(report, yearChartData, { birthYear, job: entry.job })
      summary = scrubBreakdownKeyLeakage((await callGemini(prompt, {
        feature: 'period_year',
        meta: { entryId: id, year: yearStart },
      })).trim())
    }

    const existingFortune = (entry.fortuneJson ?? {}) as Record<string, unknown>
    await prisma.sajuEntry.update({
      where: { id },
      data: { fortuneJson: { ...existingFortune, [cacheKey]: summary } as object },
    })

    await consumeUnits(user.id, READING_COST.period, 'use:period')

    return NextResponse.json({ year: yearStart, yearEnd: isRange ? yearEnd : undefined, summary })
  } catch (error) {
    console.error('Year summary error:', error)
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
