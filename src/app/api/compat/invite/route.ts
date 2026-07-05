import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { generateInviteToken, inviteExpiresAt, inviteJoinPath } from '@/lib/compat/invite'

/**
 * 공유용 공개 origin 을 구한다.
 * 배포 환경에서 프록시 뒤에 있으면 request.nextUrl.origin 이 내부 localhost 로
 * 잡혀 초대 링크가 localhost 로 복사되는 문제가 있어, 실제 공개 도메인을 우선한다.
 *  1) x-forwarded-host (프록시가 넘겨준 실제 호스트)
 *  2) NEXT_PUBLIC_SITE_URL (설정된 공개 도메인, 기본 chartpalja.com)
 *  3) request.nextUrl.origin (로컬 개발 폴백)
 */
function resolvePublicOrigin(request: NextRequest): string {
  if (process.env.NODE_ENV !== 'production') return request.nextUrl.origin

  const fwdHost = request.headers.get('x-forwarded-host')
  if (fwdHost && !/^(localhost|127\.|0\.0\.0\.0)/.test(fwdHost)) {
    const fwdProto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${fwdProto}://${fwdHost}`
  }
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/+$/, '')

  const origin = request.nextUrl.origin
  if (!/^https?:\/\/(localhost|127\.|0\.0\.0\.0)/.test(origin)) return origin
  return 'https://www.chartpalja.com'
}

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

    const origin = resolvePublicOrigin(request)
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
