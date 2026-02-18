'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'
import { LifeFortuneChart } from '@/components/legacy/LifeFortuneChart'
import { FourPillarsCard } from '@/components/summary/FourPillarsCard'
import { ElementsBar } from '@/components/summary/ElementsBar'
import { IdentityCard } from '@/components/summary/IdentityCard'
import { StructuresCard } from '@/components/summary/StructuresCard'
import { DaewoonSewoonTimeline } from '@/components/summary/DaewoonSewoonTimeline'
import type { SajuReportJson } from '@/types/saju-report'

const SAJU_DRAFT_KEY = 'saju_input_draft'

interface SessionMeta {
  sessionId: string
  status: string
  hasSajuReport: boolean
  hasGemini: boolean
  isPaid: boolean
  sajuReportJson?: SajuReportJson | null
  inputRedacted?: { birthYear?: number } | null
}

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.id as string
  const [session, setSession] = useState<SessionMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [sajuLoading, setSajuLoading] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    fetchSession()
  }, [sessionId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(SAJU_DRAFT_KEY)
      const parsed = raw ? JSON.parse(raw) : {}
      setDraftReady(!!raw && !!parsed.birthDate)
      if (parsed.name) setUserName(parsed.name)
    } catch {
      setDraftReady(false)
    }
    try {
      const nameKey = 'saju_user_name'
      const stored = window.sessionStorage.getItem(nameKey)
      if (stored) setUserName(stored)
    } catch { /* ignore */ }
  }, [session?.status])

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setSession(data)
        return true
      }
      return false
    } catch (error) {
      console.error('fetchSession failed:', error)
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSajuStart = async () => {
    if (typeof window === 'undefined') return
    let draft: Record<string, unknown>
    try {
      const raw = window.sessionStorage.getItem(SAJU_DRAFT_KEY)
      if (!raw) { alert('입력 정보가 없습니다. 입력 페이지에서 먼저 작성해 주세요.'); return }
      draft = JSON.parse(raw)
    } catch { alert('저장된 입력 정보를 읽을 수 없습니다.'); return }

    setSajuLoading(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/saju`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthDate: draft.birthDate, birthTime: draft.birthTime, timeUnknown: draft.timeUnknown,
          gender: draft.gender, city: draft.city, useSolarTime: draft.useSolarTime,
          earlyZiTime: draft.earlyZiTime, utcOffset: draft.utcOffset,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        alert(err.error || '사주 분석을 시작할 수 없습니다.')
        return
      }
      const refreshed = await fetchSession()
      if (refreshed) { window.sessionStorage.removeItem(SAJU_DRAFT_KEY) }
      else { alert('계산은 완료되었으나 화면 새로고침이 필요합니다.') }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.'
      alert(`사주 분석 실패: ${msg}`)
    } finally { setSajuLoading(false) }
  }

  if (loading) {
    return <MobileContainer wide><div className="py-6 text-center">불러오는 중...</div></MobileContainer>
  }

  if (!session) {
    return (
      <MobileContainer wide>
        <div className="py-6 text-center text-red-600">세션을 찾을 수 없습니다.</div>
        <Link href="/app/input" className="text-blue-600 underline block text-center mt-2">입력 페이지로</Link>
      </MobileContainer>
    )
  }

  const isDraft = session.status === 'DRAFT'
  const hasReport = !!session.sajuReportJson
  const showSajuStart = isDraft && !hasReport && draftReady
  const showCards = session.status === 'SAJU_READY' && hasReport

  return (
    <MobileContainer wide={showCards}>
      <div className="py-4">
        {showSajuStart && (
          <div className="max-w-lg mx-auto bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <h2 className="text-lg font-semibold mb-2">사주 분석</h2>
            <p className="text-sm text-gray-600 mb-4">저장된 입력 정보로 사주를 계산합니다.</p>
            <button onClick={handleSajuStart} disabled={sajuLoading}
              className="w-full bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition disabled:opacity-50">
              {sajuLoading ? '계산 중...' : '사주 분석 시작'}
            </button>
          </div>
        )}

        {isDraft && !hasReport && !draftReady && (
          <div className="max-w-lg mx-auto bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
            <p className="text-sm text-gray-600 mb-4">분석할 정보가 없습니다. 입력 페이지에서 먼저 정보를 입력해 주세요.</p>
            <Link href="/app/input"
              className="block w-full text-center bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-900 transition">
              입력 페이지로
            </Link>
          </div>
        )}

        {showCards && (
          <>
            <div className="mb-6">
              <LifeFortuneChart
                report={session.sajuReportJson ?? null}
                birthYear={session.inputRedacted?.birthYear ?? null}
                displayName="인생 총운"
                userName={userName}
              />
              <div className="mt-3 text-center">
                <button onClick={() => router.push(`/app/session/${sessionId}/chart`)}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  인생차트 전체 보기 →
                </button>
              </div>
            </div>
            <div className="max-w-[520px] mx-auto space-y-4 mb-6">
              <FourPillarsCard report={session.sajuReportJson ?? null}/>
              <ElementsBar report={session.sajuReportJson ?? null}/>
              <IdentityCard report={session.sajuReportJson ?? null}/>
              <StructuresCard report={session.sajuReportJson ?? null}/>
              <DaewoonSewoonTimeline report={session.sajuReportJson ?? null}/>
            </div>
          </>
        )}
      </div>
    </MobileContainer>
  )
}
