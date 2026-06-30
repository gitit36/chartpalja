import { prisma } from '@/lib/db/prisma'
import { isRelationshipType } from './relationship'
import type { RelationshipType } from './types'

/** 상대 엔트리 읽기 권한: 동일 유저 소유 또는 CompatLink */
export async function canAccessPartnerEntry(
  userId: string,
  myEntryId: string,
  partnerEntryId: string,
): Promise<boolean> {
  const partner = await prisma.sajuEntry.findUnique({
    where: { id: partnerEntryId },
    select: { userId: true },
  })
  if (!partner) return false
  if (partner.userId === userId) return true

  const link = await prisma.compatLink.findFirst({
    where: {
      userId,
      entryId: myEntryId,
      peerEntryId: partnerEntryId,
    },
  })
  return !!link
}

/** 엔트리 상세 조회 권한 (오버레이 fetch 포함) */
export async function canReadSajuEntry(
  userId: string | null,
  guestId: string | null,
  entryId: string,
  contextEntryId?: string | null,
): Promise<boolean> {
  const entry = await prisma.sajuEntry.findUnique({
    where: { id: entryId },
    select: { userId: true, guestId: true, isShared: true },
  })
  if (!entry) return false
  if (userId && entry.userId === userId) return true
  if (guestId && entry.guestId === guestId) return true
  if (!entry.userId && !entry.guestId) return true
  if (entry.isShared) return true
  if (userId && contextEntryId) {
    return canAccessPartnerEntry(userId, contextEntryId, entryId)
  }
  return false
}

export function parseRelationshipParam(value: string | null): RelationshipType | null {
  if (!value || !isRelationshipType(value)) return null
  return value
}

export function stripSensitiveEntryFields<T extends Record<string, unknown>>(entry: T, isOwner: boolean): T {
  if (isOwner) return entry
  const { fortuneJson, fortuneJsonB, ...rest } = entry
  return rest as T
}
