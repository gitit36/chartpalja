import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { buildSajuReportViaPython } from '@/lib/saju/saju-report'
import { resolveYongshin, extractFourPillarKey } from '@/lib/ai/yongshin-llm'

function getGuestId(req: NextRequest): string | null {
  return req.headers.get('x-guest-id') || null
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession().catch(() => null)
    const guestId = getGuestId(request)

    if (!user && !guestId) {
      return NextResponse.json({ entries: [] })
    }

    const where = user
      ? { userId: user.id }
      : { guestId: guestId! }

    const entries = await prisma.sajuEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        gender: true,
        birthDate: true,
        birthTime: true,
        timeUnknown: true,
        isLunar: true,
        isLeapMonth: true,
        createdAt: true,
        dayElement: true,
      },
    })

    const needBackfill = entries.filter(e => !e.dayElement)
    if (needBackfill.length > 0) {
      const rows = await prisma.sajuEntry.findMany({
        where: { id: { in: needBackfill.map(e => e.id) } },
        select: { id: true, sajuReportJson: true },
      })
      for (const r of rows) {
        try {
          const rpt = r.sajuReportJson as Record<string, unknown> | null
          const detail = rpt?.['오행십성_상세'] as { 천간?: Array<{ element?: string }> } | undefined
          const elem = detail?.천간?.[2]?.element ?? null
          if (elem) {
            await prisma.sajuEntry.update({ where: { id: r.id }, data: { dayElement: elem } })
            const entry = entries.find(e => e.id === r.id)
            if (entry) entry.dayElement = elem
          }
        } catch { /* ignore */ }
      }
    }

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('GET /api/saju error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession().catch(() => null)
    const guestId = getGuestId(request)
    const body = await request.json()

    const { name, gender, birthDate, birthTime, timeUnknown, isLunar, isLeapMonth, job } = body
    if (!name || !birthDate) {
      return NextResponse.json({ error: 'name and birthDate required' }, { status: 400 })
    }

    const ownerWhere = user ? { userId: user.id } : { guestId: guestId! }
    const existing = await prisma.sajuEntry.findFirst({
      where: {
        ...ownerWhere,
        birthDate,
        gender: gender === 'female' ? 'female' : 'male',
        ...(timeUnknown
          ? { timeUnknown: true }
          : { birthTime: birthTime || null, timeUnknown: false }),
      },
      select: { id: true, name: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate', message: `이미 동일한 사주 정보가 등록되어 있습니다 (${existing.name})`, existingId: existing.id },
        { status: 409 }
      )
    }

    const birthTimeStr = timeUnknown ? '12:00' : (birthTime || '12:00')
    const baseInput = {
      birthDate,
      birthTime: birthTimeStr,
      timeUnknown: !!timeUnknown,
      gender: (gender === 'female' ? 'female' : 'male') as 'male' | 'female',
      isLunar: !!isLunar,
      isLeapMonth: !!isLeapMonth,
    }

    // Phase 1: 룰 베이스 결과 (용신 판별 포함)
    let sajuReport = await buildSajuReportViaPython(baseInput)

    // Phase 2: LLM 용신 판별 (캐시 우선)
    const llmYongshin = await resolveYongshin(sajuReport, {
      gender: baseInput.gender,
      isLunar: baseInput.isLunar,
    })
    if (llmYongshin) {
      const yongObj = (sajuReport['용신희신'] ?? sajuReport['용신']) as Record<string, unknown> | undefined
      const ruleYongshin = yongObj?.['용신_오행'] as string | undefined
      if (ruleYongshin !== llmYongshin.result.용신_오행) {
        console.log(`[saju] 용신 override: ${ruleYongshin} → ${llmYongshin.result.용신_오행} (${llmYongshin.source})`)
        sajuReport = await buildSajuReportViaPython({
          ...baseInput,
          yongshinOverride: llmYongshin.result,
        })
      } else {
        console.log(`[saju] 용신 일치 (${ruleYongshin}), override 불필요`)
      }
    }

    let dayElement: string | null = null
    try {
      const detail = (sajuReport as Record<string, unknown>)['오행십성_상세'] as { 천간?: Array<{ element?: string }> } | undefined
      dayElement = detail?.천간?.[2]?.element ?? null
    } catch { /* ignore */ }

    const entry = await prisma.sajuEntry.create({
      data: {
        userId: user?.id ?? null,
        guestId: user ? null : (guestId ?? null),
        name,
        gender: gender === 'female' ? 'female' : 'male',
        birthDate,
        birthTime: timeUnknown ? null : (birthTime || null),
        timeUnknown: !!timeUnknown,
        isLunar: !!isLunar,
        isLeapMonth: !!(isLunar && isLeapMonth),
        job: typeof job === 'string' ? job.trim().slice(0, 30) || null : null,
        dayElement,
        sajuReportJson: sajuReport as object,
      },
    })

    return NextResponse.json({ id: entry.id })
  } catch (error) {
    console.error('POST /api/saju error:', error)
    const msg = error instanceof Error ? error.message : 'Failed'
    if (msg.includes('Python')) {
      return NextResponse.json({ error: msg }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to create saju entry' }, { status: 500 })
  }
}
