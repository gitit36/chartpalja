import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { consumeUnits, getBalance } from '@/lib/payment/entitlement'
import { READING_COST } from '@/lib/payment/products'
import { buildCompatibilityReportPrompt } from '@/lib/ai/fortune-prompt'
import { classifyCompat } from '@/lib/compat/classify'
import { buildRelationshipSeries, buildCompatCard } from '@/lib/compat/relationship-score'
import { canAccessPartnerEntry, parseRelationshipParam } from '@/lib/compat/access'
import { compatStorageKey } from '@/lib/compat/relationship'
import type { CompatReportEntry, RelationshipType } from '@/lib/compat/types'
import type { SajuReportJson } from '@/types/saju-report'
import { callGemini } from '@/lib/ai/gemini'

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
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

    const compatKey = compatStorageKey(overlayId, relationship)
    const existingFortune = (entry.fortuneJson && typeof entry.fortuneJson === 'object')
      ? entry.fortuneJson as Record<string, unknown>
      : {}
    const legacyKey = `compat_${overlayId}`
    const existingCompat = (existingFortune[compatKey] ?? (
      relationship === 'romance' ? existingFortune[legacyKey] : undefined
    )) as CompatReportEntry | undefined
    if (existingCompat?.text) {
      const normalized = { ...existingCompat, relationship: existingCompat.relationship ?? relationship }
      return NextResponse.json({ compat: normalized, cached: true })
    }

    const balance = await getBalance(user.id)
    if (balance.ju < READING_COST.compat) {
      return NextResponse.json(
        { error: '이용권이 부족합니다.', needed: READING_COST.compat, ju: balance.ju },
        { status: 402 },
      )
    }

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
    const text = (await callGemini(prompt)).trim()

    // 관계 케미 스냅샷 — 두 리포트가 이미 로드된 이 시점에 계산해 저장하면
    // 이후 카드 렌더 시 추가 fetch/지연이 전혀 없다.
    const series = buildRelationshipSeries(reportA, birthYearA, reportB, birthYearB)
    const card = buildCompatCard(series) ?? undefined
    const flow = series.map(p => ({ y: p.year, s: p.score }))

    const compatEntry: CompatReportEntry = {
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

    const mergedFortune = { ...existingFortune, [compatKey]: compatEntry }
    await prisma.sajuEntry.update({
      where: { id },
      data: { fortuneJson: mergedFortune as object },
    })

    await consumeUnits(user.id, READING_COST.compat, 'use:compat')

    return NextResponse.json({ compat: compatEntry })
  } catch (error) {
    console.error('Compat API error:', error)
    const raw = error instanceof Error ? error.message : 'Failed'
    const isApiKeyError = raw.includes('GEMINI_API_KEY')
    const msg = isApiKeyError ? raw : '궁합 해설 생성 중 문제가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
