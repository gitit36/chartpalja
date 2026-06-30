import { randomBytes } from 'crypto'

const INVITE_TTL_DAYS = 7

export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

export function inviteExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + INVITE_TTL_DAYS)
  return d
}

export function inviteJoinPath(token: string): string {
  return `/app/compat/join/${token}`
}
