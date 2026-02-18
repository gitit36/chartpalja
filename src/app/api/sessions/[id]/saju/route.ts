import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { buildSajuReportViaPython } from '@/lib/saju/saju-report'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params

    const session = await prisma.analysisSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      birthDate,
      birthTime,
      timeUnknown,
      gender,
      city,
      useSolarTime,
      earlyZiTime,
      utcOffset,
    } = body

    if (!birthDate || typeof birthDate !== 'string') {
      return NextResponse.json(
        { error: 'birthDate required' },
        { status: 400 }
      )
    }

    const [y, m, d] = birthDate.split('-').map(Number)
    if (!y || !m || !d) {
      return NextResponse.json(
        { error: 'Invalid birthDate format' },
        { status: 400 }
      )
    }

    let hour = 12
    let minute = 0
    if (!timeUnknown && birthTime && typeof birthTime === 'string') {
      const [h, min] = birthTime.split(':').map(Number)
      if (typeof h === 'number' && !Number.isNaN(h)) hour = h
      if (typeof min === 'number' && !Number.isNaN(min)) minute = min
    }

    const birthTimeStr =
      timeUnknown || !birthTime || typeof birthTime !== 'string'
        ? '12:00'
        : String(birthTime).includes(':')
          ? String(birthTime)
          : `${hour}:${String(minute).padStart(2, '0')}`
    const sajuReport = await buildSajuReportViaPython({
      birthDate: birthDate as string,
      birthTime: birthTimeStr,
      timeUnknown: !!timeUnknown,
      gender: gender === 'female' ? 'female' : 'male',
      city: city ?? 'Seoul',
      useSolarTime: useSolarTime ?? true,
      earlyZiTime: earlyZiTime ?? true,
      utcOffset: utcOffset ?? 9,
    })

    const inputRedacted = {
      birthYear: y,
      gender: gender ?? 'male',
      city: city ?? 'Seoul',
      useSolarTime: useSolarTime ?? true,
      earlyZiTime: earlyZiTime ?? true,
      utcOffset: utcOffset ?? 9,
      timeUnknown: timeUnknown ?? false,
    }

    await prisma.analysisSession.update({
      where: { id: sessionId },
      data: {
        status: 'SAJU_READY',
        sajuReportJson: sajuReport as object,
        inputRedacted: inputRedacted as object,
      },
    })

    return NextResponse.json({
      sessionId,
      status: 'SAJU_READY',
      sajuReport,
    })
  } catch (error) {
    console.error('[saju-api] Error:', error)
    const err = error instanceof Error ? error : new Error('Saju computation failed')
    const message = err.message
    if (message.includes('Python not available') || message.includes('ENOENT')) {
      return NextResponse.json(
        { error: 'Python is not installed or not on PATH. Install Python 3 and sajupy (pip install -r python_service/requirements.txt).' },
        { status: 503 }
      )
    }
    if (message.includes('Python Saju script')) {
      return NextResponse.json(
        { error: 'Saju computation failed. Check server logs.' },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { error: 'Saju computation failed' },
      { status: 500 }
    )
  }
}
