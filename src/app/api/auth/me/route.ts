import { NextResponse } from 'next/server'
import { getUserFromSession } from '@/lib/auth/session'

export async function GET() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 })
  }
  return NextResponse.json({
    user: {
      id: user.id,
      kakaoId: user.kakaoId,
      email: user.email ?? null,
      nickname: user.nickname ?? null,
    },
  })
}
