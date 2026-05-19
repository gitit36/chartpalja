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
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'border-purple-400 bg-purple-50/60'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
            isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300 bg-white'
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
              <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-md">{badge}</span>
            )}
          </div>
        </div>
        <p className={`text-base font-bold ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>{formatPrice(product.price)}원</p>
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
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h3 className="text-[15px] font-semibold text-gray-900">운세 해설</h3>
          <span className="text-[11px] text-gray-400">
            운세 해설 1회당 구간 해설 {FREE_PERIOD_PER_CHART}회 무료 제공
          </span>
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
      </div>

      <div>
        <h3 className="text-[15px] font-semibold text-gray-900 mb-3">구간 해설</h3>
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
