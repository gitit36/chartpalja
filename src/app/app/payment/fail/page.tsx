import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'

export default function PaymentFailPage() {
  return (
    <MobileContainer>
      <div className="py-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <h1 className="text-xl font-bold mb-4">결제에 실패했습니다</h1>
          <p className="text-gray-600 mb-6">
            결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.
          </p>
          <Link
            href="/app/input"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            돌아가기
          </Link>
        </div>
      </div>
    </MobileContainer>
  )
}
