import type { CompatReportEntry, CompatShareSnapshot, RelationshipType } from './types'
import { compatStorageKey, normalizeCompatEntry, parseCompatStorageKey } from './relationship'

const COMPAT_PREFIX = 'compat_'
const SHARE_PREFIX = 'compatShare_'

export function listCompatEntries(fortuneJson: unknown): Array<{ key: string; entry: CompatReportEntry }> {
  if (!fortuneJson || typeof fortuneJson !== 'object') return []
  const obj = fortuneJson as Record<string, unknown>
  const items: Array<{ key: string; entry: CompatReportEntry }> = []
  for (const [key, v] of Object.entries(obj)) {
    if (!key.startsWith(COMPAT_PREFIX) || key.startsWith(SHARE_PREFIX) || !v || typeof v !== 'object') continue
    const parsed = parseCompatStorageKey(key)
    if (!parsed) continue
    items.push({
      key,
      entry: normalizeCompatEntry(v as CompatReportEntry, parsed.partnerId, parsed.relationship),
    })
  }
  return items.sort((a, b) => {
    const ta = a.entry.createdAt || ''
    const tb = b.entry.createdAt || ''
    return tb.localeCompare(ta)
  })
}

export function getGeneratedRelationships(fortuneJson: unknown, partnerId: string): RelationshipType[] {
  return listCompatEntries(fortuneJson)
    .filter(c => c.entry.partnerId === partnerId && !!c.entry.text)
    .map(c => c.entry.relationship)
}

export function hasCompatForRelationship(
  fortuneJson: unknown,
  partnerId: string,
  relationship: RelationshipType,
): boolean {
  if (!fortuneJson || typeof fortuneJson !== 'object') return false
  const obj = fortuneJson as Record<string, unknown>
  const key = compatStorageKey(partnerId, relationship)
  const legacyKey = `${COMPAT_PREFIX}${partnerId}`
  const entry = (obj[key] ?? obj[legacyKey]) as CompatReportEntry | undefined
  return !!entry?.text
}

export function compatShareStorageKey(partnerId: string, relationship: RelationshipType): string {
  return `${SHARE_PREFIX}${partnerId}_${relationship}`
}

export function getCompatShareSnapshot(
  fortuneJson: unknown,
  partnerId: string,
  relationship: RelationshipType,
): CompatShareSnapshot | null {
  if (!fortuneJson || typeof fortuneJson !== 'object') return null
  const raw = (fortuneJson as Record<string, unknown>)[compatShareStorageKey(partnerId, relationship)]
  if (!raw || typeof raw !== 'object') return null
  const snap = raw as CompatShareSnapshot
  return snap.enabled ? snap : null
}
