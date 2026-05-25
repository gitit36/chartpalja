'use client'

import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { LegalFooter } from '@/components/LegalFooter'

export type ResultVariant = 'success' | 'fail' | 'cancel'

interface ResultAction {
  label: string
  href: string
  /** true면 primary 스타일(보라 그라데이션), 아니면 텍스트 버튼 */
  primary?: boolean
}

interface Props {
  variant: ResultVariant
  title: string
  description?: string
  /** 본문 보조 영역(상품 요약 카드 등) */
  detail?: React.ReactNode
  actions: ResultAction[]
}

const ICON_BY_VARIANT: Record<ResultVariant, string> = {
  success: '🎉',
  fail: '😔',
  cancel: '↩️',
}

/**
 * 결제 결과(성공/실패/취소) 화면 공통 컴포넌트.
 * - 피크엔드: 결과 화면은 사용자가 마지막에 기억하는 부분 → 일관된 디자인/카피.
 * - 피츠: 1차 버튼 py-4, 풀-너비.
 * - 도허티: 화면 그 자체가 즉시 렌더되도록 부담스러운 fetch는 호출부에서 처리.
 */
export function ResultScreen({ variant, title, description, detail, actions }: Props) {
  const router = useRouter()
  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 px-4 pt-16 pb-8 flex flex-col items-center justify-center text-center">
          <div className="text-5xl mb-6" aria-hidden>{ICON_BY_VARIANT[variant]}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
          {description && (
            <p className="text-gray-500 text-sm mb-8 max-w-sm leading-relaxed">{description}</p>
          )}

          {detail}

          <div className="w-full max-w-sm space-y-3">
            {actions.map((a, i) => (
              <button
                key={`${a.href}-${i}`}
                onClick={() => router.push(a.href)}
                className={
                  a.primary
                    ? 'w-full py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all min-h-[56px]'
                    : 'w-full py-3 rounded-2xl text-sm text-gray-500 hover:text-gray-700 transition-colors min-h-[44px]'
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <LegalFooter />
      </div>
    </MobileContainer>
  )
}
