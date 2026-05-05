import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'
import { CHART_PRODUCTS, PERIOD_PRODUCTS, formatPrice } from '@/lib/payment/products'

export const metadata: Metadata = {
  title: '사업자 정보 | 차트팔자',
  description: '차트팔자 운영사 사업자 정보 및 취급 상품 안내',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-b-0">
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
      <span className="text-sm text-gray-900">{children}</span>
    </div>
  )
}

function PriceRow({ name, price }: { name: string; price: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-700">{name}</span>
      <span className="text-gray-900 tabular-nums">{formatPrice(price)}원</span>
    </div>
  )
}

export default function BusinessPage() {
  return (
    <LegalPageLayout title="사업자 정보">
      <section className="bg-white border border-gray-200 rounded-xl px-4">
        <Row label="서비스명">{B.serviceName} ({B.serviceNameEn})</Row>
        <Row label="상호">{B.companyName}</Row>
        <Row label="대표자">{B.ceoName}</Row>
        <Row label="사업자등록번호">{B.businessNumber}</Row>
        <Row label="통신판매업신고번호">
          <span>{B.ecommerceNotice}</span>
          <span className="block mt-1 text-[11px] text-gray-500 leading-relaxed">
            {B.ecommerceNoticeDetail}
          </span>
        </Row>
        <Row label="사업장 소재지">{B.address}</Row>
        <Row label="고객센터">
          <a href={`tel:${B.phone}`} className="text-purple-600 underline">{B.phone}</a>
        </Row>
        <Row label="이메일">
          <a href={`mailto:${B.email}`} className="text-purple-600 underline">{B.email}</a>
        </Row>
        <Row label="호스팅 사업자">{B.hostingProvider}</Row>
      </section>

      <section className="mt-5 bg-white border border-gray-200 rounded-xl px-4 py-4">
        <h2 className="text-[11px] font-medium text-gray-400 mb-2">취급 상품 및 가격</h2>

        <div className="divide-y divide-gray-100">
          <div className="py-2">
            <p className="text-[11px] text-gray-500 mb-1">운세 해설 이용권</p>
            {CHART_PRODUCTS.map(p => (
              <PriceRow key={p.code} name={p.name} price={p.price} />
            ))}
          </div>
          <div className="py-2">
            <p className="text-[11px] text-gray-500 mb-1">구간 해설 이용권</p>
            {PERIOD_PRODUCTS.map(p => (
              <PriceRow key={p.code} name={p.name} price={p.price} />
            ))}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
          모든 가격은 부가가치세(VAT) 포함 · 이용권 유효기간 결제일로부터 12개월
        </p>
        <Link
          href="/pricing"
          className="mt-2 inline-block text-[11px] text-purple-600 hover:text-purple-700"
        >
          이용권 자세히 보기 →
        </Link>
      </section>
    </LegalPageLayout>
  )
}
