'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { AppPageHeader } from '@/components/AppPageHeader'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { getGuestHeaders } from '@/lib/auth/guest'

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'general', label: '일반' },
  { key: 'payment', label: '결제/환불' },
  { key: 'bug', label: '오류 신고' },
  { key: 'account', label: '계정' },
  { key: 'etc', label: '기타' },
]

const MESSAGE_MAX = 2000

export default function InquiryPage() {
  const router = useRouter()
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = message.trim().length > 0 && !loading

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getGuestHeaders() },
        body: JSON.stringify({
          category,
          message: message.trim(),
          email: email.trim() || undefined,
          page: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '문의 접수에 실패했습니다.')
        return
      }
      setDone(true)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [canSubmit, category, message, email])

  return (
    <MobileContainer>
      <div className="min-h-screen pb-32">
        <AppPageHeader title="문의하기" />

        {done ? (
          <div className="px-4 py-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-lg font-bold text-cp-text">문의가 접수되었습니다</p>
            <p className="text-[13px] text-cp-muted mt-2 leading-relaxed">
              소중한 의견 감사합니다.<br />
              회신 이메일을 남기셨다면 확인 후 답변드리겠습니다.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-8 px-6 py-3 rounded-xl bg-cp-accent text-white text-sm font-semibold hover:bg-cp-accent/90 transition-colors"
            >
              돌아가기
            </button>
          </div>
        ) : (
          <div className="px-4 py-5 space-y-5">
            <div>
              <label className="text-[13px] font-semibold text-cp-text mb-2 block">문의 유형</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`px-3.5 py-2 rounded-full text-[13px] font-medium transition-all ${
                      category === c.key
                        ? 'bg-cp-accent text-white'
                        : 'bg-cp-surface text-cp-muted hover:bg-cp-border'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-semibold text-cp-text mb-2 block">문의 내용</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                placeholder="문의하실 내용을 자세히 적어주세요."
                rows={7}
                className="w-full px-4 py-3 rounded-xl border border-cp-border bg-cp-input text-sm text-cp-text placeholder-cp-muted focus:outline-none focus:border-cp-line resize-none leading-relaxed"
              />
              <div className="text-right text-[11px] text-cp-muted mt-1">{message.length} / {MESSAGE_MAX}</div>
            </div>

            <div>
              <label className="text-[13px] font-semibold text-cp-text mb-2 block">
                회신 이메일 <span className="text-cp-muted font-normal">(선택)</span>
              </label>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="답변 받을 이메일 주소"
                className="w-full px-4 py-3 rounded-xl border border-cp-border bg-cp-input text-sm text-cp-text placeholder-cp-muted focus:outline-none focus:border-cp-line"
              />
              <p className="text-[11px] text-cp-muted mt-1.5">답변이 필요하시면 이메일을 남겨주세요.</p>
            </div>

            {error && (
              <div className="p-3 bg-cp-line/10 rounded-xl text-sm text-cp-up">{error}</div>
            )}
          </div>
        )}

        <MinimalLegalFooter className="mt-8" />
      </div>

      {!done && (
        <div className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-[446px] p-4 bg-cp-raised border-t border-cp-border">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-full py-4 rounded-2xl text-base font-bold transition-all ${
                canSubmit
                  ? 'bg-cp-accent text-white active:scale-[0.98]'
                  : 'bg-cp-border text-cp-muted cursor-not-allowed'
              }`}
            >
              {loading ? '접수 중...' : '문의 보내기'}
            </button>
          </div>
        </div>
      )}
    </MobileContainer>
  )
}
