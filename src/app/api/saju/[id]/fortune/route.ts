import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { consumeCredit } from '@/lib/payment/entitlement'
import { buildFortunePrompt } from '@/lib/ai/fortune-prompt'
import type { ChartSummary } from '@/lib/ai/fortune-prompt'
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { buildLifeChartData, extractTransitionYears, extract3YearContext, extractLifetimeSummary } from '@/lib/saju/life-chart-data'
import type { ChartDatum } from '@/lib/saju/life-chart-data'

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가해주세요.')
  }
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

function parseJsonResponse(text: string): unknown[] {
  let cleaned = text.trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1)
  }
  return JSON.parse(cleaned)
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

    const entry = await prisma.sajuEntry.findUnique({ where: { id } })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (user && entry.userId !== user.id && entry.guestId !== guestId) {
      if (entry.userId || entry.guestId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    if (!regenerate && entry.fortuneJson && isValidFortuneFormat(entry.fortuneJson)) {
      const cached = entry.fortuneJson as { items: unknown[] }
      return NextResponse.json({ items: cached.items ?? cached })
    }

    const isFirstGeneration = !entry.fortuneJson || !isValidFortuneFormat(entry.fortuneJson)
    const isRegenWithConsume = regenerate && request.nextUrl.searchParams.get('consumeCredit') === 'true'

    if ((isFirstGeneration || isRegenWithConsume) && user) {
      const consumed = await consumeCredit(user.id, 'chart')
      if (!consumed) {
        return NextResponse.json({ error: '이용권이 부족합니다.' }, { status: 402 })
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
    const prompt = buildFortunePrompt(report, { birthYear, chartData }, chartSummary)
    const raw = await callGemini(prompt)
    const items = parseJsonResponse(raw)

    await prisma.sajuEntry.update({
      where: { id },
      data: { fortuneJson: { items } as object },
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Fortune API error:', error)
    const raw = error instanceof Error ? error.message : 'Failed'
    const isApiKeyError = raw.includes('GEMINI_API_KEY')
    const msg = isApiKeyError ? raw : '해설을 불러오는 중 문제가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
