'use client'

import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

export default function CancelPage() {
  const router = useRouter()

  return (
    <MobileContainer>
      <div className="px-4 pt-16 pb-8 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-6">↩️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">결제가 취소되었어요</h1>
        <p className="text-gray-500 text-sm mb-8">언제든 다시 결제할 수 있어요.</p>

        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => router.push('/app/checkout')}
            className="w-full py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
          >
            다시 결제하기
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
