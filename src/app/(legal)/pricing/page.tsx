import type { Metadata } from 'next'
import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { BackButton } from '@/components/BackButton'
import { JU_PRODUCTS, READING_COST, formatPrice, juUnitPrice } from '@/lib/payment/products'
import { getActiveMethodLabels } from '@/lib/payment/methods'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

export const metadata: Metadata = {
  title: '이용권 안내 | 차트팔자',
  description: '차트팔자 주(株) 충전 및 상품 정보',
}

export default function PricingPage() {
  const methodLabels = getActiveMethodLabels().join(', ')
  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <BackButton />
          <h1 className="text-base font-bold text-gray-900">이용권 안내</h1>
        </header>

        <main className="flex-1 px-5 pt-5 pb-10">
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">주(株) 충전</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              사주 분석 차트는 무료로 생성되며, 운세·구간·궁합 해설은 주(株)로 이용해요.
              구간 해설 {READING_COST.period}주, 운세·궁합 해설 각 {READING_COST.fortune}주가 차감됩니다.
            </p>
          </section>

          <section className="mb-7">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">충전 팩</h3>
              <span className="text-[11px] text-gray-400">VAT 포함</span>
            </div>
            <div className="space-y-2.5">
              {JU_PRODUCTS.map(p => (
                <div
                  key={p.code}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      {p.recommended && (
                        <span className="text-[10px] font-semibold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-md">추천</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">장당 {formatPrice(juUnitPrice(p))}원</p>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {formatPrice(p.price)}<span className="text-xs font-medium text-gray-500 ml-0.5">원</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-7 text-xs text-gray-500 leading-relaxed space-y-2">
            <p>결제 수단: {methodLabels || '카카오페이 등'}</p>
            <p>{B.ticketUsageScope}</p>
            <p>{B.ticketRestriction}</p>
            <p>{B.serviceProvisionWindow}</p>
          </section>
        </main>

        <MinimalLegalFooter />
      </div>
    </MobileContainer>
  )
}
