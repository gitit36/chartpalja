import type { Metadata } from 'next'
import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { BackButton } from '@/components/BackButton'
import { CHART_PRODUCTS, PERIOD_PRODUCTS, FREE_PERIOD_PER_CHART, formatPrice } from '@/lib/payment/products'
import { getActiveMethodLabels } from '@/lib/payment/methods'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

export const metadata: Metadata = {
  title: '이용권 안내 | 차트팔자',
  description: '차트팔자 이용권 가격 및 상품 정보',
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
            <h2 className="text-lg font-bold text-gray-900 mb-1.5">차트팔자 이용권</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              사주 분석 차트는 무료로 생성되며, 종합 운세 해설과 구간 해설은 차트팔자 서비스 내에서 사용하는 이용권으로 이용하실 수 있어요.
            </p>
          </section>

          <section className="mb-7">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">운세 해설 이용권</h3>
              <span className="text-[11px] text-gray-400">VAT 포함</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              사주 차트와 함께 보는 종합 운세 해설을 1회 이용할 수 있어요.
            </p>
            <div className="space-y-2.5">
              {CHART_PRODUCTS.map(p => (
                <div
                  key={p.code}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {formatPrice(p.price)}<span className="text-xs font-medium text-gray-500 ml-0.5">원</span>
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              운세 해설 1회당 구간 해설 {FREE_PERIOD_PER_CHART}회를 무료로 함께 드려요.
            </p>
          </section>

          <section className="mb-7">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900">구간 해설 이용권</h3>
              <span className="text-[11px] text-gray-400">VAT 포함</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              차트에서 선택한 연도/구간에 대한 상세 해설을 1회 이용할 수 있어요.
            </p>
            <div className="space-y-2.5">
              {PERIOD_PRODUCTS.map(p => (
                <div
                  key={p.code}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                  <p className="text-base font-bold text-gray-900">
                    {formatPrice(p.price)}<span className="text-xs font-medium text-gray-500 ml-0.5">원</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">이용 안내</h3>
            <ul className="space-y-1.5 text-xs text-gray-600 leading-relaxed list-disc pl-4">
              <li>{B.ticketUsageScope}</li>
              <li>결제 완료 즉시 계정에 자동 지급되어 바로 사용할 수 있어요. (서비스 제공기간: {B.serviceProvisionWindow})</li>
              <li>이용권 유효기간은 결제일로부터 12개월(1년)입니다.</li>
              <li>사용하지 않은 이용권은 결제일로부터 7일 이내 환불받을 수 있습니다 (유료 구입분에 한함).</li>
              <li>이미 해설 사용에 사용했거나 유료 구입분이 아닌 경우 환불이 제한됩니다.</li>
              <li>이용권은 현금 환급(인출)·타인 양도·재판매가 불가합니다.</li>
              <li>결제수단: {methodLabels}</li>
            </ul>
          </section>
        </main>

        <MinimalLegalFooter />
      </div>
    </MobileContainer>
  )
}
