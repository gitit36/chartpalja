import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { consumeUnits, getBalance } from '@/lib/payment/entitlement'
import { READING_COST } from '@/lib/payment/products'
import { buildFortunePrompt, scrubBreakdownKeyLeakageDeep } from '@/lib/ai/fortune-prompt'
import type { ChartSummary } from '@/lib/ai/fortune-prompt'
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { buildLifeChartData, extractTransitionYears, extract3YearContext, extractLifetimeSummary } from '@/lib/saju/life-chart-data'
import type { ChartDatum } from '@/lib/saju/life-chart-data'
import { callGemini } from '@/lib/ai/gemini'

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

function parseJsonResponse(text: string): unknown[] {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1)
  }
  try {
    return JSON.parse(cleaned)
  } catch (e1) {
    // LLM often embeds raw newlines, backticks, or control chars inside JSON
    // string values. Walk char-by-char to properly escape them.
    let sanitized = ''
    let inString = false
    let escape = false
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i]!
      if (escape) { sanitized += ch; escape = false; continue }
      if (ch === '\\' && inString) { sanitized += ch; escape = true; continue }
      if (ch === '"') { inString = !inString; sanitized += ch; continue }
      if (inString) {
        const code = ch.charCodeAt(0)
        if (code < 0x20) {
          if (ch === '\n') { sanitized += '\\n'; continue }
          if (ch === '\r') { sanitized += '\\r'; continue }
          if (ch === '\t') { sanitized += '\\t'; continue }
          continue
        }
        if (ch === '`') { sanitized += "'"; continue }
        sanitized += ch
      } else {
        sanitized += ch
      }
    }
    try {
      return JSON.parse(sanitized)
    } catch {
      console.error('parseJsonResponse: both attempts failed', (e1 as Error).message)
      throw e1
    }
  }
}

function isValidFortuneFormat(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  const items = obj.items ?? obj
  if (!Array.isArray(items) || items.length < 7) return false  // accept 7+ for backward compat
  const first = items[0] as Record<string, unknown> | undefined
  return !!first?.category && !!first?.title && !!first?.content
}

