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
      if (target && !isLegalPath(target)) {
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
      className={`w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 text-lg ${className}`}
      aria-label="뒤로가기"
    >
      &larr;
    </button>
  )
}
