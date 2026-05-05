import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

export const metadata: Metadata = {
  title: '사업자 정보 | 차트팔자',
  description: '차트팔자 운영사 사업자 정보 안내',
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-b-0">
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
      <span className="text-sm text-gray-900">{children}</span>
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
    </LegalPageLayout>
  )
}
