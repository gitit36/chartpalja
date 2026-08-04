import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { getUserFromSession, type SessionUser } from '@/lib/auth/session'

export class AdminAuthError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'AdminAuthError'
    this.status = status
  }
}

function adminEmailAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** DB role 또는 ADMIN_EMAILS 허용 목록으로 관리자 여부 판정. */
export function isAdminUser(user: { role: UserRole; email?: string | null }): boolean {
  if (user.role === UserRole.ADMIN) return true
  const email = user.email?.trim().toLowerCase()
  if (email && adminEmailAllowlist().has(email)) return true
  return false
}

export type AdminUser = SessionUser & { role: UserRole }

/**
 * 관리자 세션 강제. 세션만 믿지 않고 매 요청 DB role을 재확인한다.
 * ADMIN_EMAILS에 있고 role이 USER면 최초 1회 ADMIN으로 승격(부트스트랩).
 */
export async function requireAdmin(): Promise<AdminUser> {
  const sessionUser = await getUserFromSession()
  if (!sessionUser) {
    throw new AdminAuthError('Unauthorized', 401)
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, kakaoId: true, email: true, nickname: true, role: true },
  })
  if (!dbUser) {
    throw new AdminAuthError('Unauthorized', 401)
  }

  if (!isAdminUser(dbUser)) {
    throw new AdminAuthError('Forbidden', 403)
  }

  // 허용 이메일로 들어온 경우 role을 영구 승격해 이후 판정을 단순화.
  if (dbUser.role !== UserRole.ADMIN) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: UserRole.ADMIN },
    })
  }

  return {
    id: dbUser.id,
    kakaoId: dbUser.kakaoId,
    email: dbUser.email,
    nickname: dbUser.nickname,
    role: UserRole.ADMIN,
  }
}

export async function getAdminOrNull(): Promise<AdminUser | null> {
  try {
    return await requireAdmin()
  } catch {
    return null
  }
}
