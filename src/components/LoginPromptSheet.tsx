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
        <div className="pb-3 text-center">
          <h3 className="font-bold text-cp-text text-lg leading-tight">로그인하면 열려요</h3>
          <p className="text-xs text-cp-muted mt-1.5 leading-relaxed">
            {feature
              ? `${feature} 포함해 지표·상세 해석을 볼 수 있어요`
              : '지표·상세 해석·운세 해설을 볼 수 있어요'}
          </p>
        </div>
      )}
      footer={(
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleLogin}
            className="w-full py-3.5 rounded-xl text-sm font-bold bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 active:scale-[0.98] transition-all"
          >
            카카오로 로그인
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-semibold text-cp-secondary border border-cp-borderStrong bg-cp-input hover:bg-cp-hover transition-colors"
          >
            다음에
          </button>
        </div>
      )}
    >
      <ul className="text-sm text-cp-muted space-y-2.5 pb-2 px-1">
        <li className="flex items-start gap-2.5">
          <span className="text-cp-accent font-bold shrink-0">·</span>
          <span>대운·시즌·도메인 등 전체 지표</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="text-cp-accent font-bold shrink-0">·</span>
          <span>이번 주·올해 흐름과 점수 요인</span>
        </li>
        <li className="flex items-start gap-2.5">
          <span className="text-cp-accent font-bold shrink-0">·</span>
          <span>용신·신살·운세 해설</span>
        </li>
      </ul>
    </BottomSheet>
  )
}
