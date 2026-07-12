import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { buildSajuReportViaPython } from '@/lib/saju/saju-report'
import { resolveYongshin } from '@/lib/ai/yongshin-llm'
import { canReadSajuEntry, stripSensitiveEntryFields } from '@/lib/compat/access'
import { slimSajuEntryForClient } from '@/lib/saju/slim-entry'
import { hydrateWeekSeries } from '@/lib/saju/hydrate-week-series'
import { compatShareStorageKey } from '@/lib/compat/storage'
import { compatStorageKey, isRelationshipType } from '@/lib/compat/relationship'
import type { CompatShareSnapshot } from '@/lib/compat/types'

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

async function findEntry(id: string, req: NextRequest) {
  const user = await getUserFromSession().catch(() => null)
  const guestId = getGuestId(req)
  const contextEntryId = req.nextUrl.searchParams.get('contextEntryId')
  const allowed = await canReadSajuEntry(user?.id ?? null, guestId, id, contextEntryId)
  if (!allowed) return null
  return prisma.sajuEntry.findUnique({ where: { id } })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await findEntry(id, request)
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const user = await getUserFromSession().catch(() => null)
    const guestId = getGuestId(request)
    const isOwner = !!(user && entry.userId === user.id) || !!(guestId && entry.guestId === guestId)
    // 차트 UI용으로 페이로드를 줄여 첫 페인트 지연을 줄인다 (풀 데이터는 DB에 유지).
    const payload = slimSajuEntryForClient(
      stripSensitiveEntryFields(entry as Record<string, unknown>, isOwner),
      isOwner,
    )
    // 이번 주 일운 — 응답에 붙여 ChartTab이 /api/saju/daily 재호출 없이 바로 그리게 함
    try {
      payload.weekSeries = await hydrateWeekSeries(entry)
    } catch (e) {
      console.error('weekSeries hydrate failed:', e)
      payload.weekSeries = null
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('GET /api/saju/[id] error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await findEntry(id, request)
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const body = await request.json()

    // 대표 사주 설정: 같은 소유자(회원/게스트)의 다른 사주는 모두 해제하고 이 사주만 대표로.
    if (body.setRepresentative === true) {
      const ownerWhere = entry.userId
        ? { userId: entry.userId }
        : entry.guestId
          ? { guestId: entry.guestId }
          : null
      await prisma.$transaction([
        ...(ownerWhere
          ? [prisma.sajuEntry.updateMany({ where: ownerWhere, data: { isRepresentative: false } })]
          : []),
        prisma.sajuEntry.update({ where: { id }, data: { isRepresentative: true } }),
      ])
      return NextResponse.json({ ok: true, id, isRepresentative: true })
    }

    // 대표 사주 해제: 이 사주의 대표 플래그만 끈다 (목록은 생성순 폴백).
    if (body.setRepresentative === false) {
      await prisma.sajuEntry.update({ where: { id }, data: { isRepresentative: false } })
      return NextResponse.json({ ok: true, id, isRepresentative: false })
    }

    // 공유 공개/비공개 토글: 소유자가 공유하기를 누르면 isShared=true 로 올려
    // 비로그인 수신자도 /share/[id] 로 볼 수 있게 한다.
    if (body.share === true || body.share === false) {
      const updated = await prisma.sajuEntry.update({
        where: { id },
        data: { isShared: body.share },
      })
      return NextResponse.json({ ok: true, id, isShared: updated.isShared })
    }

    if (body.compatShare && typeof body.compatShare === 'object') {
      const cs = body.compatShare as Record<string, unknown>
      const partnerId = typeof cs.partnerId === 'string' ? cs.partnerId : ''
      const relationship = typeof cs.relationship === 'string' && isRelationshipType(cs.relationship)
        ? cs.relationship
        : null
      const enabled = cs.enabled === true
      const snapshot = cs.snapshot as CompatShareSnapshot | undefined
      if (!partnerId || !relationship || !snapshot) {
        return NextResponse.json({ error: 'compatShare 필드가 올바르지 않습니다.' }, { status: 400 })
      }
      const existingFortune = (entry.fortuneJson && typeof entry.fortuneJson === 'object')
        ? entry.fortuneJson as Record<string, unknown>
        : {}
      const shareKey = compatShareStorageKey(partnerId, relationship)
      const merged = {
        ...existingFortune,
        [shareKey]: enabled ? { ...snapshot, enabled: true, sharedAt: new Date().toISOString() } : { enabled: false },
      }
      await prisma.sajuEntry.update({
        where: { id },
        data: { fortuneJson: merged as object, isShared: enabled ? true : entry.isShared },
      })
      return NextResponse.json({ ok: true, shareKey, enabled })
    }

    if (body.deleteCompat && typeof body.deleteCompat === 'object') {
      const dc = body.deleteCompat as Record<string, unknown>
      const partnerId = typeof dc.partnerId === 'string' ? dc.partnerId : ''
      const relationship = typeof dc.relationship === 'string' && isRelationshipType(dc.relationship)
        ? dc.relationship
        : null
      if (!partnerId || !relationship) {
        return NextResponse.json({ error: 'deleteCompat 필드가 올바르지 않습니다.' }, { status: 400 })
      }
      const existingFortune = (entry.fortuneJson && typeof entry.fortuneJson === 'object')
        ? { ...(entry.fortuneJson as Record<string, unknown>) }
        : {}
      const compatKey = compatStorageKey(partnerId, relationship)
      const legacyKey = `compat_${partnerId}`
      const shareKey = compatShareStorageKey(partnerId, relationship)
      delete existingFortune[compatKey]
      delete existingFortune[shareKey]
      if (relationship === 'romance') delete existingFortune[legacyKey]
      await prisma.sajuEntry.update({
        where: { id },
        data: { fortuneJson: existingFortune as object },
      })
      return NextResponse.json({ ok: true, fortuneJson: existingFortune })
    }

    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.gender !== undefined) updates.gender = body.gender
    if (body.birthDate !== undefined) updates.birthDate = body.birthDate
    if (body.birthTime !== undefined) updates.birthTime = body.birthTime
    if (body.timeUnknown !== undefined) updates.timeUnknown = body.timeUnknown
    if (body.isLunar !== undefined) updates.isLunar = body.isLunar
    if (body.isLeapMonth !== undefined) updates.isLeapMonth = !!(body.isLunar ?? entry.isLunar) && body.isLeapMonth
    if (body.job !== undefined) updates.job = typeof body.job === 'string' ? body.job.trim().slice(0, 30) || null : null

    const birthChanged =
      (body.birthDate !== undefined && body.birthDate !== entry.birthDate) ||
      (body.birthTime !== undefined && body.birthTime !== entry.birthTime) ||
      (body.timeUnknown !== undefined && body.timeUnknown !== entry.timeUnknown) ||
      (body.isLunar !== undefined && body.isLunar !== entry.isLunar) ||
      (body.isLeapMonth !== undefined && body.isLeapMonth !== (entry as Record<string, unknown>).isLeapMonth) ||
      (body.gender !== undefined && body.gender !== entry.gender)

    if (birthChanged) {
      const newBirthDate = (body.birthDate ?? entry.birthDate) as string
      const newTimeUnknown = (body.timeUnknown ?? entry.timeUnknown) as boolean
      const newBirthTime = newTimeUnknown ? '12:00' : ((body.birthTime ?? entry.birthTime ?? '12:00') as string)
      const newGender = (body.gender ?? entry.gender) as string
      const newIsLunar = (body.isLunar ?? entry.isLunar) as boolean
      const newIsLeapMonth = newIsLunar ? !!(body.isLeapMonth ?? (entry as Record<string, unknown>).isLeapMonth) : false

      const baseInput = {
        birthDate: newBirthDate,
        birthTime: newBirthTime,
        timeUnknown: newTimeUnknown,
        gender: (newGender === 'female' ? 'female' : 'male') as 'male' | 'female',
        isLunar: newIsLunar,
        isLeapMonth: newIsLeapMonth,
      }

      let sajuReport = await buildSajuReportViaPython(baseInput)

      const llmYongshin = await resolveYongshin(sajuReport, {
        gender: baseInput.gender,
        isLunar: baseInput.isLunar,
      })
      if (llmYongshin) {
        const yongObj = (sajuReport['용신희신'] ?? sajuReport['용신']) as Record<string, unknown> | undefined
        const ruleYongshin = yongObj?.['용신_오행'] as string | undefined
        if (ruleYongshin !== llmYongshin.result.용신_오행) {
          sajuReport = await buildSajuReportViaPython({
            ...baseInput,
            yongshinOverride: llmYongshin.result,
          })
        }
      }

      updates.sajuReportJson = sajuReport as object
      updates.fortuneJson = null
      updates.fortuneJsonB = null

      try {
        const detail = (sajuReport as Record<string, unknown>)['오행십성_상세'] as { 천간?: Array<{ element?: string }> } | undefined
        updates.dayElement = detail?.천간?.[2]?.element ?? null
      } catch { /* ignore */ }
    }

    const updated = await prisma.sajuEntry.update({
      where: { id },
      data: updates,
    })

    // 출생정보가 바뀌면 일별 운세 점수 캐시는 더 이상 유효하지 않다.
    if (birthChanged) {
      await prisma.dailyFortune.deleteMany({ where: { entryId: id } })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/saju/[id] error:', error)
    const msg = error instanceof Error ? error.message : 'Failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const entry = await findEntry(id, request)
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await prisma.sajuEntry.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/saju/[id] error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
