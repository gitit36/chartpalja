'use client'

import type { PaymentMethod } from '@/lib/payment/types'

interface Props {
  selected: PaymentMethod | null
  onSelect: (method: PaymentMethod) => void
  /** 비활성화할 결제수단과 사유 (사유는 툴팁/하단 안내에 사용) */
  disabledMethods?: Partial<Record<PaymentMethod, string>>
}

const METHODS: { key: PaymentMethod; label: string; icon: string; desc: string }[] = [
  { key: 'kakaopay', label: '카카오페이', icon: '💛', desc: '카카오페이로 간편결제' },
  { key: 'tosspay',  label: '토스페이',   icon: '💙', desc: '토스페이로 간편결제' },
  { key: 'card',     label: '국내카드',   icon: '💳', desc: '신용/체크카드 결제' },
  { key: 'transfer', label: '계좌이체',   icon: '🏦', desc: '실시간 계좌이체' },
  { key: 'overseas', label: '해외카드',   icon: '🌍', desc: 'Visa/Master/AMEX (USD)' },
]

export function PaymentMethodSelector({ selected, onSelect, disabledMethods }: Props) {
  const disabledNotes = Object.values(disabledMethods ?? {}).filter(Boolean) as string[]
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {METHODS.map((m) => {
          const disabledReason = disabledMethods?.[m.key]
          const isDisabled = Boolean(disabledReason)
          const isSelected = selected === m.key
          return (
            <button
              key={m.key}
              onClick={() => !isDisabled && onSelect(m.key)}
              disabled={isDisabled}
              title={disabledReason}
              className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 shadow-md'
                  : isDisabled
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <span className="text-sm font-semibold text-gray-900">{m.label}</span>
              <span className="text-[11px] text-gray-400">{m.desc}</span>
            </button>
          )
        })}
      </div>
      {disabledNotes.length > 0 && (
        <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
          ※ {disabledNotes.join(' / ')}
        </p>
      )}
    </div>
  )
}
