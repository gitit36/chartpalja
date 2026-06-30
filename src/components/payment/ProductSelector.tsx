'use client'

import { JU_PRODUCTS, formatPrice, juUnitPrice } from '@/lib/payment/products'
import type { Product } from '@/lib/payment/products'

interface Props {
  selectedCode: string | null
  onSelect: (code: string | null) => void
}

function ProductCard({ product, isSelected, onToggle }: { product: Product; isSelected: boolean; onToggle: () => void }) {
  const unit = juUnitPrice(product)
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'border-purple-400 bg-purple-50/60'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
            isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300 bg-white'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900">{product.name}</p>
              {product.recommended && (
                <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-md">추천</span>
              )}
              {product.code === 'ju_100' && (
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-md">최대 할인</span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">{product.description}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">장당 {formatPrice(unit)}원</p>
          </div>
        </div>
        <p className={`text-base font-bold shrink-0 ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>{formatPrice(product.price)}원</p>
      </div>
    </button>
  )
}

export function ProductSelector({ selectedCode, onSelect }: Props) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-[15px] font-semibold text-gray-900">주(株) 충전</h3>
        <span className="text-[11px] text-gray-400">구간 1주 · 운세·궁합 5주</span>
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
