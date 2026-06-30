'use client'

import { useEffect, useState } from 'react'

export interface Balance {
  ju: number
}

const USER_ID_KEY = 'saju_balance_user_id_v3'
const CACHE_PREFIX = 'saju_balance_cache_v3_'
const LEGACY_KEYS = ['saju_balance_cache_v1', 'saju_balance_user_id_v2', 'saju_balance_cache_v2_']

const ZERO_BALANCE: Balance = { ju: 0 }

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function dropLegacyCache() {
  if (!isBrowser()) return
  try {
    localStorage.removeItem('saju_balance_cache_v1')
    localStorage.removeItem('saju_balance_user_id_v2')
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('saju_balance_cache_v2_') || LEGACY_KEYS.includes(k))) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
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
    if (typeof parsed?.ju === 'number') return { ju: parsed.ju }
  } catch { /* ignore */ }
  return null
}

function writeCacheFor(userId: string, b: Balance) {
  if (!isBrowser()) return
  try { localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(b)) } catch { /* ignore */ }
}

export function clearBalanceCache() {
  if (!isBrowser()) return
  try {
    localStorage.removeItem(USER_ID_KEY)
    dropLegacyCache()
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(CACHE_PREFIX)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

let inflight: Promise<Balance | null> | null = null

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
      if (!b || typeof b.ju !== 'number') return null
      const balance: Balance = { ju: b.ju }
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

export function useBalance(isLoggedIn: boolean | null): Balance | null {
  const [balance, setBalance] = useState<Balance | null>(() => {
    if (!isBrowser()) return null
    dropLegacyCache()
    const uid = getCachedUserId()
    return uid ? readCacheFor(uid) : null
  })

  useEffect(() => {
    if (isLoggedIn === false) {
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
