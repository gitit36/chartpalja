'use client'

import { BottomSheet } from '@/components/BottomSheet'

interface Props {
  open: boolean
  title: string
  description?: string
  buttonLabel?: string
  onClose: () => void
}

/**
 * window.alert 대체 — 정보성 BottomSheet.
 */
export function AlertSheet({ open, title, description, buttonLabel = '확인', onClose }: Props) {
  if (!open) return null
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pt-2 pb-3 text-center">
        <h3 className="text-base font-bold text-gray-900 mb-1.5">{title}</h3>
        {description && <p className="text-sm text-gray-500 leading-relaxed mb-5">{description}</p>}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg transition-all active:scale-[0.98] min-h-[48px]"
        >
          {buttonLabel}
        </button>
      </div>
    </BottomSheet>
  )
}
