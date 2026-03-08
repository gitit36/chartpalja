import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { buildSajuReportViaPython } from '@/lib/saju/saju-report'

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

    const raw = await prisma.sajuEntry.findMany({
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
        sajuReportJson: true,
      },
    })

    const entries = raw.map(e => {
      let dayElement: string | null = null
      try {
        const rpt = e.sajuReportJson as Record<string, unknown> | null
        const detail = rpt?.['오행십성_상세'] as { 천간?: Array<{ element?: string }> } | undefined
        dayElement = detail?.천간?.[2]?.element ?? null
      } catch { /* ignore */ }
      const { sajuReportJson: _rpt, ...rest } = e
      return { ...rest, dayElement }
    })

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

    const { name, gender, birthDate, birthTime, timeUnknown, isLunar, isLeapMonth } = body
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
    const sajuReport = await buildSajuReportViaPython({
      birthDate,
      birthTime: birthTimeStr,
      timeUnknown: !!timeUnknown,
      gender: gender === 'female' ? 'female' : 'male',
      isLunar: !!isLunar,
      isLeapMonth: !!isLeapMonth,
    })

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
