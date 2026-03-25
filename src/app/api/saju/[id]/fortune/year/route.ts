import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { consumeCredit, getBalance } from '@/lib/payment/entitlement'
import { buildYearSummaryPrompt, buildRangeSummaryPrompt, buildMonthlySummaryPrompt, buildCompatibilitySummaryPrompt } from '@/lib/ai/fortune-prompt'
import type { SajuReportJson } from '@/types/saju-report'
import type { YearChartData } from '@/lib/ai/fortune-prompt'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import type { ChartPayload, YearlyDatum, MonthlyDatum } from '@/types/chart'
import { pillarToHangul } from '@/lib/saju/hanja-hangul'
import { callGemini } from '@/lib/ai/gemini'

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
    const isMonthlyRequest = !!monthStr

    if (!yearStr && !monthStr) return NextResponse.json({ error: 'year or month is required' }, { status: 400 })

    const user = await getUserFromSession().catch(() => null)
    const guestId = getGuestId(request)

    const entry = await prisma.sajuEntry.findUnique({ where: { id } })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user && entry.userId !== user.id && entry.guestId !== guestId) {
      if (entry.userId || entry.guestId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    const report = entry.sajuReportJson as SajuReportJson | null
    if (!report) return NextResponse.json({ error: 'No saju data' }, { status: 400 })

    const birthYear = entry.birthDate ? parseInt(entry.birthDate.slice(0, 4), 10) : new Date().getFullYear() - 30
    const chartPayload = report.chartData as ChartPayload | undefined
    const chartData = chartPayload ? buildLifeChartData(chartPayload, report, birthYear) : null

    if (isMonthlyRequest) {
      const monthStart = parseInt(monthStr!, 10)
      const monthEnd = monthEndStr ? parseInt(monthEndStr, 10) : monthStart
      if (isNaN(monthStart)) return NextResponse.json({ error: 'invalid month' }, { status: 400 })

      const cacheKey = monthStart === monthEnd ? `monthSummary_${monthStart}` : `monthSummary_${monthStart}_${monthEnd}`
      const cached = entry.fortuneJson as Record<string, unknown> | null
      if (cached && typeof cached === 'object' && cached[cacheKey]) {
        return NextResponse.json({ month: monthStart, monthEnd: monthEnd > monthStart ? monthEnd : undefined, summary: cached[cacheKey] })
      }

      if (user) {
        const balance = await getBalance(user.id)
        if (balance.periodCredits <= 0) {
          return NextResponse.json({ error: '기간 해설 이용권이 부족합니다.' }, { status: 402 })
        }
      }

      const monthlyTimeline = chartPayload?.['월운_타임라인']?.data
      const targetYear = chartPayload?.['월운_타임라인']?.target_year ?? new Date().getFullYear()
      const monthlyData: Array<{
        month: number; score: number; breakdown?: Record<string, number>;
        seasonTag?: string; seasonEmoji?: string;
        domainJob?: number; domainWealth?: number; domainHealth?: number; domainLove?: number; domainMarriage?: number;
        trineHits?: unknown[]; gongmangFactors?: Record<string, unknown>; shinsalContextAdj?: Record<string, number>;
        relationsOrig?: string; relationsDw?: string; relationsSw?: string;
        ganzi?: string; stemElement?: string; branchElement?: string;
      }> = []
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
          monthlyData.push({ month: m, score: 50 })
        }
      }

      const prompt = buildMonthlySummaryPrompt(report, monthlyData, targetYear, { birthYear, job: entry.job })
      const summary = (await callGemini(prompt)).trim()

      const existingFortune = (entry.fortuneJson ?? {}) as Record<string, unknown>
      await prisma.sajuEntry.update({
        where: { id },
        data: { fortuneJson: { ...existingFortune, [cacheKey]: summary } as object },
      })

      if (user) {
        await consumeCredit(user.id, 'period')
      }

      return NextResponse.json({ month: monthStart, monthEnd: monthEnd > monthStart ? monthEnd : undefined, summary })
    }

    const yearStart = parseInt(yearStr!, 10)
    if (isNaN(yearStart)) return NextResponse.json({ error: 'invalid year' }, { status: 400 })
    const yearEnd = yearEndStr ? parseInt(yearEndStr, 10) : yearStart
    const isRange = yearEnd > yearStart

    const cacheKey = isRange ? `yearSummary_${yearStart}_${yearEnd}` : `yearSummary_${yearStart}`
    const cached = (entry.fortuneJson as Record<string, unknown> | null)
    if (cached && typeof cached === 'object' && cached[cacheKey]) {
      return NextResponse.json({ year: yearStart, yearEnd: isRange ? yearEnd : undefined, summary: cached[cacheKey] })
    }

    if (user) {
      const balance = await getBalance(user.id)
      if (balance.periodCredits <= 0) {
        return NextResponse.json({ error: '기간 해설 이용권이 부족합니다.' }, { status: 402 })
      }
    }

    let summary: string
    const rawTimeline = chartPayload?.['연도별_타임라인']

    if (isRange) {
      const yearDataArr: YearChartData[] = []
      for (let y = yearStart; y <= yearEnd; y++) {
        yearDataArr.push(buildYearChartDataFromSources(y, chartData, rawTimeline))
      }
      const prompt = buildRangeSummaryPrompt(report, yearDataArr, { birthYear, job: entry.job })
      summary = (await callGemini(prompt)).trim()
    } else {
      const yearChartData = buildYearChartDataFromSources(yearStart, chartData, rawTimeline)
      const prompt = buildYearSummaryPrompt(report, yearChartData, { birthYear, job: entry.job })
      summary = (await callGemini(prompt)).trim()
    }

    const existingFortune = (entry.fortuneJson ?? {}) as Record<string, unknown>
    await prisma.sajuEntry.update({
      where: { id },
      data: { fortuneJson: { ...existingFortune, [cacheKey]: summary } as object },
    })

    if (user) {
      await consumeCredit(user.id, 'period')
    }

    const overlayId = request.nextUrl.searchParams.get('overlayId')
    let compatSummary: string | undefined
    if (overlayId) {
      try {
        const overlayEntry = await prisma.sajuEntry.findUnique({ where: { id: overlayId } })
        if (overlayEntry?.sajuReportJson) {
          const overlayReport = overlayEntry.sajuReportJson as SajuReportJson
          const overlayBirthYear = overlayEntry.birthDate ? parseInt(overlayEntry.birthDate.slice(0, 4), 10) : birthYear
          const compatPrompt = buildCompatibilitySummaryPrompt(
            report, overlayReport,
            entry.gender, overlayEntry.gender,
            entry.name, overlayEntry.name,
            yearStart, yearEnd,
            { birthYearA: birthYear, birthYearB: overlayBirthYear }
          )
          compatSummary = (await callGemini(compatPrompt)).trim()
        }
      } catch (e) { console.error('Compatibility summary error:', e) }
    }

    return NextResponse.json({ year: yearStart, yearEnd: isRange ? yearEnd : undefined, summary, compatSummary })
  } catch (error) {
    console.error('Year summary error:', error)
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
