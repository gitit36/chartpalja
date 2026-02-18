import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { setUserSession } from '@/lib/auth/session'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

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

  try {
    // Exchange code for access token
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

    // Fetch user profile
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

    // Upsert user
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

    // Set session
    await setUserSession({
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email,
      nickname: user.nickname,
    })

    redirect('/app/input?success=logged_in')
  } catch (error) {
    console.error('Kakao OAuth error:', error)
    redirect('/app/input?error=oauth_error')
  }
}
