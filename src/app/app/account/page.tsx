'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

interface Session {
  id: string
  status: string
  createdAt: string
}

export default function AccountPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ nickname?: string } | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Try to fetch user sessions (this will fail if not logged in)
      const response = await fetch('/api/sessions/my')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
        setUser(data.user || null)
      } else if (response.status === 401) {
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check error:', error)
      setUser(null)
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

  if (!user) {
    return (
      <MobileContainer>
        <div className="py-6">
          <h1 className="text-2xl font-bold mb-6">내 계정</h1>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <p className="text-gray-600 mb-4">로그인이 필요합니다.</p>
            <button
              onClick={() => router.push('/app/input')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              로그인하기
            </button>
          </div>
        </div>
      </MobileContainer>
    )
  }

  return (
    <MobileContainer>
      <div className="py-6">
        <h1 className="text-2xl font-bold mb-6">내 계정</h1>

        {user.nickname && (
          <div className="mb-6">
            <p className="text-lg font-semibold">안녕하세요, {user.nickname}님</p>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">내 세션</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-600 text-sm">세션이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-lg p-4 shadow-sm border cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/app/session/${session.id}/summary`)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{session.id.slice(0, 8)}...</p>
                      <p className="text-xs text-gray-500">{session.status}</p>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(session.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileContainer>
  )
}
