import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import { setUserSession } from '@/lib/auth/session'

interface OAuthState {
  g: string | null
  r: string | null
  n: string
}

function parseState(raw: string | null, nonceFromCookie: string | null): OAuthState | null {
  if (!raw) return null
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Partial<OAuthState>
    if (typeof decoded?.n !== 'string') return null
    // CSRF 방지: state.nonce가 시작 시점에 쿠키로 저장한 nonce와 일치해야 한다.
    if (!nonceFromCookie || decoded.n !== nonceFromCookie) return null
    return {
      g: typeof decoded.g === 'string' && decoded.g.startsWith('g_') ? decoded.g : null,
      r: typeof decoded.r === 'string' && decoded.r.startsWith('/') ? decoded.r : null,
      n: decoded.n,
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateRaw = searchParams.get('state')

  if (error) {
    redirect('/app/input?error=auth_failed')
  }

  if (!code) {
    redirect('/app/input?error=no_code')
  }

  const clientId = process.env.KAKAO_CLIENT_ID
  const clientSecret = process.env.KAKAO_CLIENT_SECRET
  const redirectUri = process.env.KAKAO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return new Response('Kakao OAuth not configured', { status: 500 })
  }

  // state.nonce 검증을 위한 쿠키 조회
  const cookieStore = await cookies()
  const nonceCookie = cookieStore.get('kakao_oauth_nonce')?.value ?? null
  const state = parseState(stateRaw, nonceCookie)
  const guestIdFromState = state?.g ?? null
  const returnTo = state?.r ?? null

  try {
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      redirect('/app/input?error=token_exchange_failed')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!profileResponse.ok) {
      redirect('/app/input?error=profile_fetch_failed')
    }

    const profile = await profileResponse.json()
    const kakaoId = String(profile.id)
    const email = profile.kakao_account?.email || null
    const nickname = profile.kakao_account?.profile?.nickname || null

    const user = await prisma.user.upsert({
      where: { kakaoId },
      update: {
        email,
        nickname,
        updatedAt: new Date(),
      },
      create: {
        kakaoId,
        email,
        nickname,
      },
    })

    // 게스트 → 사용자 마이그레이션:
    // state로 전달된 guest id로 만들어진 entry들을 현재 사용자에게 귀속시킨다.
    if (guestIdFromState) {
      try {
        await prisma.sajuEntry.updateMany({
          where: { guestId: guestIdFromState, userId: null },
          data: { userId: user.id, guestId: null },
        })
      } catch (e) {
        // 마이그레이션 실패는 로그인 자체를 막지 않는다.
        console.error('[kakao] guest entry migration failed:', e)
      }
    }

    await setUserSession({
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email,
      nickname: user.nickname,
    })

    // returnTo가 있으면 우선. 없으면 기존 로직(저장된 사주 유무)에 따라.
    let target: string
    if (returnTo) {
      target = returnTo
    } else {
      const entryCount = await prisma.sajuEntry.count({ where: { userId: user.id } })
      target = entryCount > 0 ? '/app/list' : '/app/input'
    }

    // 잠금 해제 토스트/연출을 위한 플래그.
    // 이미 쿼리가 있으면 &, 없으면 ?를 붙인다.
    const sep = target.includes('?') ? '&' : '?'
    target = `${target}${sep}welcome=1`

    // 사용한 nonce 쿠키는 정리
    cookieStore.delete('kakao_oauth_nonce')

    redirect(target)
  } catch (error) {
    const err = error as Error & { digest?: string }
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw error
    console.error('Kakao OAuth error:', error)
    redirect('/app/input?error=oauth_error')
  }
}
