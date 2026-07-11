'use client'

import { useRouter, usePathname } from 'next/navigation'
import { isLegalPath } from '@/components/PathTracker'

interface Props {
  fallback?: string
  className?: string
}

export function BackButton({ fallback = '/', className = '' }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const handleBack = () => {
    const onLegal = pathname ? isLegalPath(pathname) : false
    if (onLegal) {
      let target: string | null = null
      try {
        target = sessionStorage.getItem('lastNonLegalPath')
      } catch {}
      const targetPath = target ? target.split('?')[0] : ''
      if (target && targetPath && !isLegalPath(targetPath)) {
        router.push(target)
        return
      }
      router.push(fallback)
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }

  return (
    <button
      onClick={handleBack}
      className={`w-11 h-11 -ml-2.5 flex items-center justify-center text-cp-muted hover:text-cp-text hover:bg-gray-100 rounded-full text-lg transition-colors ${className}`}
      aria-label="뒤로가기"
    >
      &larr;
    </button>
  )
}
