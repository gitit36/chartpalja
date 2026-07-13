import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { LegalLead, LegalH2 } from '@/components/legal/LegalProse'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'
import { JU_PRODUCTS, formatPrice } from '@/lib/payment/products'

export const metadata: Metadata = {
  title: '사업자 정보 | 차트팔자',
  description: '차트팔자 운영사 사업자 정보 및 취급 상품 안내',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-cp-border last:border-b-0">
      <span className="text-[11px] font-medium text-cp-muted">{label}</span>
      <span className="text-[13px] text-cp-secondary leading-snug">{children}</span>
    </div>
  )
}

function PriceRow({ name, price }: { name: string; price: number }) {
  return (
    <div className="flex items-center justify-between py-2 text-[13px]">
      <span className="text-cp-secondary">{name}</span>
      <span className="text-cp-text font-semibold tabular-nums">{formatPrice(price)}원</span>
    </div>
  )
}

export default function BusinessPage() {
  return (
    <LegalPageLayout title="사업자정보" currentPath="/business">
      <LegalLead>
        차트팔자를 운영하는 사업자 정보예요. 결제·환불 문의는{' '}
        <a href={`mailto:${B.email}`} className="text-cp-accent font-medium hover:underline">
          {B.email}
        </a>
        {' '}또는{' '}
        <Link href="/app/inquiry" className="text-cp-accent font-medium hover:underline">
          문의하기
        </Link>
        로 남겨 주세요.
      </LegalLead>

      <section className="rounded-2xl border border-cp-border bg-cp-surface/50 px-4">
        <Row label="서비스명">
          {B.serviceName}{' '}
          <span className="text-cp-muted">({B.serviceNameEn})</span>
        </Row>
        <Row label="상호">{B.companyName}</Row>
        <Row label="대표자">{B.ceoName}</Row>
        <Row label="사업자등록번호">{B.businessNumber}</Row>
        <Row label="통신판매업신고번호">
          <span>{B.ecommerceNotice}</span>
          <span className="block mt-1 text-[11px] text-cp-dim leading-relaxed">
            {B.ecommerceNoticeDetail}
          </span>
        </Row>
        <Row label="사업장 소재지">{B.address}</Row>
        <Row label="서비스 제공 기간">{B.serviceDeliveryPeriod}</Row>
        <Row label="고객센터">
          <a href={`tel:${B.phone}`} className="text-cp-accent font-medium hover:underline">
            {B.phone}
          </a>
        </Row>
        <Row label="이메일">
          <a href={`mailto:${B.email}`} className="text-cp-accent font-medium hover:underline">
            {B.email}
          </a>
        </Row>
        <Row label="호스팅 사업자">{B.hostingProvider}</Row>
      </section>

      <section className="mt-5 rounded-2xl border border-cp-border bg-cp-surface/50 px-4 py-4">
        <LegalH2>취급 상품 및 가격</LegalH2>
        <p className="text-[11px] text-cp-muted mb-2 -mt-1">주(株) 충전 · VAT 포함</p>
        <div className="divide-y divide-cp-border">
          {JU_PRODUCTS.map((p) => (
            <PriceRow key={p.code} name={`${p.name} (${p.quantity}주)`} price={p.price} />
          ))}
        </div>
        <p className="mt-3 text-[11px] text-cp-dim leading-relaxed">
          이용권 유효기간은 결제일로부터 {B.ticketValidityMonths}개월이에요.
        </p>
        <Link
          href="/pricing"
          className="mt-2 inline-flex text-[12px] font-semibold text-cp-accent hover:underline"
        >
          이용권 자세히 보기 →
        </Link>
      </section>
    </LegalPageLayout>
  )
}
