'use client'

import { JU_PRODUCTS, formatPrice } from '@/lib/payment/products'
import type { Product } from '@/lib/payment/products'

interface Props {
  selectedCode: string | null
  onSelect: (code: string | null) => void
}

function ProductCard({ product, isSelected, onToggle }: { product: Product; isSelected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'border-cp-accent bg-cp-downMuted'
          : 'border-cp-border bg-cp-surface hover:border-cp-borderStrong'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
            isSelected ? 'border-cp-accent bg-cp-accent' : 'border-cp-borderStrong bg-cp-input'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-cp-text">{product.name}</p>
              {product.recommended && (
                <span className="text-[10px] font-semibold text-cp-accent bg-cp-downMuted px-1.5 py-0.5 rounded-md">추천</span>
              )}
              {product.code === 'ju_100' && (
                <span className="text-[10px] font-semibold text-cp-caution bg-cp-caution/15 px-1.5 py-0.5 rounded-md">최대 할인</span>
              )}
            </div>
            <p className="text-[11px] text-cp-muted mt-0.5">{product.description}</p>
          </div>
        </div>
        <p className={`text-base font-bold shrink-0 ${isSelected ? 'text-cp-text' : 'text-cp-secondary'}`}>{formatPrice(product.price)}원</p>
      </div>
    </button>
  )
}

export function ProductSelector({ selectedCode, onSelect }: Props) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-[15px] font-semibold text-cp-text">주(株) 충전</h3>
        <span className="text-[11px] text-cp-muted">구간 1주 · 운세·궁합 5주</span>
      </div>
      <div className="space-y-2">
        {JU_PRODUCTS.map(p => (
          <ProductCard
            key={p.code}
            product={p}
            isSelected={selectedCode === p.code}
            onToggle={() => onSelect(selectedCode === p.code ? null : p.code)}
          />
        ))}
      </div>
    </div>
  )
}
