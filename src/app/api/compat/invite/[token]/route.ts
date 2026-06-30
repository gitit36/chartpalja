import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

function calcAge(birthDate: string): number | null {
  const y = parseInt(birthDate.slice(0, 4), 10)
  if (!Number.isFinite(y)) return null
  return new Date().getFullYear() - y + 1
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const invite = await prisma.compatInvite.findUnique({ where: { token } })
    if (!invite) {
      return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (invite.status === 'completed') {
      return NextResponse.json({ error: '이미 완료된 초대입니다.', status: 'completed' }, { status: 410 })
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: '만료된 초대 링크입니다.', status: 'expired' }, { status: 410 })
    }

    const inviterEntry = await prisma.sajuEntry.findUnique({
      where: { id: invite.inviterEntryId },
      select: { name: true, birthDate: true, gender: true },
    })
    if (!inviterEntry) {
      return NextResponse.json({ error: '초대를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      token,
      status: invite.status,
      inviterName: inviterEntry.name,
      inviterAge: calcAge(inviterEntry.birthDate),
      inviterGender: inviterEntry.gender,
      expiresAt: invite.expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('GET /api/compat/invite/[token] error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
