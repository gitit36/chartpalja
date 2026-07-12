/**
 * 남은 측정만 재시도 (quota 회복 후).
 *   npx tsx scripts/measure-gemini-cost-resume.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { callGeminiWithUsage } from '../src/lib/ai/gemini'
import {
  USD_KRW,
  estimateCostUsd,
  type GeminiTokenUsage,
} from '../src/lib/ai/gemini-usage'
import { buildYearSummaryPrompt, buildCompatibilityReportPrompt } from '../src/lib/ai/fortune-prompt'
import { buildLifeChartData } from '../src/lib/saju/life-chart-data'
import { classifyCompat } from '../src/lib/compat/classify'
import type { SajuReportJson } from '../src/types/saju-report'
import type { ChartPayload, YearlyDatum } from '../src/types/chart'
import { READING_COST, JU_UNIT_KRW } from '../src/lib/payment/products'
import type { YearChartData } from '../src/lib/ai/fortune-prompt'

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!m) continue
      const key = m[1]!
      let val = m[2]!.trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
      if (process.env[key] == null) process.env[key] = val
    }
  }
}
loadEnv()

const prisma = new PrismaClient()

function buildYear(year: number, cd: { data: Array<Record<string, unknown>> } | null, rawTimeline: YearlyDatum[] | undefined): YearChartData {
  const yd = cd?.data.find((d) => d.year === year) as Record<string, unknown> | undefined
  const raw = rawTimeline?.find((d) => d.year === year)
  return {
    year,
    score: (yd?.score as number) ?? 50,
    seasonTag: (yd?.seasonTag as string) ?? undefined,
    daewoonPillar: (yd?.daewoonPillar as string) ?? undefined,
    sewoonPillar: raw?.['세운_pillar'] ?? (yd?.sewoonPillar as string) ?? undefined,
    breakdown: raw?.breakdown as Record<string, number> | undefined,
    domainJob: (yd?.domainJob as number) ?? undefined,
    domainWealth: (yd?.domainWealth as number) ?? undefined,
    domainHealth: (yd?.domainHealth as number) ?? undefined,
    domainLove: (yd?.domainLove as number) ?? undefined,
    domainMarriage: (yd?.domainMarriage as number) ?? undefined,
  }
}

function row(caseId: string, label: string, feature: string, model: string, ju: number, usage: GeminiTokenUsage, outputChars: number) {
  const apiCostUsd = estimateCostUsd(usage, model)
  const apiCostKrw = apiCostUsd * USD_KRW
  const revenueKrw = ju * JU_UNIT_KRW
  return {
    caseId, label, feature, model, juCharged: ju, revenueKrw, usage, apiCostUsd, apiCostKrw,
    marginKrw: revenueKrw - apiCostKrw,
    marginPct: revenueKrw > 0 ? ((revenueKrw - apiCostKrw) / revenueKrw) * 100 : 0,
    outputChars,
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('Waiting 65s for free-tier quota...')
  await sleep(65_000)

  const entry = await prisma.sajuEntry.findFirst({ orderBy: { updatedAt: 'desc' } })
  if (!entry?.sajuReportJson) throw new Error('no entry')
  const partner = await prisma.sajuEntry.findFirst({ where: { id: { not: entry.id } }, orderBy: { updatedAt: 'desc' } })
  const report = entry.sajuReportJson as SajuReportJson
  const birthYear = entry.birthDate ? parseInt(entry.birthDate.slice(0, 4), 10) : 1990
  const chartPayload = report.chartData as ChartPayload | undefined
  const lifeChart = chartPayload ? buildLifeChartData(chartPayload, report, birthYear) : null
  const rawTimeline = chartPayload?.['연도별_타임라인']
  const thisYear = new Date().getFullYear()
  const yearPrompt = buildYearSummaryPrompt(
    report,
    buildYear(thisYear, lifeChart as { data: Array<Record<string, unknown>> } | null, rawTimeline),
    { birthYear, job: entry.job },
  )

  const rows = []

  for (const model of ['gemini-2.5-flash-lite', 'gemini-2.5-pro'] as const) {
    try {
      console.log(`\n>>> Y1 on ${model}`)
      const { text, usage } = await callGeminiWithUsage(yearPrompt, {
        model,
        feature: 'period_year',
        meta: { caseId: `Y1-${model}`, measure: true },
      })
      if (usage) {
        rows.push(row(`Y1-${model}`, `${thisYear}년 · ${model}`, 'period_year', model, READING_COST.period, usage, text.length))
        console.log(`  thoughts=${usage.thoughtsTokenCount} cost=₩${Math.round(estimateCostUsd(usage, model) * USD_KRW)}`)
      }
    } catch (e) {
      console.warn(model, e instanceof Error ? e.message : e)
    }
    await sleep(2000)
  }

  if (partner?.sajuReportJson) {
    try {
      const reportB = partner.sajuReportJson as SajuReportJson
      const birthYearB = partner.birthDate ? parseInt(partner.birthDate.slice(0, 4), 10) : birthYear
      const compatType = classifyCompat(report, birthYear, reportB, birthYearB)
      const prompt = buildCompatibilityReportPrompt(
        report, reportB,
        entry.gender ?? 'male', partner.gender ?? 'male',
        entry.name ?? '나', partner.name ?? '상대',
        compatType, 'friend',
        { birthYearA: birthYear, birthYearB },
      )
      console.log('\n>>> C1 compat flash')
      const { text, usage } = await callGeminiWithUsage(prompt, {
        model: 'gemini-2.5-flash',
        feature: 'compat',
        meta: { caseId: 'C1', measure: true },
      })
      if (usage) {
        rows.push(row('C1', '궁합 해설 (친구)', 'compat', 'gemini-2.5-flash', READING_COST.compat, usage, text.length))
      }
    } catch (e) {
      console.warn('compat', e instanceof Error ? e.message : e)
    }
  }

  mkdirSync('logs', { recursive: true })
  const out = path.join('logs', `gemini-measure-resume-${Date.now()}.json`)
  writeFileSync(out, JSON.stringify({ measuredAt: new Date().toISOString(), fxUsdKrw: USD_KRW, rows }, null, 2))
  console.log('Wrote', out, 'rows', rows.length)
}

main().catch(console.error).finally(() => prisma.$disconnect())
