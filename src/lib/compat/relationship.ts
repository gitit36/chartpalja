import type { CompatReportEntry, RelationshipType } from './types'

export const RELATIONSHIP_TYPES = ['friend', 'romance', 'business', 'family'] as const

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  romance: '연애',
  friend: '친구',
  business: '비즈니스',
  family: '가족',
}

export function isRelationshipType(v: string): v is RelationshipType {
  return (RELATIONSHIP_TYPES as readonly string[]).includes(v)
}

export function compatStorageKey(partnerId: string, relationship: RelationshipType): string {
  return `compat_${partnerId}_${relationship}`
}

export function compatCardKey(partnerId: string, relationship: RelationshipType): string {
  return `${partnerId}|${relationship}`
}

export function parseCompatCardKey(key: string): { partnerId: string; relationship: RelationshipType } | null {
  const idx = key.indexOf('|')
  if (idx < 0) return null
  const partnerId = key.slice(0, idx)
  const rel = key.slice(idx + 1)
  if (!partnerId || !isRelationshipType(rel)) return null
  return { partnerId, relationship: rel }
}

/** compat_{partnerId}_{rel} 또는 레거시 compat_{partnerId} 파싱 */
export function parseCompatStorageKey(key: string): { partnerId: string; relationship: RelationshipType } | null {
  if (!key.startsWith('compat_')) return null
  const rest = key.slice('compat_'.length)
  const lastUnderscore = rest.lastIndexOf('_')
  if (lastUnderscore > 0) {
    const maybeRel = rest.slice(lastUnderscore + 1)
    if (isRelationshipType(maybeRel)) {
      return { partnerId: rest.slice(0, lastUnderscore), relationship: maybeRel }
    }
  }
  return { partnerId: rest, relationship: 'romance' }
}

export function inferDefaultRelationship(myGender: string, partnerGender: string): RelationshipType {
  if (myGender === partnerGender) return 'friend'
  return 'romance'
}

export function normalizeCompatEntry(
  entry: CompatReportEntry,
  partnerId: string,
  relationship: RelationshipType,
): CompatReportEntry {
  return {
    ...entry,
    partnerId,
    relationship: entry.relationship ?? relationship,
  }
}
