'use client'

import { formatPrice, calcFreePeriodCredits } from '@/lib/payment/products'
import type { Product } from '@/lib/payment/products'

interface Props {
  chartProduct: Product | null
  periodProduct: Product | null
  totalPrice: number
}

export function OrderSummaryCard({ chartProduct, periodProduct, totalPrice }: Props) {
  const freePeriod = chartProduct ? calcFreePeriodCredits(chartProduct.quantity) : 0

  return (
    <div className="bg-gradient-to-br from-gray-50 to-purple-50/30 rounded-2xl p-5 border border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">주문 내역</p>

      <div className="space-y-3">
        {chartProduct && (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{chartProduct.name}</p>
              {freePeriod > 0 && (
                <p className="text-xs text-purple-600 mt-0.5">+ 기간 해설 {freePeriod}회 무료 포함</p>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-700">{formatPrice(chartProduct.price)}원</p>
          </div>
        )}

        {periodProduct && (
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-gray-900">{periodProduct.name}</p>
            <p className="text-sm font-semibold text-gray-700">{formatPrice(periodProduct.price)}원</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800">총 결제 금액</span>
        <span className="text-xl font-extrabold text-purple-700">{formatPrice(totalPrice)}원</span>
      </div>
    </div>
  )
}
