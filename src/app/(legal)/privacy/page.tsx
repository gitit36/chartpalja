import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/LegalPageLayout'
import { BUSINESS_INFO as B } from '@/lib/legal/business-info'

export const metadata: Metadata = {
  title: '개인정보처리방침 | 차트팔자',
  description: '차트팔자 개인정보 처리방침',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-bold text-cp-text mt-7 mb-2">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-cp-text leading-relaxed">{children}</p>
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 space-y-1.5 text-sm text-cp-text leading-relaxed">{children}</ul>
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="개인정보처리방침" effectiveDate={B.privacyEffectiveDate}>
      <P>
        {B.companyName}(이하 &lsquo;회사&rsquo;)은 회원의 개인정보를 중요하게 생각하며, 「개인정보 보호법」 등 관련 법령을 준수합니다.
      </P>

      <H2>1. 수집하는 개인정보 항목 및 수집 방법</H2>
      <P>회사는 서비스 제공을 위해 아래 정보를 수집합니다.</P>
      <Ul>
        <li>회원가입(카카오 로그인): 카카오 회원번호, 닉네임, 이메일(선택 동의 시), 프로필 이미지(선택 동의 시)</li>
        <li>사주 분석 입력 정보: 이름(또는 별칭), 생년월일, 출생시간, 성별</li>
        <li>결제 정보: 결제수단 종류, 결제 승인 정보 (카드번호 등 민감 정보는 PG사가 직접 처리하며 회사는 보관하지 않습니다)</li>
        <li>자동 수집: 접속 로그, 쿠키, 기기 정보, IP 주소 (서비스 운영 및 부정이용 방지 목적)</li>
      </Ul>

      <H2>2. 개인정보의 처리 목적</H2>
      <Ul>
        <li>회원 식별, 본인 인증 및 회원 관리</li>
        <li>사주 분석 차트 및 운세 해설 제공</li>
        <li>이용권 결제 및 환불 처리</li>
        <li>고객 문의 응대 및 분쟁 처리</li>
        <li>서비스 안정성 확보, 부정이용 방지</li>
      </Ul>

      <H2>3. 개인정보의 보유 및 이용기간</H2>
      <Ul>
        <li>회원 정보: 회원 탈퇴 시까지</li>
        <li>전자상거래법에 따른 보관: 계약·청약철회 기록 5년, 결제·재화 공급 기록 5년, 소비자 불만·분쟁 처리 기록 3년</li>
        <li>접속 로그(통신비밀보호법): 3개월</li>
      </Ul>

      <H2>4. 제3자 제공</H2>
      <P>회사는 원칙적으로 회원의 개인정보를 외부에 제공하지 않습니다. 다만 법령에 의한 경우 또는 회원의 동의가 있는 경우에 한해 제공합니다.</P>

      <H2>5. 개인정보 처리의 위탁</H2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y border-cp-border">
              <th className="px-2 py-2 text-left font-semibold">수탁업체</th>
              <th className="px-2 py-2 text-left font-semibold">위탁 업무</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-cp-border">
              <td className="px-2 py-2">PortOne (NHN KCP 등)</td>
              <td className="px-2 py-2">결제 처리</td>
            </tr>
            <tr className="border-b border-cp-border">
              <td className="px-2 py-2">Google LLC</td>
              <td className="px-2 py-2">AI 운세 해설 생성 (Gemini API)</td>
            </tr>
            <tr>
              <td className="px-2 py-2">Railway Corp.</td>
              <td className="px-2 py-2">서버 호스팅 및 데이터베이스 운영</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2>6. 개인정보의 국외 이전</H2>
      <P>운세 해설 생성 및 서버 운영을 위해 일부 정보가 국외로 이전될 수 있습니다.</P>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-y border-cp-border">
              <th className="px-2 py-2 text-left font-semibold">이전받는 자</th>
              <th className="px-2 py-2 text-left font-semibold">국가</th>
              <th className="px-2 py-2 text-left font-semibold">이전 항목</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-cp-border">
              <td className="px-2 py-2">Google LLC</td>
              <td className="px-2 py-2">미국</td>
              <td className="px-2 py-2">사주 입력 정보(이름·생년월일·시간·성별)</td>
            </tr>
            <tr>
              <td className="px-2 py-2">Railway Corp.</td>
              <td className="px-2 py-2">미국</td>
              <td className="px-2 py-2">서비스 이용 데이터 일체</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2>7. 개인정보의 파기</H2>
      <P>
        보유기간이 종료되거나 처리 목적이 달성된 개인정보는 지체 없이 파기합니다. 전자적 파일은 복구 불가능한 방법으로 영구 삭제하며, 종이 문서는 분쇄 또는 소각합니다.
      </P>

      <H2>8. 회원의 권리</H2>
      <P>회원은 언제든지 본인의 개인정보를 조회·수정·삭제하거나 처리 정지를 요청할 수 있으며, 회원 탈퇴를 통해 개인정보의 즉시 파기를 요청할 수 있습니다.</P>

      <H2>9. 안전성 확보 조치</H2>
      <Ul>
        <li>개인정보 처리 시스템 접근 권한의 최소화 및 접근 통제</li>
        <li>비밀번호 등 인증 정보의 암호화 저장 및 전송</li>
        <li>접속 기록의 보관·점검</li>
      </Ul>

      <H2>10. 만 14세 미만 아동의 개인정보</H2>
      <P>회사는 만 {B.minAge}세 미만 아동의 회원가입을 받지 않습니다.</P>

      <H2>11. 개인정보 보호책임자</H2>
      <Ul>
        <li>책임자: {B.privacyOfficerName} ({B.privacyOfficerTitle})</li>
        <li>이메일: {B.privacyOfficerEmail}</li>
      </Ul>

      <H2>12. 변경 고지</H2>
      <P>본 방침은 법령 또는 서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내 공지를 통해 알립니다.</P>
    </LegalPageLayout>
  )
}
