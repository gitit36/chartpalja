'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

function FailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const message = searchParams.get('message') || '결제 처리 중 문제가 발생했습니다.'

  return (
    <MobileContainer>
      <div className="px-4 pt-16 pb-8 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-6">😔</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">결제에 실패했어요</h1>
        <p className="text-gray-500 text-sm mb-8">{message}</p>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => router.push('/app/checkout')}
            className="w-full py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
          >
            다시 시도하기
          </button>
          <button
            onClick={() => router.push('/app/list')}
            className="w-full py-3 rounded-2xl text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    </MobileContainer>
  )
}

export default function FailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">로딩 중...</div>}>
      <FailContent />
    </Suspense>
  )
}
