'use client'

import { formatPrice } from '@/lib/payment/products'
import type { Product } from '@/lib/payment/products'
import { BUSINESS_INFO } from '@/lib/legal/business-info'

interface Props {
  product: Product | null
  totalPrice: number
}

export function OrderSummaryCard({ product, totalPrice }: Props) {
  return (
    <div className="bg-gray-50/70 rounded-2xl p-5 border border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-3">주문 내역</p>

      <div className="space-y-3">
        {product && (
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{product.name} 충전</p>
              <p className="text-xs text-gray-500 mt-0.5">결제 즉시 {product.quantity}주 지급</p>
            </div>
            <p className="text-sm font-medium text-gray-700">{formatPrice(product.price)}원</p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">총 결제 금액</span>
        <span className="text-lg font-bold text-gray-900">{formatPrice(totalPrice)}원</span>
      </div>

      <div className="mt-3 space-y-0.5 text-[11px] text-gray-400 leading-relaxed">
        <p>서비스 제공 기간: {BUSINESS_INFO.serviceDeliveryPeriod}</p>
        <p>이용처: 차트팔자 내 해설 기능 전용 · 결제 즉시 지급 · 현금 환급/양도/재판매 불가</p>
      </div>
    </div>
  )
}
