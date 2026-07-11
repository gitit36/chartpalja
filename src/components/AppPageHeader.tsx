'use client'

import { useRouter } from 'next/navigation'

interface Props {
  title: string
  /** 기본: router.back(). 지정 시 해당 경로로 이동 */
  backHref?: string
  onBack?: () => void
}

/**
 * 사이드 메뉴 하위 페이지 공통 헤더.
 * 기준: 프로필 관리 / 차트 해석 가이드
 */
export function AppPageHeader({ title, backHref, onBack }: Props) {
  const router = useRouter()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    if (backHref) {
      router.push(backHref)
      return
    }
    router.back()
  }

  return (
    <div className="sticky top-0 z-30 bg-cp-raised/95 backdrop-blur-md border-b border-cp-border">
      <div className="flex items-center px-4 py-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로가기"
          className="w-11 h-11 -ml-2.5 mr-1 flex items-center justify-center text-cp-muted hover:text-cp-secondary hover:bg-cp-surface rounded-full text-lg transition-colors"
        >
          &larr;
        </button>
        <h1 className="text-lg font-bold text-cp-text">{title}</h1>
      </div>
    </div>
  )
}
