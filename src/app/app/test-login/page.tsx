'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

/**
 * 결제대행사(PG) 심사용 테스트 로그인 페이지.
 * 카카오 로그인 없이 발급된 ID/PW 로 로그인하여 서비스/결제 흐름을 확인할 수 있다.
 */
export default function TestLoginPage() {
  const router = useRouter()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, password }),
      })
      if (res.ok) {
        router.replace('/app/list')
        return
      }
      if (res.status === 404) {
        setError('테스트 로그인이 비활성화되어 있습니다.')
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      }
    } catch {
      setError('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <MobileContainer>
      <div className="px-6 pt-16 pb-32 min-h-screen flex flex-col">
        <h1 className="text-xl font-bold text-gray-900">테스트 로그인</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          심사용 테스트 계정으로 로그인합니다. 발급받은 아이디와 비밀번호를 입력해 주세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-1.5 block">아이디</span>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="아이디"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-gray-700 mb-1.5 block">비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="비밀번호"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400"
            />
          </label>

          {error && (
            <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={!id || !password || loading}
            className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
              id && password && !loading
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </MobileContainer>
  )
}
