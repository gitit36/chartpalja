'use client'

import { useCallback } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import { getGuestId } from '@/lib/auth/guest'

interface Props {
  open: boolean
  onClose: () => void
  feature?: string
  returnTo?: string
}

export function LoginPromptSheet({ open, onClose, feature, returnTo }: Props) {
  const handleLogin = useCallback(() => {
    const gid = getGuestId()
    const params = new URLSearchParams()
    if (gid) params.set('gid', gid)
    if (returnTo && returnTo.startsWith('/')) params.set('returnTo', returnTo)
    const qs = params.toString()
    window.location.href = qs ? `/api/auth/kakao/start?${qs}` : '/api/auth/kakao/start'
  }, [returnTo])

  if (!open) return null

  return (
    <BottomSheet
      onClose={onClose}
      header={(
        <div className="pt-1 pb-2 text-center">
          <div className="text-4xl mb-3" aria-hidden>🔓</div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            로그인하면 모든 기능이 열려요
          </h3>
          {feature && (
            <p className="text-xs text-gray-400">{feature}도 함께 풀려요</p>
          )}
        </div>
      )}
      footer={(
        <div>
          <button
            type="button"
            onClick={handleLogin}
            className="w-full py-4 rounded-2xl text-base font-bold bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 active:scale-[0.98] transition-all"
          >
            카카오로 로그인
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 mt-1 text-sm text-gray-500 hover:text-gray-700 transition-colors min-h-[44px]"
          >
            다음에
          </button>
        </div>
      )}
    >
      <ul className="text-sm text-gray-600 text-left space-y-2 pb-4 px-2 max-w-xs mx-auto">
        <li className="flex items-center gap-2.5">
          <span className="text-purple-500 font-bold">✓</span>
          <span>대운·시즌·캔들 등 전체 시각화</span>
        </li>
        <li className="flex items-center gap-2.5">
          <span className="text-purple-500 font-bold">✓</span>
          <span>비교·구간 분석</span>
        </li>
        <li className="flex items-center gap-2.5">
          <span className="text-purple-500 font-bold">✓</span>
          <span>운세 해설</span>
        </li>
      </ul>
    </BottomSheet>
  )
}
