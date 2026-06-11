'use client'

import { formatPrice, calcFreePeriodCredits } from '@/lib/payment/products'
import type { Product } from '@/lib/payment/products'
import { BUSINESS_INFO } from '@/lib/legal/business-info'

interface Props {
  chartProduct: Product | null
  periodProduct: Product | null
  totalPrice: number
}

export function OrderSummaryCard({ chartProduct, periodProduct, totalPrice }: Props) {
  const freePeriod = chartProduct ? calcFreePeriodCredits(chartProduct.quantity) : 0

  return (
    <div className="bg-gray-50/70 rounded-2xl p-5 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-3">주문 내역</p>

      <div className="space-y-3">
        {chartProduct && (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{chartProduct.name}</p>
              {freePeriod > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">+ 구간 해설 {freePeriod}회 무료 포함</p>
              )}
            </div>
            <p className="text-sm font-medium text-gray-700">{formatPrice(chartProduct.price)}원</p>
          </div>
        )}

        {periodProduct && (
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-gray-800">{periodProduct.name}</p>
            <p className="text-sm font-medium text-gray-700">{formatPrice(periodProduct.price)}원</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">총 결제 금액</span>
        <span className="text-lg font-bold text-gray-900">{formatPrice(totalPrice)}원</span>
      </div>

      <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
        서비스 제공 기간: {BUSINESS_INFO.serviceDeliveryPeriod}
      </p>
    </div>
  )
}
