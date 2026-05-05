'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const LEGAL_PATHS = ['/terms', '/privacy', '/refund', '/business', '/pricing']

export function isLegalPath(pathname: string): boolean {
  return LEGAL_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export function PathTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return
    if (!isLegalPath(pathname)) {
      try {
        sessionStorage.setItem('lastNonLegalPath', pathname)
      } catch {}
    }
  }, [pathname])
  return null
}
