import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ Next.js 15: params must be awaited
    const { id: sessionId } = await params

    const session = await prisma.analysisSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        sajuReportJson: true,
        geminiJson: true,
        inputRedacted: true,
        orders: {
          where: {
            status: 'APPROVED',
          },
          select: {
            id: true,
          },
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      hasSajuReport: !!session.sajuReportJson,
      hasGemini: !!session.geminiJson,
      isPaid: session.orders.length > 0,
      sajuReportJson: session.sajuReportJson ?? undefined,
      inputRedacted: session.inputRedacted ?? undefined,
    })
  } catch (error) {
    console.error('Session fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}
