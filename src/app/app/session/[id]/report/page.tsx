'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

interface SessionMeta {
  sessionId: string
  status: string
  hasSajuReport: boolean
  hasGemini: boolean
  isPaid: boolean
}

export default function ReportPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const [session, setSession] = useState<SessionMeta | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSession()
  }, [sessionId])

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setSession(data)
      }
    } catch (error) {
      console.error('Error fetching session:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <MobileContainer>
        <div className="py-6 text-center">로딩 중...</div>
      </MobileContainer>
    )
  }

  if (!session) {
    return (
      <MobileContainer>
        <div className="py-6 text-center text-red-600">세션을 찾을 수 없습니다.</div>
      </MobileContainer>
    )
  }

  return (
    <MobileContainer>
      <div className="py-6">
        <h1 className="text-2xl font-bold mb-6">사주 리포트</h1>

        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-gray-600 text-center py-12">
            (Day 3) Premium-gated placeholder
            <br />
            <br />
            사주 리포트가 여기에 표시됩니다.
          </p>
        </div>
      </div>
    </MobileContainer>
  )
}