function buildChartSummary(report: SajuReportJson, birthYear: number): ChartSummary | undefined {
  const chartPayload = report.chartData as ChartPayload | undefined
  const lifeChart = buildLifeChartData(chartPayload, report, birthYear)
  if (!lifeChart?.data?.length) return undefined

  const data = lifeChart.data
  const currentYear = new Date().getFullYear()

  let peakYear = data[0]!.year, peakScore = -Infinity
  let valleyYear = data[0]!.year, valleyScore = Infinity

  for (const d of data) {
    if (d.score > peakScore) { peakScore = d.score; peakYear = d.year }
    if (d.score < valleyScore) { valleyScore = d.score; valleyYear = d.year }
  }

  const current = data.find(d => d.year === currentYear)
  const currentScore = current?.score ?? 50
  const currentSeason = current?.seasonTag ?? ''
  const currentSeasonDesc = current?.seasonDesc ?? ''

  const sorted = [...data].sort((a, b) => b.score - a.score)
  const topYears = sorted.slice(0, 5).map(d => `${d.year}년(${Math.round(d.score)}점)`).join(', ')
  const lowYears = sorted.slice(-5).reverse().map(d => `${d.year}년(${Math.round(d.score)}점)`).join(', ')

  const future5 = data.filter(d => d.year >= currentYear && d.year < currentYear + 5)
  let trend5y = '안정적'
  if (future5.length >= 2) {
    const first = future5[0]!.score
    const last = future5[future5.length - 1]!.score
    const diff = last - first
    if (diff > 10) trend5y = `상승세 (${Math.round(first)}→${Math.round(last)}점)`
    else if (diff < -10) trend5y = `하락세 (${Math.round(first)}→${Math.round(last)}점)`
    else trend5y = `안정 유지 (${Math.round(first)}~${Math.round(last)}점)`
  }

  const futureData = data.filter(d => d.year > currentYear)
  let nextBigShift = '특별한 전환점 없음'
  for (let i = 1; i < futureData.length; i++) {
    const diff = Math.abs(futureData[i]!.score - futureData[i - 1]!.score)
    if (diff > 12) {
      const direction = futureData[i]!.score > futureData[i - 1]!.score ? '급상승' : '급하락'
      nextBigShift = `${futureData[i]!.year}년 (${direction}, 점수 변화폭 ${Math.round(diff)}점)`
      break
    }
  }

  const scores = data.map(d => d.score)
  const scoreRange = `${Math.round(Math.min(...scores))}~${Math.round(Math.max(...scores))}점`

  return {
    peakYear, peakScore: Math.round(peakScore),
    valleyYear, valleyScore: Math.round(valleyScore),
    currentScore: Math.round(currentScore),
    currentSeason, currentSeasonDesc,
    nextBigShift, scoreRange, topYears, lowYears, trend5y,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true'
    const user = await getUserFromSession().catch(() => null)
    const guestId = getGuestId(request)

    // LLM 비용 보호: 비로그인 게스트는 운세 해설 API를 호출할 수 없다.
    if (!user) {
      return NextResponse.json(
        { error: 'login_required', message: '운세 해설을 보려면 로그인이 필요해요.' },
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

    if (!regenerate && entry.fortuneJson && isValidFortuneFormat(entry.fortuneJson)) {
      const cached = entry.fortuneJson as { items: unknown[] }
      return NextResponse.json({ items: scrubBreakdownKeyLeakageDeep(cached.items ?? cached) })
    }

    const isFirstGeneration = !entry.fortuneJson || !isValidFortuneFormat(entry.fortuneJson)
    const isRegenWithConsume = regenerate && request.nextUrl.searchParams.get('consumeCredit') === 'true'
    const shouldConsumeCredit = isFirstGeneration || isRegenWithConsume

    if (shouldConsumeCredit) {
      const balance = await getBalance(user.id)
      if (balance.ju < READING_COST.fortune) {
        return NextResponse.json({ error: '이용권이 부족합니다.', needed: READING_COST.fortune, ju: balance.ju }, { status: 402 })
      }
    }

    const report = entry.sajuReportJson as SajuReportJson | null
    if (!report) {
      return NextResponse.json({ error: 'No saju data' }, { status: 400 })
    }

    const birthYear = entry.birthDate ? parseInt(entry.birthDate.slice(0, 4), 10) : new Date().getFullYear() - 30
    const chartSummary = buildChartSummary(report, birthYear)
    const chartPayloadForPrompt = report.chartData as ChartPayload | undefined
    const lifeChart = buildLifeChartData(chartPayloadForPrompt, report, birthYear)
    const chartData = lifeChart?.data as ChartDatum[] | undefined
    const prompt = buildFortunePrompt(report, { birthYear, chartData, job: entry.job }, chartSummary)
    const raw = await callGemini(prompt, { feature: 'fortune', meta: { entryId: id } })
    const items = scrubBreakdownKeyLeakageDeep(parseJsonResponse(raw)) as unknown[]

    const existingFortune = (entry.fortuneJson && typeof entry.fortuneJson === 'object')
      ? entry.fortuneJson as Record<string, unknown>
      : {}

    await prisma.sajuEntry.update({
      where: { id },
      data: { fortuneJson: { ...existingFortune, items } as object },
    })

    if (shouldConsumeCredit) {
      await consumeUnits(user.id, READING_COST.fortune, 'use:fortune')
    }

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Fortune API error:', error)
    const raw = error instanceof Error ? error.message : 'Failed'
    const isApiKeyError = raw.includes('GEMINI_API_KEY')
    const msg = isApiKeyError ? raw : '해설을 불러오는 중 문제가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
