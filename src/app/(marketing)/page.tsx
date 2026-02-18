import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'

export default function HomePage() {
  return (
    <MobileContainer>
      <div className="text-center py-12">
        <h1 className="text-3xl font-bold mb-4">사주 분석 서비스</h1>
        <p className="text-gray-600 mb-8">
          정확한 사주 분석으로 당신의 운명을 알아보세요
        </p>
        <Link
          href="/app/input"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          시작하기
        </Link>
      </div>
    </MobileContainer>
  )
}
