/**
 * Gemini 실측 토큰·비용 벤치마크 (운영자용).
 *
 * 사용:
 *   npx tsx scripts/measure-gemini-cost.ts
 *
 * - 실제 DB 사주 엔트리로 프롬프트 구성
 * - gemini-2.5-flash 로 기능별 1회씩 호출
 * - 대표 프롬프트(연 단일)를 Flash-Lite / Pro 에도 1회씩 (퀄·비용 비교)
 * - 결과: logs/gemini-measure-<ts>.json + logs/gemini-usage.jsonl
 *
 * 주의: 실과금 발생. 캐시 hit 없음(항상 신규 생성).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { callGeminiWithUsage } from '../src/lib/ai/gemini'
import {
  USD_KRW,
  estimateCostUsd,
  extrapolateCostUsd,
  type GeminiTokenUsage,
  type PricedGeminiModel,
} from '../src/lib/ai/gemini-usage'
import {
  buildYearSummaryPrompt,
  buildRangeSummaryPrompt,
  buildMonthlySummaryPrompt,
  buildWeeklySummaryPrompt,
  buildFortunePrompt,
  buildCompatibilityReportPrompt,
} from '../src/lib/ai/fortune-prompt'
import { buildLifeChartData, type ChartDatum } from '../src/lib/saju/life-chart-data'
import { hydrateWeekSeries } from '../src/lib/saju/hydrate-week-series'
import { weekdayLabelFromDate } from '../src/lib/saju/week-chart-data'
import { kstCenteredWeekDates } from '../src/lib/saju/daily-util'
import { classifyCompat } from '../src/lib/compat/classify'
import { pillarToHangul } from '../src/lib/saju/hanja-hangul'
import type { SajuReportJson } from '../src/types/saju-report'
import type { ChartPayload, MonthlyDatum, YearlyDatum } from '../src/types/chart'
import { READING_COST, JU_UNIT_KRW } from '../src/lib/payment/products'
import type { YearChartData } from '../src/lib/ai/fortune-prompt'
import type { GeminiUsageFeature } from '../src/lib/ai/gemini-usage'

// ── .env 로드 (dotenv 없이) ──────────────────────
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!m) continue
      const key = m[1]!
      let val = m[2]!.trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] == null) process.env[key] = val
    }
  }
}
loadEnv()

const prisma = new PrismaClient()

type MeasureRow = {
  caseId: string
  label: string
  feature: string
  model: string
  juCharged: number
  revenueKrw: number
  usage: GeminiTokenUsage
  apiCostUsd: number
  apiCostKrw: number
  marginKrw: number
  marginPct: number
  outputChars: number
  meta?: Record<string, unknown>
}

function buildYearChartDataFromSources(
  year: number,
  cd: { data: Array<Record<string, unknown>> } | null,
  rawTimeline: YearlyDatum[] | undefined,
): YearChartData {
  const yd = cd?.data.find((d) => d.year === year) as Record<string, unknown> | undefined
  const raw = rawTimeline?.find((d) => d.year === year)
  const origRels = (raw?.['세운_관계_with_원국'] ?? []) as Array<{ with?: string; relations?: string[] }>
  const origStr = origRels.map((r) => `${r.with ?? ''}: ${(r.relations ?? []).join(', ')}`).join(' / ')
  const dwRels = (raw?.['세운_관계_with_대운'] ?? []) as string[]
  const iljuRels = ((raw as unknown as Record<string, unknown> | undefined)?.['세운_일주관계'] ?? []) as string[]
  return {
    year,
    score: (yd?.score as number) ?? 50,
    trend: (yd?.trend as number) ?? undefined,
    seasonTag: (yd?.seasonTag as string) ?? undefined,
    seasonEmoji: (yd?.seasonEmoji as string) ?? undefined,
    daewoonPillar: (yd?.daewoonPillar as string) ?? undefined,
    sewoonPillar: raw?.['세운_pillar'] ?? (yd?.sewoonPillar as string) ?? undefined,
    grade: (yd?.grade as string) ?? undefined,
    yongshinPower: (yd?.yongshinPower as number) ?? undefined,
    domainJob: (yd?.domainJob as number) ?? undefined,
    domainWealth: (yd?.domainWealth as number) ?? undefined,
    domainHealth: (yd?.domainHealth as number) ?? undefined,
    domainLove: (yd?.domainLove as number) ?? undefined,
    domainMarriage: (yd?.domainMarriage as number) ?? undefined,
    sewoonRelsOrig: origStr || '없음',
    sewoonRelsDw: dwRels.join(', ') || '없음',
    sewoonIljuRel: iljuRels.join(', ') || '없음',
    gilshin: (raw?.['세운_신살_길신'] ?? []).join(', ') || '없음',
    hyungshal: (raw?.['세운_신살_흉살'] ?? []).join(', ') || '없음',
    breakdown: raw?.breakdown as Record<string, number> | undefined,
  }
}

function toRow(
  caseId: string,
  label: string,
  feature: string,
  model: string,
  juCharged: number,
  usage: GeminiTokenUsage,
  outputChars: number,
  meta?: Record<string, unknown>,
): MeasureRow {
  const apiCostUsd = estimateCostUsd(usage, model)
  const apiCostKrw = apiCostUsd * USD_KRW
  const revenueKrw = juCharged * JU_UNIT_KRW
  const marginKrw = revenueKrw - apiCostKrw
  return {
    caseId,
    label,
    feature,
    model,
    juCharged,
    revenueKrw,
    usage,
    apiCostUsd,
    apiCostKrw,
    marginKrw,
    marginPct: revenueKrw > 0 ? (marginKrw / revenueKrw) * 100 : 0,
    outputChars,
    meta,
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY missing')
  }

  const entry = await prisma.sajuEntry.findFirst({
    orderBy: { updatedAt: 'desc' },
  })
  if (!entry?.sajuReportJson) throw new Error('No saju entry with report')

  const partner = await prisma.sajuEntry.findFirst({
    where: { id: { not: entry.id } },
    orderBy: { updatedAt: 'desc' },
  })
  if (!partner?.sajuReportJson) {
    console.warn('No partner entry — compat measure will be skipped')
  }

  const report = entry.sajuReportJson as SajuReportJson
  const birthYear = entry.birthDate ? parseInt(entry.birthDate.slice(0, 4), 10) : 1990
  const chartPayload = report.chartData as ChartPayload | undefined
  const lifeChart = chartPayload ? buildLifeChartData(chartPayload, report, birthYear) : null
  const rawTimeline = chartPayload?.['연도별_타임라인']
  const thisYear = new Date().getFullYear()

  console.log(`Entry: ${entry.id} (${entry.name ?? '?'}) birth=${entry.birthDate}`)
  if (partner) console.log(`Partner: ${partner.id} (${partner.name ?? '?'})`)

  const rows: MeasureRow[] = []
  const run = async (
    caseId: string,
    label: string,
    feature: GeminiUsageFeature,
    ju: number,
    prompt: string,
    model: string,
    meta?: Record<string, unknown>,
  ) => {
    console.log(`\n>>> ${caseId}: ${label} [${model}]`)
    try {
      const { text, usage } = await callGeminiWithUsage(prompt, {
        model,
        feature,
        meta: { ...(meta ?? {}), caseId, measure: true },
      })
      if (!usage) {
        console.warn('  no usageMetadata — skip')
        return
      }
      const row = toRow(caseId, label, feature, model, ju, usage, text.length, meta)
      rows.push(row)
      console.log(
        `  prompt=${usage.promptTokenCount} cand=${usage.candidatesTokenCount} thoughts=${usage.thoughtsTokenCount}`
        + ` | API ₩${Math.round(row.apiCostKrw)} | 매출 ₩${row.revenueKrw} | 마진 ₩${Math.round(row.marginKrw)} (${row.marginPct.toFixed(1)}%)`,
      )
    } catch (e) {
      console.warn(`  FAILED ${caseId}:`, e instanceof Error ? e.message : e)
    }
  }

  const writeOut = () => {
    const flashRows = rows.filter((r) => r.model === 'gemini-2.5-flash')
    const extrapolations = flashRows.map((r) => {
      const models: PricedGeminiModel[] = [
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-3-flash-preview',
        'gemini-2.5-pro',
        'gemini-3.1-pro-preview',
      ]
      return {
        caseId: r.caseId,
        label: r.label,
        juCharged: r.juCharged,
        revenueKrw: r.revenueKrw,
        measuredTokens: r.usage,
        byModel: models.map((m) => {
          const usd = extrapolateCostUsd(r.usage, m)
          const krw = usd * USD_KRW
          return {
            model: m,
            apiCostUsd: usd,
            apiCostKrw: krw,
            marginKrw: r.revenueKrw - krw,
            marginPct: r.revenueKrw > 0 ? ((r.revenueKrw - krw) / r.revenueKrw) * 100 : 0,
            note: m === 'gemini-2.5-flash' ? '실측 단가' : '동일 토큰 가정 외삽(thinking 비율 다를 수 있음)',
          }
        }),
      }
    })

    const outDir = path.join(process.cwd(), 'logs')
    mkdirSync(outDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = path.join(outDir, `gemini-measure-${ts}.json`)
    const payload = {
      measuredAt: new Date().toISOString(),
      fxUsdKrw: USD_KRW,
      juUnitKrw: JU_UNIT_KRW,
      entryId: entry.id,
      partnerId: partner?.id ?? null,
      pricingSource: 'https://ai.google.dev/gemini-api/docs/pricing (Paid tier, 2026-07)',
      note: 'Free tier 호출이어도 Paid 단가로 환산. thinking 포함 output 과금.',
      rows,
      extrapolations,
    }
    writeFileSync(outPath, JSON.stringify(payload, null, 2))
    console.log(`\nWrote ${outPath}`)
    console.log(`Cases: ${rows.length}`)
    return outPath
  }

  // 1) 연 단일
  const yearData = buildYearChartDataFromSources(thisYear, lifeChart as { data: Array<Record<string, unknown>> } | null, rawTimeline)
  const yearPrompt = buildYearSummaryPrompt(report, yearData, { birthYear, job: entry.job })
  await run('Y1', `${thisYear}년 단일 해설`, 'period_year', READING_COST.period, yearPrompt, 'gemini-2.5-flash', { year: thisYear })

  // 2) 연 범위 5년 / 20년
  const mkRange = (span: number) => {
    const start = thisYear
    const end = thisYear + span - 1
    const arr: YearChartData[] = []
    for (let y = start; y <= end; y++) {
      arr.push(buildYearChartDataFromSources(y, lifeChart as { data: Array<Record<string, unknown>> } | null, rawTimeline))
    }
    return { start, end, prompt: buildRangeSummaryPrompt(report, arr, { birthYear, job: entry.job }) }
  }
  const r5 = mkRange(5)
  await run('Y5', `${r5.start}~${r5.end}년 (5년)`, 'period_year_range', READING_COST.period, r5.prompt, 'gemini-2.5-flash', { years: 5 })
  const r20 = mkRange(20)
  await run('Y20', `${r20.start}~${r20.end}년 (20년)`, 'period_year_range', READING_COST.period, r20.prompt, 'gemini-2.5-flash', { years: 20 })

  // 3) 월 단일 / 3개월
  const monthlyTimeline = chartPayload?.['월운_타임라인']?.data
  const targetYear = chartPayload?.['월운_타임라인']?.target_year ?? thisYear
  const month = new Date().getMonth() + 1
  const pickMonths = (from: number, to: number) => {
    const out = []
    for (let m = from; m <= to; m++) {
      const md = monthlyTimeline?.find((d: MonthlyDatum) => d.month === m)
      if (!md) continue
      const mdAny = md as unknown as Record<string, unknown>
      const rOrig = mdAny['관계_with_원국'] as Array<{ with?: string; relations?: string[] }> | undefined
      out.push({
        month: md.month,
        score: md.scores['종합'],
        breakdown: md.breakdown,
        seasonTag: md['시즌태그']?.tag,
        seasonEmoji: md['시즌태그']?.emoji,
        domainJob: md.scores['직업'],
        domainWealth: md.scores['재물'],
        domainHealth: md.scores['건강'],
        domainLove: md.scores['연애'],
        domainMarriage: md.scores['결혼'],
        ganzi: md['간지'],
        stemElement: md.stemElement,
        branchElement: md.branchElement,
        relationsOrig: rOrig?.map((r) => `${r.with ?? ''}: ${(r.relations ?? []).join(', ')}`).join(' / ') || '',
        relationsDw: ((mdAny['관계_with_대운'] ?? []) as string[]).join(', '),
        relationsSw: ((mdAny['관계_with_세운'] ?? []) as string[]).join(', '),
        shinsalContextAdj: md.shinsal_context_adj,
      })
    }
    return out
  }
  const m1 = pickMonths(month, month)
  if (m1.length) {
    const yearRaw = rawTimeline?.find((d) => d.year === targetYear)
    const yearCd = lifeChart?.data.find((d) => d.year === targetYear)
    const yearContext = [
      yearCd?.score != null ? `종합 ${Math.round(yearCd.score)}점` : '',
      yearRaw?.['세운_pillar'] ? `세운 ${pillarToHangul(yearRaw['세운_pillar'])}` : '',
    ].filter(Boolean).join(' · ')
    const p = buildMonthlySummaryPrompt(report, m1, targetYear, { birthYear, job: entry.job, yearContext: yearContext || undefined })
    await run('M1', `${targetYear}년 ${month}월 단일`, 'period_month', READING_COST.period, p, 'gemini-2.5-flash', { month })
  }
  const m3Start = Math.max(1, month)
  const m3End = Math.min(12, m3Start + 2)
  const m3 = pickMonths(m3Start, m3End)
  if (m3.length >= 2) {
    const p = buildMonthlySummaryPrompt(report, m3, targetYear, { birthYear, job: entry.job })
    await run('M3', `${targetYear}년 ${m3Start}~${m3End}월`, 'period_month_range', READING_COST.period, p, 'gemini-2.5-flash', { months: m3.length })
  }

  // 4) 주 단일(오늘) / 3일
  try {
    const week = await hydrateWeekSeries({
      id: entry.id,
      birthDate: entry.birthDate,
      birthTime: entry.birthTime,
      timeUnknown: entry.timeUnknown,
      gender: entry.gender,
      isLunar: entry.isLunar,
      isLeapMonth: entry.isLeapMonth,
      sajuReportJson: entry.sajuReportJson,
    })
    const dates = kstCenteredWeekDates()
    const byDate = new Map(week.days.map((d) => [d.date, d]))
    const toDay = (date: string) => {
      const row = byDate.get(date)!
      const chart = row.chart
      return {
        date,
        weekday: weekdayLabelFromDate(date),
        score: row.score ?? 50,
        grade: row.grade,
        seasonTag: row.seasonTag,
        seasonEmoji: row.seasonEmoji,
        seasonDesc: row.seasonDesc,
        domains: row.domains ?? null,
        yongshinPower: chart?.yongshinPower,
        energyTotal: chart?.energyTotal,
        energyDirection: chart?.energyDirection,
        breakdown: chart?.breakdown,
        shinsalTags: chart?.shinsalTags,
        shinsalContextAdj: chart?.shinsalContextAdj,
        events: chart?.events,
      }
    }
    const todayDate = dates[3]!
    if (byDate.get(todayDate)?.score != null) {
      const p = buildWeeklySummaryPrompt(report, [toDay(todayDate)], { birthYear, job: entry.job })
      await run('W1', `오늘(${todayDate}) 일운`, 'period_week', READING_COST.period, p, 'gemini-2.5-flash', { date: todayDate })
    }
    const three = dates.slice(2, 5).filter((d) => byDate.get(d)?.score != null).map(toDay)
    if (three.length >= 2) {
      const p = buildWeeklySummaryPrompt(report, three, { birthYear, job: entry.job })
      await run('W3', `3일 구간`, 'period_week_range', READING_COST.period, p, 'gemini-2.5-flash', { days: three.length })
    }
  } catch (e) {
    console.warn('week measure skipped', e)
  }

  // 5) 운세
  const fortunePrompt = buildFortunePrompt(
    report,
    { birthYear, chartData: lifeChart?.data as ChartDatum[] | undefined, job: entry.job },
  )
  await run('F1', '운세 해설 (전체)', 'fortune', READING_COST.fortune, fortunePrompt, 'gemini-2.5-flash')

  // 6) 궁합
  if (partner?.sajuReportJson) {
    const reportB = partner.sajuReportJson as SajuReportJson
    const birthYearB = partner.birthDate ? parseInt(partner.birthDate.slice(0, 4), 10) : birthYear
    const compatType = classifyCompat(report, birthYear, reportB, birthYearB)
    const compatPrompt = buildCompatibilityReportPrompt(
      report,
      reportB,
      entry.gender ?? 'male',
      partner.gender ?? 'male',
      entry.name ?? '나',
      partner.name ?? '상대',
      compatType,
      'friend',
      { birthYearA: birthYear, birthYearB },
    )
    await run('C1', '궁합 해설 (친구)', 'compat', READING_COST.compat, compatPrompt, 'gemini-2.5-flash', {
      partnerId: partner.id,
    })
  }

  // 7) 동일 연 단일 프롬프트를 다른 모델로 (비용·퀄 실측)
  const altModels: { id: string; model: PricedGeminiModel | string }[] = [
    { id: 'Y1-lite', model: 'gemini-2.5-flash-lite' },
    { id: 'Y1-pro', model: 'gemini-2.5-pro' },
  ]
  for (const alt of altModels) {
    try {
      await run(alt.id, `${thisYear}년 단일 · ${alt.model}`, 'period_year', READING_COST.period, yearPrompt, alt.model, {
        year: thisYear,
        compareBase: 'Y1',
      })
    } catch (e) {
      console.warn(`model ${alt.model} failed`, e)
    }
  }

  // 토큰량 고정 시 모델별 가격 외삽 + 파일 저장
  writeOut()
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
