'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'
import { LifeFortuneChart } from '@/components/legacy/LifeFortuneChart'
import type { SajuReportJson } from '@/types/saju-report'

interface SessionMeta {
  sessionId: string
  status: string
  hasSajuReport: boolean
  hasGemini: boolean
  isPaid: boolean
  sajuReportJson?: SajuReportJson | null
  inputRedacted?: { birthYear?: number } | null
}

export default function ChartPage() {
  const params = useParams()
  const sessionId = params.id as string
  const [session, setSession] = useState<SessionMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const n = window.sessionStorage.getItem('saju_user_name')
        if (n) setUserName(n)
      } catch { /* ignore */ }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled) setSession(data) })
      .catch(() => { if (!cancelled) setSession(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionId])

  if (loading) {
    return <MobileContainer wide><div className="py-6 text-center">불러오는 중...</div></MobileContainer>
  }

  if (!session) {
    return (
      <MobileContainer wide>
        <div className="py-6 text-center text-red-600">세션을 찾을 수 없습니다.</div>
        <Link href="/app/input" className="block text-center mt-2 text-blue-600">입력 페이지로</Link>
      </MobileContainer>
    )
  }

  const birthYear = session.inputRedacted?.birthYear ?? null
  const report = session.sajuReportJson ?? null

  return (
    <MobileContainer wide>
      <div className="py-4">
        <h1 className="text-2xl font-bold mb-2">인생 운세 차트</h1>
        <p className="text-sm text-gray-600 mb-4">
          대운과 연도별 운세 에너지를 한눈에 확인하세요
        </p>
        <LifeFortuneChart report={report} birthYear={birthYear} displayName="인생 총운" userName={userName}/>
        <div className="mt-6 text-center">
          <Link href={`/app/session/${sessionId}/summary`}
            className="text-sm text-gray-600 hover:text-gray-800 underline">
            분석 요약으로 돌아가기
          </Link>
        </div>
      </div>
    </MobileContainer>
  )
}
