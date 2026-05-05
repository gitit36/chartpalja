import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

export const metadata: Metadata = {
  title: '이용약관 | 차트팔자',
  description: '차트팔자 서비스 이용약관',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-gray-900 mt-7 mb-2">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700 leading-relaxed">{children}</p>
}
function Ol({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal pl-5 space-y-1.5 text-sm text-gray-700 leading-relaxed">{children}</ol>
}

export default function TermsPage() {
  return (
    <LegalPageLayout title="이용약관" effectiveDate={B.termsEffectiveDate}>
      <H2>제1조 (목적)</H2>
      <P>
        본 약관은 {B.companyName}(이하 &lsquo;회사&rsquo;)이 운영하는 {B.serviceName} 서비스의 이용 조건과 절차를 규정합니다.
      </P>

      <H2>제2조 (정의)</H2>
      <Ol>
        <li>&lsquo;서비스&rsquo;란 회사가 운영하는 사주 분석 차트 및 운세 해설 서비스를 말합니다.</li>
        <li>&lsquo;회원&rsquo;이란 본 약관에 동의하고 서비스에 가입한 자를 말합니다.</li>
        <li>&lsquo;이용권&rsquo;이란 유료 결제로 운세 해설 또는 기간 해설을 이용할 수 있는 회수권을 말합니다.</li>
      </Ol>

      <H2>제3조 (약관의 효력 및 변경)</H2>
      <Ol>
        <li>본 약관은 서비스 내 게시함으로써 효력이 발생합니다.</li>
        <li>회사는 관련 법령을 위배하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 적용일 7일 전부터 공지합니다. 회원에게 불리한 변경의 경우 30일 전부터 공지합니다.</li>
      </Ol>

      <H2>제4조 (회원가입)</H2>
      <Ol>
        <li>가입은 카카오 소셜 로그인 등 회사가 정한 방식으로 이루어집니다.</li>
        <li>만 {B.minAge}세 미만은 회원으로 가입할 수 없습니다.</li>
      </Ol>

      <H2>제5조 (서비스의 제공 및 중단)</H2>
      <Ol>
        <li>서비스는 연중무휴 24시간 제공함을 원칙으로 합니다.</li>
        <li>설비 점검, 외부 시스템 장애, 천재지변 등 불가피한 사유가 있는 경우 서비스 제공을 일시 중단할 수 있으며, 이로 인한 손해에 대해 회사는 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.</li>
        <li>회사는 경영상 사유로 서비스를 종료할 수 있으며, 이 경우 30일 전까지 공지합니다.</li>
      </Ol>

      <H2>제6조 (콘텐츠의 성격)</H2>
      <P>
        서비스에서 제공하는 사주 분석 및 운세 해설은 참고용 콘텐츠이며, 의료·법률·금융 등 전문 자문을 대체하지 않습니다. 회원이 본 콘텐츠를 근거로 한 의사결정의 결과에 대해 회사는 책임을 지지 않습니다.
      </P>

      <H2>제7조 (이용권 및 결제)</H2>
      <Ol>
        <li>이용권은 신용/체크카드, 카카오페이, 토스페이, 해외카드 등 회사가 제공하는 방법으로 결제할 수 있습니다.</li>
        <li>결제는 PG사를 통해 처리되며, 회사는 결제 정보(카드번호 등)를 직접 보관하지 않습니다.</li>
        <li>이용권 유효기간은 결제일로부터 {B.ticketValidityMonths}개월(1년)이며, 유효기간 경과 시 자동 소멸됩니다.</li>
      </Ol>

      <H2>제8조 (환불)</H2>
      <Ol>
        <li>1회도 사용하지 않은 이용권은 결제일로부터 7일 이내 100% 환불됩니다.</li>
        <li>1회라도 사용한 이용권은 디지털 콘텐츠의 특성상 환불이 제한됩니다.</li>
        <li>환불 신청은 {B.email}로 접수합니다. 자세한 내용은 환불정책을 따릅니다.</li>
      </Ol>

      <H2>제9조 (회원의 의무)</H2>
      <P>회원은 타인의 정보를 도용하거나, 서비스 콘텐츠를 무단 복제·배포하거나, 서비스 운영을 방해하는 행위를 하여서는 안 됩니다.</P>

      <H2>제10조 (지식재산권)</H2>
      <P>
        서비스에서 제공하는 차트, 텍스트, 디자인 등의 저작권은 회사에 귀속됩니다. 회원이 입력한 사주 정보(이름, 생년월일 등)에 대한 권리는 회원에게 있습니다.
      </P>

      <H2>제11조 (회원 탈퇴)</H2>
      <P>
        회원은 언제든지 탈퇴할 수 있으며, 탈퇴 시 개인정보는 개인정보처리방침에 따라 파기됩니다. 단, 관련 법령에 따라 일정 기간 보관해야 하는 정보는 해당 기간 동안 보관 후 파기됩니다.
      </P>

      <H2>제12조 (분쟁 해결)</H2>
      <P>
        회사와 회원 간 분쟁은 상호 협의를 원칙으로 하며, 협의가 어려운 경우 관련 법령 및 한국소비자원의 분쟁조정 절차를 따를 수 있습니다.
      </P>

      <H2>부칙</H2>
      <P>본 약관은 {B.termsEffectiveDate}부터 시행합니다.</P>
    </LegalPageLayout>
  )
}
