'use client'

import type { PaymentMethod } from '@/lib/payment/types'

interface Props {
  selected: PaymentMethod | null
  onSelect: (method: PaymentMethod) => void
}

const METHODS: { key: PaymentMethod; label: string; icon: string; desc: string }[] = [
  { key: 'kakaopay', label: '카카오페이', icon: '💛', desc: '카카오페이로 간편결제' },
  { key: 'tosspay',  label: '토스페이',   icon: '💙', desc: '토스페이로 간편결제' },
  { key: 'card',     label: '국내카드',   icon: '💳', desc: '신용/체크카드 결제' },
  { key: 'paddle',   label: '해외카드',   icon: '🌍', desc: 'Visa/Master 해외카드' },
]

export function PaymentMethodSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {METHODS.map(m => (
        <button
          key={m.key}
          onClick={() => onSelect(m.key)}
          className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all ${
            selected === m.key
              ? 'border-purple-500 bg-purple-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <span className="text-2xl">{m.icon}</span>
          <span className="text-sm font-semibold text-gray-900">{m.label}</span>
          <span className="text-[11px] text-gray-400">{m.desc}</span>
        </button>
      ))}
    </div>
  )
}
