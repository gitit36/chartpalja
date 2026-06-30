import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { generateInviteToken, inviteExpiresAt, inviteJoinPath } from '@/lib/compat/invite'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const entryId = typeof body.entryId === 'string' ? body.entryId : ''
    if (!entryId) {
      return NextResponse.json({ error: 'entryId가 필요합니다.' }, { status: 400 })
    }

    const entry = await prisma.sajuEntry.findUnique({ where: { id: entryId } })
    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const token = generateInviteToken()
    await prisma.compatInvite.create({
      data: {
        token,
        inviterUserId: user.id,
        inviterEntryId: entryId,
        status: 'pending',
        expiresAt: inviteExpiresAt(),
      },
    })

    const origin = request.nextUrl.origin
    const shareUrl = `${origin}${inviteJoinPath(token)}`

    return NextResponse.json({
      token,
      shareUrl,
      inviterName: entry.name,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    console.error('POST /api/compat/invite error:', error)
    return NextResponse.json({ error: '초대 링크 생성에 실패했습니다.' }, { status: 500 })
  }
}
