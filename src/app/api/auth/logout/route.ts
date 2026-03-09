import { NextResponse } from 'next/server'
import { clearSession } from '@/lib/auth/session'

export async function POST() {
  try {
    await clearSession()
    const res = NextResponse.json({ ok: true })
    res.cookies.set('saju-session', '', {
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
