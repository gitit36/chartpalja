import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { getBalance } from '@/lib/payment/entitlement'
import { READING_COST } from '@/lib/payment/products'
import { buildCompatibilityReportPrompt } from '@/lib/ai/fortune-prompt'
import { classifyCompat } from '@/lib/compat/classify'
import { buildRelationshipSeries, buildCompatCard } from '@/lib/compat/relationship-score'
import { canAccessPartnerEntry, parseRelationshipParam } from '@/lib/compat/access'
import { compatStorageKey } from '@/lib/compat/relationship'
import type { CompatReportEntry } from '@/lib/compat/types'
import type { SajuReportJson } from '@/types/saju-report'
import { callGemini } from '@/lib/ai/gemini'
import { generationLockKey, withGenerationLock } from '@/lib/ai/generation-lock'
import { persistFortuneJsonAndConsume } from '@/lib/ai/persist-reading'

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

function readCompatFromFortune(
  fortuneJson: unknown,
  compatKey: string,
  overlayId: string,
  relationship: string,
): CompatReportEntry | null {
  if (!fortuneJson || typeof fortuneJson !== 'object') return null
  const existingFortune = fortuneJson as Record<string, unknown>
  const legacyKey = `compat_${overlayId}`
  const existingCompat = (existingFortune[compatKey] ?? (
    relationship === 'romance' ? existingFortune[legacyKey] : undefined
  )) as CompatReportEntry | undefined
  if (!existingCompat?.text) return null
  return { ...existingCompat, relationship: existingCompat.relationship ?? relationship as CompatReportEntry['relationship'] }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const overlayId = request.nextUrl.searchParams.get('overlayId')
    const relationship = parseRelationshipParam(request.nextUrl.searchParams.get('relationship'))
    if (!overlayId) {
      return NextResponse.json({ error: 'overlayId가 필요합니다.' }, { status: 400 })
    }
    if (!relationship) {
      return NextResponse.json({ error: 'relationship가 필요합니다.' }, { status: 400 })
    }

    const user = await getUserFromSession().catch(() => null)
    if (!user) {
      return NextResponse.json({ error: 'login_required', message: '궁합 해설을 보려면 로그인이 필요해요.' }, { status: 401 })
    }

    const guestId = getGuestId(request)
    const entry = await prisma.sajuEntry.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        guestId: true,
        name: true,
        gender: true,
        birthDate: true,
        fortuneJson: true,
      },
    })
    if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (entry.userId && entry.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!entry.userId && entry.guestId && entry.guestId !== guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const allowed = await canAccessPartnerEntry(user.id, id, overlayId)
    if (!allowed) {
      return NextResponse.json({ error: 'Unauthorized partner' }, { status: 403 })
    }

    const compatKey = compatStorageKey(overlayId, relationship)
    const cached = readCompatFromFortune(entry.fortuneJson, compatKey, overlayId, relationship)
    if (cached) {
      return NextResponse.json({ compat: cached, cached: true })
    }

    const balance = await getBalance(user.id)
    if (balance.ju < READING_COST.compat) {
      return NextResponse.json(
        { error: '이용권이 부족합니다.', needed: READING_COST.compat, ju: balance.ju },
        { status: 402 },
      )
    }

    const lockKey = generationLockKey(['compat', id, overlayId, relationship])
    const compatEntry = await withGenerationLock(lockKey, async () => {
      // 락 진입 후 캐시 재확인 (동시 요청이 이미 저장했을 수 있음)
      const fresh = await prisma.sajuEntry.findUnique({
        where: { id },
        select: { fortuneJson: true },
      })
      const again = readCompatFromFortune(fresh?.fortuneJson, compatKey, overlayId, relationship)
      if (again) return again

      const [selfReport, partner] = await Promise.all([
        prisma.sajuEntry.findUnique({ where: { id }, select: { sajuReportJson: true } }),
        prisma.sajuEntry.findUnique({
          where: { id: overlayId },
          select: { sajuReportJson: true, name: true, gender: true, birthDate: true },
        }),
      ])
      const reportA = selfReport?.sajuReportJson as SajuReportJson | null
      if (!reportA) throw new Error('No saju data')
      if (!partner?.sajuReportJson) throw new Error('비교 대상을 찾을 수 없습니다.')

      const reportB = partner.sajuReportJson as SajuReportJson
      const birthYearA = entry.birthDate ? parseInt(entry.birthDate.slice(0, 4), 10) : new Date().getFullYear() - 30
      const birthYearB = partner.birthDate ? parseInt(partner.birthDate.slice(0, 4), 10) : new Date().getFullYear() - 30
      const compatType = classifyCompat(reportA, birthYearA, reportB, birthYearB)

      const prompt = buildCompatibilityReportPrompt(
        reportA,
        reportB,
        entry.gender ?? 'male',
        partner.gender ?? 'male',
        entry.name ?? '나',
        partner.name ?? '상대',
        compatType,
        relationship,
        { birthYearA, birthYearB },
      )
      const text = (await callGemini(prompt, {
        feature: 'compat',
        meta: { entryId: id, overlayId, relationship },
      })).trim()

      const series = buildRelationshipSeries(reportA, birthYearA, reportB, birthYearB)
      const card = buildCompatCard(series) ?? undefined
      const flow = series.map(p => ({ y: p.year, s: p.score }))

      const created: CompatReportEntry = {
        partnerId: overlayId,
        partnerName: partner.name ?? '상대',
        partnerGender: partner.gender ?? 'male',
        relationship,
        type: compatType,
        text,
        createdAt: new Date().toISOString(),
        card,
        flow,
      }

      const existingFortune = (fresh?.fortuneJson && typeof fresh.fortuneJson === 'object')
        ? fresh.fortuneJson as Record<string, unknown>
        : {}
      await persistFortuneJsonAndConsume({
        entryId: id,
        fortuneJson: { ...existingFortune, [compatKey]: created } as object,
        userId: user.id,
        cost: READING_COST.compat,
        reason: 'use:compat',
      })
      return created
    })

    return NextResponse.json({ compat: compatEntry })
  } catch (error) {
    console.error('Compat API error:', error)
    const raw = error instanceof Error ? error.message : 'Failed'
    if (raw.includes('insufficient_ju')) {
      return NextResponse.json({ error: '이용권이 부족합니다.', needed: READING_COST.compat }, { status: 402 })
    }
    if (raw === 'No saju data') {
      return NextResponse.json({ error: 'No saju data' }, { status: 400 })
    }
    if (raw === '비교 대상을 찾을 수 없습니다.') {
      return NextResponse.json({ error: raw }, { status: 404 })
    }
    const isApiKeyError = raw.includes('GEMINI_API_KEY')
    const msg = isApiKeyError ? raw : '궁합 해설 생성 중 문제가 발생했습니다. 잠시 후 다시 열어보면 이미 생성됐을 수 있어요.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
