import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { LegalH2, LegalP, LegalLead, LegalUl, LegalSection } from '@/components/legal/LegalProse'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

export const metadata: Metadata = {
  title: '환불정책 | 차트팔자',
  description: '차트팔자 이용권 환불정책',
}

export default function RefundPage() {
  return (
    <LegalPageLayout title="환불정책" effectiveDate={B.refundEffectiveDate} currentPath="/refund">
      <LegalLead>
        주(株) 이용권은 디지털 상품이에요. 환불 가능·불가 조건을 미리 확인해 주시면 좋아요.
        신청은{' '}
        <a href={`mailto:${B.email}`} className="text-cp-accent font-medium hover:underline">
          {B.email}
        </a>
        {' '}또는{' '}
        <Link href="/app/inquiry" className="text-cp-accent font-medium hover:underline">
          문의하기
        </Link>
        로 남겨 주세요.
      </LegalLead>

      <LegalSection>
        <LegalH2>1. 서비스 제공 기간</LegalH2>
        <LegalP>
          본 서비스의 이용권은 비실물(디지털) 상품으로, {B.serviceDeliveryPeriod}.
          결제가 완료되면 구매한 이용권이 회원 계정에 자동 지급되어 즉시 해설 기능을 이용하실 수 있습니다.
          (서비스 제공기간: {B.serviceProvisionWindow})
        </LegalP>
      </LegalSection>

      <LegalSection>
        <LegalH2>2. 이용권의 사용처 및 성격</LegalH2>
        <LegalUl>
          <li>{B.ticketUsageScope}</li>
          <li>{B.ticketRestriction}</li>
          <li>결제 완료 즉시 회원 계정에 자동 지급되어 바로 사용할 수 있습니다.</li>
        </LegalUl>
      </LegalSection>

      <LegalSection>
        <LegalH2>3. 환불 가능 조건</LegalH2>
        <LegalUl>
          <li>
            사용하지 않은 이용권에 대해 결제일로부터 7일 이내 환불을 요청하시면,
            유료 구입분에 한해 결제 금액을 환불해 드립니다.
          </li>
        </LegalUl>
      </LegalSection>

      <LegalSection>
        <LegalH2>4. 환불 불가 사유</LegalH2>
        <LegalUl>
          <li>이미 해설에 1회 이상 사용한 이용권 (디지털 콘텐츠 특성상 환불 불가)</li>
          <li>무료 적립·이벤트·프로모션 등으로 제공된, 유료 구입분이 아닌 이용권</li>
          <li>유효기간({B.ticketValidityMonths}개월)이 경과하여 자동 소멸된 이용권</li>
        </LegalUl>
      </LegalSection>

      <LegalSection>
        <LegalH2>5. 환불 신청 방법</LegalH2>
        <LegalP>
          고객센터(
          <a href={`mailto:${B.email}`} className="text-cp-accent font-medium hover:underline">
            {B.email}
          </a>
          {' / '}
          <a href={`tel:${B.phone}`} className="text-cp-accent font-medium hover:underline">
            {B.phone}
          </a>
          )로 결제일, 결제수단, 회원 정보(카카오 닉네임 또는 이메일)를 알려주시면
          영업일 기준 3~5일 이내에 처리됩니다.
        </LegalP>
      </LegalSection>

      <LegalSection>
        <LegalH2>6. 회사 귀책 사유로 인한 환불</LegalH2>
        <LegalP>
          시스템 장애, 서비스 종료 등 회사의 귀책 사유로 이용권을 정상적으로 이용할 수 없는 경우,
          사용 여부와 관계없이 잔여 이용권에 상응하는 금액을 환불합니다.
        </LegalP>
      </LegalSection>

      <LegalSection>
        <LegalH2>7. 분쟁 해결</LegalH2>
        <LegalP>
          환불 관련 분쟁은 한국소비자원의 분쟁조정 절차 및 「전자상거래 등에서의 소비자보호에 관한 법률」을 따릅니다.
        </LegalP>
      </LegalSection>
    </LegalPageLayout>
  )
}
