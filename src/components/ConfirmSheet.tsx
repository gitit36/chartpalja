'use client'

import { BottomSheet } from '@/components/BottomSheet'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** confirm 버튼이 위험성을 띠면 빨간색 강조. */
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmSheet({
  open, title, description, confirmLabel = '확인', cancelLabel = '취소',
  destructive = false, onConfirm, onCancel,
}: Props) {
  if (!open) return null
  return (
    <BottomSheet
      onClose={onCancel}
      header={(
        <div className="pt-1 pb-3 text-center">
          <h3 className="text-base font-bold text-cp-text mb-1.5">{title}</h3>
          {description && <p className="text-sm text-cp-muted leading-relaxed">{description}</p>}
        </div>
      )}
      footer={(
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-medium text-cp-muted bg-cp-bg border border-cp-border hover:bg-cp-border/40 transition-colors min-h-[48px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? 'flex-1 py-3 rounded-xl text-sm font-bold text-white bg-cp-caution hover:brightness-110 transition-colors min-h-[48px]'
                : 'flex-1 py-3 rounded-xl text-sm font-bold text-white bg-cp-accent hover:brightness-110 transition-all active:scale-[0.98] min-h-[48px]'
            }
          >
            {confirmLabel}
          </button>
        </div>
      )}
    />
  )
}
