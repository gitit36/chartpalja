/**
 * 리스트 → 상세 전환 시 차트 진입 체감 속도용 sessionStorage 캐시.
 * 전체 sajuReportJson 을 담으므로 실패해도 무시하고 네트워크로 폴백한다.
 */

const PREFIX = 'saju:entry:v4:'

export function readCachedSajuEntry<T = unknown>(id: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeCachedSajuEntry(id: string, entry: unknown): void {
  if (typeof window === 'undefined' || !entry) return
  try {
    sessionStorage.setItem(PREFIX + id, JSON.stringify(entry))
  } catch {
    // quota / private mode — ignore
  }
}

/** fire-and-forget prefetch (호버/포커스) */
export function prefetchSajuEntry(id: string, headers: Record<string, string> = {}): void {
  if (typeof window === 'undefined' || !id) return
  if (readCachedSajuEntry(id)) return
  fetch(`/api/saju/${id}`, { headers, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d?.id) writeCachedSajuEntry(id, d)
    })
    .catch(() => {})
}
