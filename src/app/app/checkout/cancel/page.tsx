'use client'

import { ResultScreen } from '@/components/ResultScreen'

export default function CancelPage() {
  return (
    <ResultScreen
      variant="cancel"
      title="결제가 취소되었어요"
      description="언제든 다시 결제할 수 있어요."
      actions={[
        { label: '다시 결제하기', href: '/app/checkout', primary: true },
        { label: '목록으로 돌아가기', href: '/app/list' },
      ]}
    />
  )
}
