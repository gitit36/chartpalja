'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'

interface InviteMeta {
  inviterName: string
  inviterAge: number | null
  inviterGender: string
}

export default function CompatJoinPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const [meta, setMeta] = useState<InviteMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/compat/invite/${token}`)
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? '초대를 불러올 수 없습니다')
        setMeta({
          inviterName: d.inviterName,
          inviterAge: d.inviterAge ?? null,
          inviterGender: d.inviterGender ?? 'male',
        })
      })
      .catch(e => setError(e instanceof Error ? e.message : '오류가 발생했습니다'))
      .finally(() => setLoading(false))
  }, [token])

  const goInput = () => {
    router.push(`/app/input?compatInvite=${encodeURIComponent(token)}`)
  }

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-cp-bg to-cp-surface px-6 py-10">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-cp-muted text-sm">불러오는 중…</div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h1 className="text-xl font-bold text-cp-text mb-2">초대 링크를 사용할 수 없어요</h1>
            <p className="text-sm text-cp-muted mb-8">{error}</p>
            <Link href="/app/input" className="text-sm text-cp-line font-semibold">내 차트 만들기 →</Link>
          </div>
        ) : meta ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-cp-line font-semibold mb-2">궁합 초대</p>
            <h1 className="text-2xl font-bold text-cp-text mb-3">
              {meta.inviterName}님이 궁합을 보고 싶어해요
            </h1>
            <p className="text-sm text-cp-muted leading-relaxed mb-2">
              내 사주만 입력하면 서로 차트를 겹쳐볼 수 있어요.
            </p>
            <p className="text-xs text-cp-muted mb-10">
              {meta.inviterGender === 'female' ? '여성' : '남성'}
              {meta.inviterAge != null ? ` · ${meta.inviterAge}세` : ''}
            </p>
            <button
              type="button"
              onClick={goInput}
              className="w-full max-w-sm py-3.5 rounded-xl text-sm font-bold text-white bg-cp-accent shadow-lg active:scale-[0.98] transition-all"
            >
              사주 입력하고 연결하기
            </button>
            <p className="text-[11px] text-cp-muted mt-4">유료 해설은 각자 생성해요</p>
          </div>
        ) : null}
      </div>
    </MobileContainer>
  )
}
