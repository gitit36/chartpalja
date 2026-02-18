import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { input } = body

    if (!input || typeof input !== 'object') {
      return NextResponse.json(
        { error: 'Invalid input' },
        { status: 400 }
      )
    }

    // Get user from session (optional for guest)
    const user = await getUserFromSession()

    // Create session
    const session = await prisma.analysisSession.create({
      data: {
        userId: user?.id,
        status: 'DRAFT',
        inputRedacted: input,
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
