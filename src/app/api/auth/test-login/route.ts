import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { setUserSession } from '@/lib/auth/session'

export const runtime = 'nodejs'

/**
 * 결제대행사(PG) 심사용 테스트 로그인.
 *
 * - 카카오 로그인 없이 ID/PW 만으로 심사 담당자가 로그인할 수 있게 한다.
 * - 비실물 상품 특성상 심사 담당자가 실제 결제 없이 서비스/결제창을 확인할 수 있도록,
 *   이 계정에는 운세 해설(chart)·구간 해설(period) 이용권을 각각 30개 보장한다.
 * - 기본 활성화. 운영에서 끄려면 환경변수 TEST_LOGIN_ENABLED=0 으로 설정한다.
 * - 자격증명은 환경변수(TEST_LOGIN_ID / TEST_LOGIN_PASSWORD)로 덮어쓸 수 있다.
 */

const TEST_KAKAO_ID = 'test_reviewer_account'
const TEST_NICKNAME = '심사용 테스트 계정'
const TEST_EMAIL = 'review@chartpalja.com'
const GRANT_EACH = 30

const DEFAULT_ID = 'testid00!'
const DEFAULT_PW = 'testpw00!'

function isEnabled(): boolean {
  return process.env.TEST_LOGIN_ENABLED !== '0'
}

export async function POST(request: Request) {
  if (!isEnabled()) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let body: { id?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  const expectedId = process.env.TEST_LOGIN_ID || DEFAULT_ID
  const expectedPw = process.env.TEST_LOGIN_PASSWORD || DEFAULT_PW

  if (id !== expectedId || password !== expectedPw) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  // 시드 테스트 유저 보장
  const user = await prisma.user.upsert({
    where: { kakaoId: TEST_KAKAO_ID },
    update: { updatedAt: new Date() },
    create: { kakaoId: TEST_KAKAO_ID, email: TEST_EMAIL, nickname: TEST_NICKNAME },
  })

  // 이용권 30/30 보장 (chartCredits=운세 해설, periodCredits=구간 해설)
  const balance = await prisma.userBalance.findUnique({ where: { userId: user.id } })
  if (!balance) {
    await prisma.$transaction([
      prisma.userBalance.create({
        data: { userId: user.id, chartCredits: GRANT_EACH, periodCredits: GRANT_EACH },
      }),
      prisma.entitlementLedger.createMany({
        data: [
          { userId: user.id, creditType: 'chart', delta: GRANT_EACH, reason: 'test_grant' },
          { userId: user.id, creditType: 'period', delta: GRANT_EACH, reason: 'test_grant' },
        ],
      }),
    ])
  } else if (balance.chartCredits < GRANT_EACH || balance.periodCredits < GRANT_EACH) {
    await prisma.userBalance.update({
      where: { userId: user.id },
      data: {
        chartCredits: Math.max(balance.chartCredits, GRANT_EACH),
        periodCredits: Math.max(balance.periodCredits, GRANT_EACH),
      },
    })
  }

  await setUserSession({
    id: user.id,
    kakaoId: user.kakaoId,
    email: user.email,
    nickname: user.nickname,
  })

  return NextResponse.json({ ok: true })
}
