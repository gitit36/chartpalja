'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MobileContainer } from '@/components/MobileContainer'
import { SajuCharacterAvatar, normalizeElement } from '@/components/SajuCharacterAvatar'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { Toast } from '@/components/Toast'
import { Sparkline } from '@/components/Sparkline'
import { getGuestHeaders } from '@/lib/auth/guest'

interface SajuCard {
  id: string
  name: string
  gender: string
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  isLunar: boolean
  createdAt: string
  dayElement?: string | null
  isRepresentative?: boolean
}

interface DailyEntry {
  id: string
  name: string
  score: number | null
  grade: string | null
  delta: number
  direction: 'up' | 'down' | 'flat'
  domains: Record<string, number> | null
  standoutDomain: string | null
  standoutScore: number | null
  series: (number | null)[]
}

interface DailyRepresentative {
  id: string
  name: string
  score: number
  delta: number
  direction: 'up' | 'down' | 'flat'
  bestDomain: string | null
  bestScore: number | null
  worstDomain: string | null
  worstScore: number | null
  comment: string
}

function getHeaders(): Record<string, string> {
  return getGuestHeaders()
}

// 클라이언트 사이드 네비게이션(사주 상세 → 뒤로가기) 동안 살아있는 모듈 캐시.
// 재진입 시 빈 화면 깜빡임 없이 즉시 직전 결과를 보여주고 백그라운드로 갱신한다.
interface DailyCacheShape {
  entries: Record<string, DailyEntry>
  representative: DailyRepresentative | null
  today: string
}
let dailyMemCache: DailyCacheShape | null = null
let listMemCache: SajuCard[] | null = null

function deltaText(delta: number): string {
  if (delta > 0) return `▲${delta}`
  if (delta < 0) return `▼${Math.abs(delta)}`
  return '–'
}

function deltaColor(direction: 'up' | 'down' | 'flat'): string {
  if (direction === 'up') return 'text-red-500'
  if (direction === 'down') return 'text-blue-500'
  return 'text-gray-400'
}

