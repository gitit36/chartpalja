'use client'

import { useCallback } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import { getGuestId } from '@/lib/auth/guest'

interface Props {
  open: boolean
  onClose: () => void
  /**
   * 잠금 클릭 컨텍스트 (예: "대운 흐름선", "운세 해설"). 보조 설명에만 사용한다.
   * 메인 카피는 항상 통일된 슬로건을 유지한다.
   */
  feature?: string
  /**
   * 로그인 성공 후 돌아갈 경로. 비워두면 기본 분기(`/app/list` 또는 `/app/input`).
   * 예) 차트 잠금 시트에서 열린 경우 현재 URL을 넘긴다.
   */
  returnTo?: string
}

/**
 * 비로그인 게스트가 잠긴 기능/해설을 클릭했을 때 등장하는 카카오 로그인 유도 시트.
 *
 * 카피 정책 (전 화면 통일):
 * - 메인 카피: "로그인하면 모든 기능이 열려요"
 * - 메인 CTA: "카카오로 로그인"
 * - 보조 버튼: "다음에"
 *
 * UX 원칙:
 * - 피크엔드: "거절"도 부드럽게 — '다음에' 버튼은 강조하지 않는다.
 * - 피츠: 1차 액션은 py-4(56px), 풀-너비.
 * - 도허티: BottomSheet 슬라이드 인 0.3s.
 */
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
    <BottomSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-4 text-center">
        <div className="text-4xl mb-4" aria-hidden>🔓</div>
        <h3 className="text-lg font-bold text-gray-900 mb-1.5">
          로그인하면 모든 기능이 열려요
        </h3>
        {feature && (
          <p className="text-xs text-gray-400 mb-4">{feature}도 함께 풀려요</p>
        )}
        {!feature && <div className="h-1.5" />}

        <ul className="text-sm text-gray-600 text-left space-y-2 mb-6 px-2 max-w-xs mx-auto">
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
    </BottomSheet>
  )
}
