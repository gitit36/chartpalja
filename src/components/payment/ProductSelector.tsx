'use client'

import { CHART_PRODUCTS, PERIOD_PRODUCTS, FREE_PERIOD_PER_CHART, formatPrice } from '@/lib/payment/products'
import type { Product } from '@/lib/payment/products'

interface Props {
  selectedChart: string | null
  selectedPeriod: string | null
  onSelectChart: (code: string | null) => void
  onSelectPeriod: (code: string | null) => void
}

function ProductCard({ product, isSelected, onToggle, badge }: { product: Product; isSelected: boolean; onToggle: () => void; badge?: string }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
        isSelected
          ? 'border-purple-500 bg-purple-50/70 shadow-md ring-1 ring-purple-200'
          : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
          }`}>
            {isSelected && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{product.name}</p>
            {badge && (
              <span className="text-[10px] font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-500 px-2 py-0.5 rounded-full">{badge}</span>
            )}
          </div>
        </div>
        <p className={`text-lg font-bold ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>{formatPrice(product.price)}원</p>
      </div>
    </button>
  )
}

function getBadge(code: string): string | undefined {
  if (code === 'chart_5') return '인기'
  if (code === 'chart_10') return '최저가'
  if (code === 'period_5') return '인기'
  if (code === 'period_15') return '최저가'
  return undefined
}

export function ProductSelector({ selectedChart, selectedPeriod, onSelectChart, onSelectPeriod }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-purple-500 rounded-full" />
          <h3 className="text-sm font-bold text-gray-800">운세 해설</h3>
        </div>
        <div className="space-y-2">
          {CHART_PRODUCTS.map(p => (
            <ProductCard
              key={p.code}
              product={p}
              isSelected={selectedChart === p.code}
              onToggle={() => onSelectChart(selectedChart === p.code ? null : p.code)}
              badge={getBadge(p.code)}
            />
          ))}
        </div>
        <div className="mt-3 ml-1 flex items-start gap-1.5">
          <span className="text-purple-500 text-xs mt-0.5">*</span>
          <p className="text-xs text-purple-600 leading-relaxed">
            운세 해설 1회당 기간 해설 {FREE_PERIOD_PER_CHART}회 무료 제공
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-4 bg-indigo-500 rounded-full" />
          <h3 className="text-sm font-bold text-gray-800">기간 해설 추가</h3>
        </div>
        <p className="text-xs text-gray-400 ml-3 mb-3">운세 해설 구매 시 기간 해설 무료 3회 포함</p>
        <div className="space-y-2">
          {PERIOD_PRODUCTS.map(p => (
            <ProductCard
              key={p.code}
              product={p}
              isSelected={selectedPeriod === p.code}
              onToggle={() => onSelectPeriod(selectedPeriod === p.code ? null : p.code)}
              badge={getBadge(p.code)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
