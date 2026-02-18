import { getIronSession, IronSessionData } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'

export interface SessionUser {
  id: string
  kakaoId: string
  email?: string | null
  nickname?: string | null
}

declare module 'iron-session' {
  interface IronSessionData {
    user?: SessionUser
  }
}

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET || 'change-me-in-production-min-32-chars',
  cookieName: 'saju-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax' as const,
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<IronSessionData>(cookieStore, SESSION_OPTIONS)
}

export async function getUserFromSession(): Promise<SessionUser | null> {
  const session = await getSession()
  return session.user || null
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUserFromSession()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function setUserSession(user: SessionUser) {
  const session = await getSession()
  session.user = user
  await session.save()
}

export async function clearSession() {
  const session = await getSession()
  session.destroy()
}
