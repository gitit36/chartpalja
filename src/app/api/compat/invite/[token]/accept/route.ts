import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const { token } = await params
    const body = await request.json().catch(() => ({}))
    const inviteeEntryId = typeof body.inviteeEntryId === 'string' ? body.inviteeEntryId : ''
    if (!inviteeEntryId) {
      return NextResponse.json({ error: 'inviteeEntryId가 필요합니다.' }, { status: 400 })
    }

    const invite = await prisma.compatInvite.findUnique({ where: { token } })
    if (!invite) {
      return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (invite.status === 'completed') {
      return NextResponse.json({ ok: true, alreadyCompleted: true })
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: '만료된 초대 링크입니다.' }, { status: 410 })
    }
    if (invite.inviterUserId === user.id) {
      return NextResponse.json({ error: '본인 초대는 수락할 수 없습니다.' }, { status: 400 })
    }

    const inviteeEntry = await prisma.sajuEntry.findUnique({ where: { id: inviteeEntryId } })
    if (!inviteeEntry || inviteeEntry.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const inviterEntry = await prisma.sajuEntry.findUnique({ where: { id: invite.inviterEntryId } })
    if (!inviterEntry?.userId) {
      return NextResponse.json({ error: '초대자 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.compatInvite.update({
        where: { id: invite.id },
        data: {
          status: 'completed',
          inviteeUserId: user.id,
          inviteeEntryId,
        },
      }),
      prisma.compatLink.upsert({
        where: {
          userId_entryId_peerEntryId: {
            userId: invite.inviterUserId,
            entryId: invite.inviterEntryId,
            peerEntryId: inviteeEntryId,
          },
        },
        create: {
          userId: invite.inviterUserId,
          entryId: invite.inviterEntryId,
          peerUserId: user.id,
          peerEntryId: inviteeEntryId,
          source: 'invite',
        },
        update: {},
      }),
      prisma.compatLink.upsert({
        where: {
          userId_entryId_peerEntryId: {
            userId: user.id,
            entryId: inviteeEntryId,
            peerEntryId: invite.inviterEntryId,
          },
        },
        create: {
          userId: user.id,
          entryId: inviteeEntryId,
          peerUserId: invite.inviterUserId,
          peerEntryId: invite.inviterEntryId,
          source: 'invite',
        },
        update: {},
      }),
    ])

    return NextResponse.json({
      ok: true,
      inviterEntryId: invite.inviterEntryId,
      redirectUrl: `/app/saju/${inviteeEntryId}?overlay=${invite.inviterEntryId}`,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    console.error('POST /api/compat/invite/[token]/accept error:', error)
    return NextResponse.json({ error: '초대 수락에 실패했습니다.' }, { status: 500 })
  }
}
