'use client'

import { useEffect, useState } from 'react'

export interface Balance {
  chartCredits: number
  periodCredits: number
}

const CACHE_KEY = 'saju_balance_cache_v1'

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  if (typeof window !== 'undefined') {
    const gid = localStorage.getItem('saju_guest_id')
    if (gid) h['x-guest-id'] = gid
  }
  return h
}

function readCache(): Balance | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.chartCredits === 'number' && typeof parsed?.periodCredits === 'number') {
      return { chartCredits: parsed.chartCredits, periodCredits: parsed.periodCredits }
    }
  } catch { /* ignore */ }
  return null
}

function writeCache(b: Balance) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b))
  } catch { /* ignore */ }
}

let inflight: Promise<Balance | null> | null = null

export function fetchBalance(): Promise<Balance | null> {
  if (inflight) return inflight
  inflight = fetch('/api/user/balance', { headers: getHeaders() })
    .then(r => (r.ok ? r.json() : null))
    .then((b: Balance | null) => {
      if (b && typeof b.chartCredits === 'number' && typeof b.periodCredits === 'number') {
        writeCache(b)
        return b
      }
      return null
    })
    .catch(() => null)
    .finally(() => { inflight = null })
  return inflight
}

export function prefetchBalance() {
  void fetchBalance()
}

export function useBalance() {
  const [balance, setBalance] = useState<Balance | null>(() => readCache())

  useEffect(() => {
    let mounted = true
    fetchBalance().then(b => { if (mounted && b) setBalance(b) })
    return () => { mounted = false }
  }, [])

  return balance
}
