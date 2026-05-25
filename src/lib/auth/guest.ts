/**
 * 게스트(비로그인) 사용자 식별 헬퍼.
 *
 * - `saju_guest_id` localStorage 키를 사용한다.
 * - 게스트 ID는 처음 차트 입력/조회를 시도하는 시점에 생성된다.
 * - 모든 비로그인 API 호출은 `x-guest-id` 헤더로 게스트 ID를 전달한다.
 * - 로그인이 성공하면 `/api/auth/kakao/callback`에서 동일한 ID로 만들어진
 *   `SajuEntry`들이 사용자 계정으로 일괄 이전된다.
 */

export const GUEST_ID_KEY = 'saju_guest_id'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

/** 저장된 게스트 ID를 반환. 없으면 null. SSR/비-브라우저 환경에서도 안전. */
export function getGuestId(): string | null {
  if (!isBrowser()) return null
  try {
    return localStorage.getItem(GUEST_ID_KEY)
  } catch {
    return null
  }
}

/**
 * 게스트 ID를 반환하되, 없으면 새로 생성하여 저장한다.
 * 비-브라우저 환경에서는 빈 문자열을 반환한다.
 */
export function getOrCreateGuestId(): string {
  if (!isBrowser()) return ''
  try {
    let id = localStorage.getItem(GUEST_ID_KEY)
    if (!id) {
      const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      id = `g_${uuid}`
      localStorage.setItem(GUEST_ID_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

/**
 * fetch 요청용 헤더. Content-Type을 포함하고 게스트 ID가 있으면 함께 첨부한다.
 * 게스트 ID가 없으면 자동으로 생성하지 않는다(읽기 전용).
 */
export function getGuestHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(extra ?? {}) }
  const id = getGuestId()
  if (id) h['x-guest-id'] = id
  return h
}

/**
 * 게스트 ID를 강제 보장한 헤더. 입력 페이지처럼 게스트로 무언가 생성하기 직전에 사용한다.
 */
export function getOrCreateGuestHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(extra ?? {}) }
  const id = getOrCreateGuestId()
  if (id) h['x-guest-id'] = id
  return h
}

/** 로그아웃 시 호출 가능. */
export function clearGuestId(): void {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(GUEST_ID_KEY)
  } catch {}
}
