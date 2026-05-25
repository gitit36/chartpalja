'use client'

import { useEffect, useState } from 'react'

export interface Balance {
  chartCredits: number
  periodCredits: number
}

/**
 * 잔액 캐시 키 정책:
 * - v2부터는 로그인 사용자 단위로 분리한다(`saju_balance_cache_v2_<userId>`).
 * - 사용자 ID는 `/api/auth/me` 응답으로 받아 `saju_balance_user_id_v2`에 보관.
 * - 게스트는 절대 캐시/네트워크에 접근하지 않는다(`null` 반환).
 * - 401이 떨어지면 캐시를 무효화하고 user id 표지도 지운다(다른 사용자 노출 방지).
 *
 * 이전 버전의 `saju_balance_cache_v1`은 user 격리가 없어 누수가 있었으므로
 * 만나는 즉시 제거한다.
 */

const USER_ID_KEY = 'saju_balance_user_id_v2'
const CACHE_PREFIX = 'saju_balance_cache_v2_'
const LEGACY_CACHE_KEY = 'saju_balance_cache_v1'

const ZERO_BALANCE: Balance = { chartCredits: 0, periodCredits: 0 }

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function dropLegacyCache() {
  if (!isBrowser()) return
  try { localStorage.removeItem(LEGACY_CACHE_KEY) } catch { /* ignore */ }
}

function getCachedUserId(): string | null {
  if (!isBrowser()) return null
  try { return localStorage.getItem(USER_ID_KEY) } catch { return null }
}

function setCachedUserId(userId: string) {
  if (!isBrowser()) return
  try { localStorage.setItem(USER_ID_KEY, userId) } catch { /* ignore */ }
}

function readCacheFor(userId: string): Balance | null {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.chartCredits === 'number' && typeof parsed?.periodCredits === 'number') {
      return { chartCredits: parsed.chartCredits, periodCredits: parsed.periodCredits }
    }
  } catch { /* ignore */ }
  return null
}

function writeCacheFor(userId: string, b: Balance) {
  if (!isBrowser()) return
  try { localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(b)) } catch { /* ignore */ }
}

/**
 * 로컬에 저장된 모든 잔액 캐시를 제거. 로그아웃 시 호출한다.
 */
export function clearBalanceCache() {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(USER_ID_KEY)
    localStorage.removeItem(LEGACY_CACHE_KEY)
    // user-scoped 캐시는 prefix로 일괄 제거.
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

let inflight: Promise<Balance | null> | null = null

/**
 * 잔액을 가져온다. 게스트(401)이면 null을 반환하고 캐시도 제거한다.
 * 정상 응답이면 user-scoped 캐시에 저장한다.
 */
export function fetchBalance(): Promise<Balance | null> {
  if (!isBrowser()) return Promise.resolve(null)
  dropLegacyCache()
  if (inflight) return inflight
  inflight = fetch('/api/user/balance', { credentials: 'same-origin' })
    .then(async r => {
      if (r.status === 401) {
        clearBalanceCache()
        return null
      }
      if (!r.ok) return null
      return r.json()
    })
    .then((b: (Balance & { userId?: string }) | null) => {
      if (!b || typeof b.chartCredits !== 'number' || typeof b.periodCredits !== 'number') return null
      const balance: Balance = { chartCredits: b.chartCredits, periodCredits: b.periodCredits }
      const uid = typeof b.userId === 'string' ? b.userId : null
      if (uid) {
        setCachedUserId(uid)
        writeCacheFor(uid, balance)
      }
      return balance
    })
    .catch(() => null)
    .finally(() => { inflight = null })
  return inflight
}

export function prefetchBalance() {
  if (!isBrowser()) return
  void fetchBalance()
}

/**
 * 게스트는 항상 0회 잔액을 반환.
 * 로그인 사용자는 본인 user id 기준 캐시 → 네트워크 순으로 갱신.
 *
 * @param isLoggedIn - 로그인 여부. true이면 fetch, false면 0회 반환, null이면 보수적으로 대기.
 */
export function useBalance(isLoggedIn: boolean | null): Balance | null {
  const [balance, setBalance] = useState<Balance | null>(() => {
    if (!isBrowser()) return null
    dropLegacyCache()
    const uid = getCachedUserId()
    return uid ? readCacheFor(uid) : null
  })

  useEffect(() => {
    if (isLoggedIn === false) {
      // 게스트: 캐시 잔재가 있으면 모두 비우고 0회 반환.
      clearBalanceCache()
      setBalance(ZERO_BALANCE)
      return
    }
    if (isLoggedIn !== true) return
    let mounted = true
    fetchBalance().then(b => { if (mounted && b) setBalance(b) })
    return () => { mounted = false }
  }, [isLoggedIn])

  if (isLoggedIn === false) return ZERO_BALANCE
  return balance
}
