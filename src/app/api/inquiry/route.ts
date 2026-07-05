import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession } from '@/lib/auth/session'
import { sendAlertEmail } from '@/lib/notifications/email'

const CATEGORY_LABELS: Record<string, string> = {
  general: '일반 문의',
  payment: '결제/환불',
  bug: '오류 신고',
  account: '계정',
  etc: '기타',
}

const MESSAGE_MAX = 2000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      category?: string
      message?: string
      email?: string
      page?: string
    }

    const message = (body.message ?? '').trim()
    if (!message) {
      return NextResponse.json({ error: '문의 내용을 입력해 주세요.' }, { status: 400 })
    }
    if (message.length > MESSAGE_MAX) {
      return NextResponse.json({ error: `문의 내용은 ${MESSAGE_MAX}자 이내로 입력해 주세요.` }, { status: 400 })
    }

    const category = body.category && CATEGORY_LABELS[body.category] ? body.category : 'general'
    const email = (body.email ?? '').trim().slice(0, 200) || null
    const page = (body.page ?? '').trim().slice(0, 300) || null

    const user = await getUserFromSession()
    const guestId = request.headers.get('x-guest-id')
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

    // 스팸 방지: 동일 사용자/게스트 최근 10분 내 5건 초과 시 차단.
    const scope = user
      ? { userId: user.id }
      : guestId
        ? { guestId }
        : null
    if (scope) {
      const recent = await prisma.inquiry.count({
        where: { ...scope, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
      })
      if (recent >= 5) {
        return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 })
      }
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: user?.id ?? null,
        guestId: guestId ?? null,
        email: email ?? user?.email ?? null,
        category,
        message,
        page,
        userAgent,
      },
    })

    // 운영자 이메일 알림 (SMTP 미설정 시 조용히 무시됨).
    void sendAlertEmail({
      subject: `[차트팔자 문의] ${CATEGORY_LABELS[category]}`,
      heading: `새 문의 · ${CATEGORY_LABELS[category]}`,
      level: 'info',
      message: message.length > 500 ? message.slice(0, 500) + '…' : message,
      fields: [
        { label: '분류', value: CATEGORY_LABELS[category] },
        { label: '회신 이메일', value: email ?? user?.email ?? '(없음)' },
        { label: '사용자', value: user ? `${user.nickname ?? '회원'} (${user.id})` : guestId ? `게스트 (${guestId})` : '(익명)' },
        { label: '경로', value: page ?? '(없음)' },
        { label: '문의 ID', value: inquiry.id },
      ],
    }).catch(() => {})

    return NextResponse.json({ ok: true, id: inquiry.id })
  } catch (err) {
    console.error('[inquiry] failed:', err)
    return NextResponse.json({ error: '문의 접수 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
