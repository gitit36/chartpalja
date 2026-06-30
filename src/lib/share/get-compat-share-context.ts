import { prisma } from '@/lib/db/prisma'
import { getCompatShareSnapshot } from '@/lib/compat/storage'
import { parseRelationshipParam } from '@/lib/compat/access'
import type { CompatShareSnapshot, RelationshipType } from '@/lib/compat/types'
import type { PublicShareEntry } from './get-share-entry'
import { getPublicShareEntry } from './get-share-entry'

export interface CompatShareContext {
  entry: PublicShareEntry
  partner: PublicShareEntry
  relationship: RelationshipType
  snapshot: CompatShareSnapshot
}

/**
 * 공개 궁합 공유 페이지/OG용 컨텍스트.
 * entry.isShared && compatShare_{partnerId}_{rel}.enabled 일 때만 반환.
 */
export async function getCompatShareContext(
  entryId: string,
  partnerId: string,
  relationshipParam: string | null,
): Promise<CompatShareContext | null> {
  const relationship = parseRelationshipParam(relationshipParam)
  if (!relationship) return null

  const entry = await getPublicShareEntry(entryId)
  if (!entry?.fortuneJson) return null

  const snapshot = getCompatShareSnapshot(entry.fortuneJson, partnerId, relationship)
  if (!snapshot) return null

  const partnerRow = await prisma.sajuEntry.findUnique({ where: { id: partnerId } }).catch(() => null)
  if (!partnerRow?.sajuReportJson) return null

  const partnerBirthYear = parseInt(String(partnerRow.birthDate).slice(0, 4), 10)

  const partner: PublicShareEntry = {
    id: partnerRow.id,
    name: partnerRow.name,
    gender: partnerRow.gender,
    birthYear: Number.isFinite(partnerBirthYear) ? partnerBirthYear : new Date().getFullYear(),
    dayElement: partnerRow.dayElement ?? null,
    sajuReportJson: partnerRow.sajuReportJson as PublicShareEntry['sajuReportJson'],
    fortuneJson: null,
  }

  return { entry, partner, relationship, snapshot }
}
