import type { Metadata } from 'next'
import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { BackButton } from '@/components/BackButton'
import { LegalSiblingNav } from '@/components/legal/LegalProse'
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
      <div className="min-h-screen flex flex-col bg-cp-raised">
        <header className="sticky top-0 z-30 bg-cp-raised/95 backdrop-blur-md border-b border-cp-border">
          <div className="flex items-center px-4 py-3 gap-1">
            <BackButton className="hover:bg-cp-surface" />
            <h1 className="text-lg font-bold text-cp-text tracking-tight">이용권 안내</h1>
          </div>
        </header>

        <main className="flex-1 px-4 pt-4 pb-10">
          <LegalSiblingNav />

          <section className="mb-7">
            <h2 className="text-lg font-bold text-cp-text mb-1.5 tracking-tight">주(株) 충전</h2>
            <p className="text-[13px] text-cp-muted leading-[1.7]">
              사주 분석 차트는 무료로 만들 수 있어요. 운세·구간·궁합 해설은 주(株)로 이용해요.
              구간 해설 {READING_COST.period}주, 운세·궁합 해설 각 {READING_COST.fortune}주가 차감됩니다.
            </p>
          </section>

          <section className="mb-7">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-[15px] font-bold text-cp-text">충전 팩</h3>
              <span className="text-[11px] text-cp-dim">VAT 포함</span>
            </div>
            <div className="space-y-2.5">
              {JU_PRODUCTS.map((p) => (
                <div
                  key={p.code}
                  className="flex items-center justify-between p-4 rounded-2xl border border-cp-border bg-cp-surface/50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-cp-text">{p.name}</p>
                      {p.recommended && (
                        <span className="text-[10px] font-semibold text-cp-accent bg-cp-accent/15 px-1.5 py-0.5 rounded-md">
                          추천
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-cp-muted mt-0.5">{p.description}</p>
                    <p className="text-[10px] text-cp-dim mt-0.5">장당 {formatPrice(juUnitPrice(p))}원</p>
                  </div>
                  <p className="text-base font-bold text-cp-text tabular-nums">
                    {formatPrice(p.price)}
                    <span className="text-xs font-medium text-cp-muted ml-0.5">원</span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-7 text-[12px] text-cp-dim leading-relaxed space-y-2 rounded-xl border border-cp-border bg-cp-input/40 px-3.5 py-3">
            <p>결제 수단: {methodLabels || '카카오페이 등'}</p>
            <p>{B.ticketUsageScope}</p>
            <p>{B.ticketRestriction}</p>
            <p>{B.serviceProvisionWindow}</p>
            <p>
              환불은{' '}
              <Link href="/refund" className="text-cp-accent font-medium hover:underline">
                환불정책
              </Link>
              을 확인해 주세요.
            </p>
          </section>
        </main>

        <MinimalLegalFooter />
      </div>
    </MobileContainer>
  )
}
