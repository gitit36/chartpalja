'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

const LEGAL_PATHS = ['/terms', '/privacy', '/refund', '/business', '/pricing']

export function isLegalPath(pathname: string): boolean {
  return LEGAL_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export function PathTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return
    if (!isLegalPath(pathname)) {
      try {
        const qs = searchParams?.toString() ?? ''
        const url = qs ? `${pathname}?${qs}` : pathname
        sessionStorage.setItem('lastNonLegalPath', url)
      } catch {}
    }
  }, [pathname, searchParams])
  return null
}
