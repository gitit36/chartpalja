import { NextRequest, NextResponse } from 'next/server'

/**
 * 카카오 OAuth 인증 시작.
 *
 * - 쿼리스트링으로 `gid`(게스트 ID)와 `returnTo`(로그인 후 돌아갈 경로)를 받는다.
 * - 이 두 값은 base64 인코딩된 `state` 파라미터에 실어 카카오로 보내고,
 *   콜백에서 다시 꺼내어 게스트 → 사용자 마이그레이션과 리다이렉트 분기에 사용한다.
 * - CSRF 방지를 위해 nonce를 함께 발급해 httpOnly 쿠키로 저장 후 콜백에서 검증한다.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_CLIENT_ID
  const redirectUri = process.env.KAKAO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return new Response('Kakao OAuth not configured', { status: 500 })
  }

  const url = new URL(request.url)
  const gid = url.searchParams.get('gid')
  const returnTo = url.searchParams.get('returnTo')

  const nonce = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const statePayload = {
    g: gid && gid.startsWith('g_') ? gid : null,
    r: returnTo && returnTo.startsWith('/') ? returnTo : null,
    n: nonce,
  }
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url')

  const kakaoAuthUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&prompt=login` +
    `&state=${encodeURIComponent(state)}`

  const response = NextResponse.redirect(kakaoAuthUrl)
  response.cookies.set('kakao_oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
