'use client'

import type { PaymentMethod } from '@/lib/payment/types'
import { PAYMENT_METHOD_META, PAYMENT_INACTIVE_NOTE } from '@/lib/payment/methods'

interface Props {
  selected: PaymentMethod | null
  onSelect: (method: PaymentMethod) => void
  /** 비활성화할 결제수단과 사유 (사유는 툴팁/하단 안내에 사용) */
  disabledMethods?: Partial<Record<PaymentMethod, string>>
}

export function PaymentMethodSelector({ selected, onSelect, disabledMethods }: Props) {
  // '준비 중'(비활성 수단)은 배지로 표시하므로 하단 안내에서는 제외하고, 그 외 사유만 노출
  const disabledNotes = Object.values(disabledMethods ?? {})
    .filter((r): r is string => Boolean(r) && r !== PAYMENT_INACTIVE_NOTE)
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        {PAYMENT_METHOD_META.map((m) => {
          const disabledReason = disabledMethods?.[m.key]
          const isDisabled = Boolean(disabledReason)
          const isInactive = disabledReason === PAYMENT_INACTIVE_NOTE
          const isSelected = selected === m.key
          return (
            <button
              key={m.key}
              onClick={() => !isDisabled && onSelect(m.key)}
              disabled={isDisabled}
              title={disabledReason}
              className={`flex flex-col items-center gap-1 p-3.5 rounded-xl border transition-all ${
                isSelected
                  ? 'border-purple-400 bg-purple-50/60'
                  : isDisabled
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className="text-xl">{m.icon}</span>
              <span className="text-[13px] font-medium text-gray-800">{m.label}</span>
              {isInactive ? (
                <span className="text-[10px] text-gray-400">{PAYMENT_INACTIVE_NOTE}</span>
              ) : (
                <span className="text-[10px] text-gray-400">{m.desc}</span>
              )}
            </button>
          )
        })}
      </div>
      {disabledNotes.length > 0 && (
        <p className="mt-2.5 text-[11px] text-gray-400 leading-relaxed">
          {disabledNotes.join(' · ')}
        </p>
      )}
    </div>
  )
}
