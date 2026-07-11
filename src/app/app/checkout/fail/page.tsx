'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ResultScreen } from '@/components/ResultScreen'
import { mapPaymentError } from '@/lib/payment/errorMapping'

function FailContent() {
  const searchParams = useSearchParams()
  const raw = searchParams.get('message')
  const code = searchParams.get('code')
  const { short, hint } = mapPaymentError([code, raw].filter(Boolean).join(' '))

  return (
    <ResultScreen
      variant="fail"
      title={short}
      description={hint}
      actions={[
        { label: '다시 시도하기', href: '/app/checkout', primary: true },
        { label: '목록으로 돌아가기', href: '/app/list' },
      ]}
    />
  )
}

export default function FailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-cp-muted">로딩 중...</div>}>
      <FailContent />
    </Suspense>
  )
}