export default function SajuListPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<SajuCard[]>(() => listMemCache ?? [])
  const [loading, setLoading] = useState(() => listMemCache == null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SajuCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [welcomeToast, setWelcomeToast] = useState(false)
  const [daily, setDaily] = useState<Record<string, DailyEntry>>(() => dailyMemCache?.entries ?? {})
  const [representative, setRepresentative] = useState<DailyRepresentative | null>(() => dailyMemCache?.representative ?? null)
  const [todayStr, setTodayStr] = useState<string>(() => dailyMemCache?.today ?? '')
  const [sortByScore, setSortByScore] = useState(false)
  // "오늘 운 순" 정렬은 토글하는 순간 보유한 점수를 스냅샷해서 고정한다.
  // 백그라운드 폴링으로 점수가 더 채워져도 순서가 실시간으로 흔들리지 않게 하기 위함.
  const [scoreOrder, setScoreOrder] = useState<Record<string, number> | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('welcome') === '1') {
      setWelcomeToast(true)
      url.searchParams.delete('welcome')
      const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '')
      window.history.replaceState({}, '', clean)
    }
  }, [])

  const fetchDaily = useCallback(async (attempt = 0) => {
    try {
      const res = await fetch('/api/saju/daily', { headers: getHeaders(), cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, DailyEntry> = {}
        for (const d of (data.entries || []) as DailyEntry[]) map[d.id] = d
        setDaily(map)
        setRepresentative(data.representative ?? null)
        if (typeof data.today === 'string') setTodayStr(data.today)
        dailyMemCache = {
          entries: map,
          representative: data.representative ?? null,
          today: typeof data.today === 'string' ? data.today : (dailyMemCache?.today ?? ''),
        }
        // 엔트리가 많으면 서버가 일부만 계산하고 pending=true를 준다.
        // 캐시가 다 찰 때까지 이어받아 폴링 (과도한 반복은 방지).
        if (data.pending && attempt < 12) {
          setTimeout(() => fetchDaily(attempt + 1), 2500)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/saju', { headers: getHeaders(), cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        const list = (data.entries || []) as SajuCard[]
        setEntries(list)
        listMemCache = list
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList(); fetchDaily() }, [fetchList, fetchDaily])

  // 정렬 변경 시 재계산/로딩 없이, 스냅샷된 점수로 한 번에 DESC 정렬만 수행.
  // (entries는 서버에서 등록순으로 오므로 동점은 안정 정렬로 등록순 유지)
  const sortedEntries = useMemo(() => {
    if (!sortByScore || !scoreOrder) return entries
    return [...entries].sort(
      (a, b) => (scoreOrder[b.id] ?? -1) - (scoreOrder[a.id] ?? -1),
    )
  }, [entries, sortByScore, scoreOrder])

  const enableScoreSort = () => {
    const snap: Record<string, number> = {}
    for (const e of entries) snap[e.id] = daily[e.id]?.score ?? -1
    setScoreOrder(snap)
    setSortByScore(true)
  }

  const handleSetRepresentative = async (id: string) => {
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/saju/${id}`, {
        method: 'PATCH',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ setRepresentative: true }),
      })
      if (res.ok) {
        setEntries((prev) => {
          const next = prev.map((e) => ({ ...e, isRepresentative: e.id === id }))
          listMemCache = next
          return next
        })
        setToastMsg('대표 사주로 설정했어요.')
        fetchDaily()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/saju/${deleteTarget.id}`, { method: 'DELETE', headers: getHeaders() })
    setDeleteTarget(null)
    setMenuOpen(null)
    setDeleting(false)
    fetchList()
    fetchDaily()
  }

  const formatDate = (d: string) => d.replace(/-/g, '.')

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <div className="w-8" />
          <div className="flex-1 flex items-center justify-center gap-2.5">
            <Image src="/svc_logo.png" alt="차트8자" width={32} height={29} />
            <h1 className="text-xl font-bold text-gray-900">내 사주 목록</h1>
          </div>
          <HamburgerMenu />
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-24">
        {loading ? (
          <div className="text-center text-gray-400 py-16">불러오는 중...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#x1F52E;</div>
            <p className="text-gray-500 text-sm mb-1">아직 등록된 사주가 없어요</p>
            <p className="text-gray-400 text-xs">아래 버튼을 눌러 사주를 추가해보세요</p>
          </div>
        ) : (
          <>
            {/* 대표 차트 — 오늘의 나 */}
            {representative && (
              <Link
                href={`/app/saju/${representative.id}`}
                prefetch={true}
                className="block mb-4 rounded-2xl p-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md active:scale-[0.99] transition-transform"
              >
                <div className="flex justify-between gap-3">
                  {/* 좌측: 타이틀 → 점수 → 좋은/조심할 운 (균일 간격) */}
                  <div className="flex flex-col gap-2.5 min-w-0">
                    <span className="text-sm font-semibold text-white/90">{representative.name}님의 오늘 운세</span>
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-4xl font-extrabold leading-none">
                        {representative.score}<span className="text-lg font-bold ml-0.5">점</span>
                      </span>
                      <span className="text-xs text-white/70 truncate">
                        {representative.delta === 0 ? (
                          <>· 어제와 비슷해요</>
                        ) : (
                          <>· 어제보다 <span className={`font-bold ${representative.direction === 'down' ? 'text-sky-200' : 'text-rose-200'}`}>{deltaText(representative.delta)}</span></>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {representative.bestDomain && representative.bestScore != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
                          <span className="text-emerald-200">좋은 운</span>
                          <span className="font-bold">{representative.bestDomain} {representative.bestScore}점</span>
                        </span>
                      )}
                      {representative.worstDomain && representative.worstScore != null && representative.worstDomain !== representative.bestDomain && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">
                          <span className="text-amber-200">조심할 운</span>
                          <span className="font-bold">{representative.worstDomain} {representative.worstScore}점</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 우측: 날짜(상단 고정) → 스파크라인(아래로 채움) */}
                  <div className="flex flex-col items-end gap-2.5 shrink-0">
                    <span className="text-xs text-white/60">{todayStr ? todayStr.slice(5).replace('-', '.') : ''}</span>
                    <Sparkline data={daily[representative.id]?.series ?? []} trend={representative.direction} color="#ffffff" width={120} height={72} />
                  </div>
                </div>
              </Link>
            )}

            {/* 정렬 토글 */}
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-gray-400">{entries.length}개</span>
              <div className="flex bg-gray-100 rounded-full p-0.5 text-xs font-medium">
                <button
                  onClick={() => setSortByScore(false)}
                  className={`px-3 py-1 rounded-full transition-colors ${!sortByScore ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                >
                  등록순
                </button>
                <button
                  onClick={enableScoreSort}
                  className={`px-3 py-1 rounded-full transition-colors ${sortByScore ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}
                >
                  오늘 운 순
                </button>
              </div>
            </div>

            <div className="space-y-3">
            {sortedEntries.map((e) => {
              const d = daily[e.id]
              return (
              <div
                key={e.id}
                className="relative flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:bg-gray-50 transition-colors"
              >
                <Link
                  href={`/app/saju/${e.id}`}
                  prefetch={true}
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                >
                  <SajuCharacterAvatar
                    gender={e.gender === 'female' ? 'female' : 'male'}
                    element={normalizeElement(e.dayElement ?? undefined)}
                    personId={e.id}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-gray-900 truncate">{e.name}</span>
                      <span className="text-xs text-gray-400">&middot;</span>
                      <span className="text-sm text-gray-500 shrink-0">{e.gender === 'female' ? '여성' : '남성'}</span>
                      {e.isRepresentative && (
                        <span className="text-amber-400 text-xs leading-none shrink-0" title="대표 사주" aria-label="대표 사주">&#x2B51;</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {e.isLunar ? '음력' : '양력'} {formatDate(e.birthDate)}
                      {e.timeUnknown ? ' · 시간 모름' : e.birthTime ? ` ${e.birthTime}` : ''}
                    </div>
                  </div>

                  {/* 일별 점수 블록 (주식 watchlist 느낌) */}
                  <div className="shrink-0 flex items-center gap-2 pr-5">
                    {d?.score != null && <Sparkline data={d.series} trend={d.direction} />}
                    <div className="text-right min-w-[40px]">
                      {d?.score != null ? (
                        <>
                          <div className="flex items-center justify-end">
                            <span className="text-lg font-bold text-gray-900 leading-none">{d.score}</span>
                          </div>
                          <div className={`text-xs font-semibold mt-0.5 ${deltaColor(d.direction)}`}>
                            {deltaText(d.delta)}
                          </div>
                        </>
                      ) : (
                        <div className="text-gray-300 text-sm">··</div>
                      )}
                    </div>
                  </div>
                </Link>

                <button
                  onClick={(ev) => { ev.stopPropagation(); setMenuOpen(menuOpen === e.id ? null : e.id) }}
                  className="absolute top-2 right-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"
                >
                  &#x22EE;
                </button>

                {menuOpen === e.id && (
                  <>
                    <div className="fixed inset-0 z-[5]" onClick={() => setMenuOpen(null)}/>
                    <div className="absolute top-10 right-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden w-max">
                      <button
                        onClick={() => { if (!e.isRepresentative) handleSetRepresentative(e.id) }}
                        disabled={e.isRepresentative}
                        className={`block w-full text-center px-4 py-2.5 text-base ${e.isRepresentative ? 'text-amber-400 cursor-default' : 'text-gray-400 hover:bg-gray-50'}`}
                        aria-label={e.isRepresentative ? '현재 대표 사주' : '대표 사주로 설정'}
                        title={e.isRepresentative ? '현재 대표 사주' : '대표 사주로 설정'}
                      >
                        &#x2B51;
                      </button>
                      <button
                        onClick={() => { setMenuOpen(null); router.push(`/app/input?edit=${e.id}`) }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => { setMenuOpen(null); setDeleteTarget(e) }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
              )
            })}
            </div>
          </>
        )}
      </div>

        <MinimalLegalFooter />
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto max-w-[446px] p-4 bg-white border-t border-gray-100">
          <Link
            href="/app/input"
            prefetch={true}
            className="flex w-full items-center justify-center py-4 rounded-2xl text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
          >
            + 사주 추가하기
          </Link>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={ev => ev.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">사주 삭제</h3>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{deleteTarget.name}</span>의 사주 정보를 정말 삭제하시겠어요?
              </p>
              <p className="text-xs text-gray-400 mt-1">삭제된 데이터는 복구할 수 없습니다.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-100">
              <button disabled={deleting} onClick={() => setDeleteTarget(null)}
                className="py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100">
                취소
              </button>
              <button disabled={deleting} onClick={handleDeleteConfirm}
                className="py-3.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast
        open={welcomeToast}
        message="모든 잠금이 해제됐어요"
        onClose={() => setWelcomeToast(false)}
      />
      <Toast
        open={toastMsg != null}
        message={toastMsg ?? ''}
        onClose={() => setToastMsg(null)}
      />
    </MobileContainer>
  )
}
