import { redirect } from 'next/navigation'

export async function GET() {
  const clientId = process.env.KAKAO_CLIENT_ID
  const redirectUri = process.env.KAKAO_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return new Response('Kakao OAuth not configured', { status: 500 })
  }

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&prompt=login`

  redirect(kakaoAuthUrl)
}
