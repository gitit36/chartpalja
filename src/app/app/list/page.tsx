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
import { TodayHeroCard, TodayHeroCardSkeleton } from '@/components/TodayHeroCard'
import { getGuestHeaders } from '@/lib/auth/guest'
import type { DailySignal, WeekScoreRange } from '@/lib/saju/daily-util'
import { buildDailySignals, weekScoreRange } from '@/lib/saju/daily-util'
import { prefetchSajuEntry } from '@/lib/saju/entry-cache'

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
  isLinked?: boolean
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
  signals?: DailySignal[]
  weekRange?: WeekScoreRange | null
  domains?: Record<string, number> | null
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

// 새로고침 후에도 즉시 뜨도록 localStorage 로도 영속화한다(메모리 캐시는 SPA 이동만 유지).
const LIST_KEY = 'saju:list:v1'
const DAILY_KEY = 'saju:daily:v4'

function kstTodayStr(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 9 * 3600000)
  return kst.toISOString().slice(0, 10)
}

function loadListCache(): SajuCard[] | null {
  if (listMemCache) return listMemCache
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LIST_KEY)
    if (raw) { listMemCache = JSON.parse(raw) as SajuCard[]; return listMemCache }
  } catch { /* ignore */ }
  return null
}

function loadDailyCache(): DailyCacheShape | null {
  if (dailyMemCache) return dailyMemCache
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DailyCacheShape
      // 날짜가 바뀌면 폐기(점수/시계열이 하루 밀리는 것 방지).
      if (parsed.today === kstTodayStr()) { dailyMemCache = parsed; return parsed }
    }
  } catch { /* ignore */ }
  return null
}

function saveListCache(list: SajuCard[]) {
  listMemCache = list
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

function saveDailyCache(cache: DailyCacheShape) {
  dailyMemCache = cache
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(cache)) } catch { /* ignore */ }
}

// 대표 사주 식별 — daily 라우트와 동일 규칙(지정 대표 → 없으면 최초 생성). 연동(peer) 제외.
function deriveRepId(list: SajuCard[]): string | null {
  const owned = list.filter(e => !e.isLinked)
  const rep = owned.find(e => e.isRepresentative)
  if (rep) return rep.id
  if (!owned.length) return null
  return [...owned].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]!.id
}

function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="불러오는 중"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

function deltaText(delta: number): string {
  if (delta > 0) return `▲${delta}`
  if (delta < 0) return `▼${Math.abs(delta)}`
  return '–'
}

function deltaColor(direction: 'up' | 'down' | 'flat'): string {
  if (direction === 'up') return 'text-cp-up'
  if (direction === 'down') return 'text-cp-down'
  return 'text-cp-dim'
}

export default function SajuListPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<SajuCard[]>(() => loadListCache() ?? [])
  const [loading, setLoading] = useState(() => loadListCache() == null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SajuCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [welcomeToast, setWelcomeToast] = useState(false)
  const [daily, setDaily] = useState<Record<string, DailyEntry>>(() => loadDailyCache()?.entries ?? {})
  const [representative, setRepresentative] = useState<DailyRepresentative | null>(() => loadDailyCache()?.representative ?? null)
  const [todayStr, setTodayStr] = useState<string>(() => loadDailyCache()?.today ?? '')
  const [sortByScore, setSortByScore] = useState(false)
  // "오늘 운세 순" 정렬은 토글하는 순간 보유한 점수를 스냅샷해서 고정한다.
  // 백그라운드 폴링으로 점수가 더 채워져도 순서가 실시간으로 흔들리지 않게 하기 위함.
  const [scoreOrder, setScoreOrder] = useState<Record<string, number> | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  /** 궁합 선택 모드 — pick[0]=기준 차트(해설 저장), pick[1]=상대(오버레이) */
  const [compatSelecting, setCompatSelecting] = useState(false)
  const [compatPick, setCompatPick] = useState<string[]>([])

  const exitCompatSelect = useCallback(() => {
    setCompatSelecting(false)
    setCompatPick([])
  }, [])

  const startCompatSelect = useCallback(() => {
    setMenuOpen(null)
    if (entries.length < 2) {
      setToastMsg('궁합을 보려면 사주가 2명 이상 필요해요')
      return
    }
    setCompatSelecting(true)
    setCompatPick([])
  }, [entries.length])

  const handleCompatCardTap = useCallback((id: string) => {
    setCompatPick((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[0]!, id]
      return [...prev, id]
    })
  }, [])

  const basePick = compatPick[0] ? entries.find((e) => e.id === compatPick[0]) : null
  const partnerPick = compatPick[1] ? entries.find((e) => e.id === compatPick[1]) : null

  const confirmCompatPair = useCallback(() => {
    if (!compatPick[0] || !compatPick[1]) return
    const baseId = compatPick[0]
    const partnerId = compatPick[1]
    prefetchSajuEntry(baseId, getGuestHeaders())
    prefetchSajuEntry(partnerId, getGuestHeaders())
    exitCompatSelect()
    router.push(
      `/app/saju/${baseId}?overlay=${encodeURIComponent(partnerId)}&focus=compat`,
    )
  }, [compatPick, exitCompatSelect, router])

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
        saveDailyCache({
          entries: map,
          representative: data.representative ?? null,
          today: typeof data.today === 'string' ? data.today : (dailyMemCache?.today ?? kstTodayStr()),
        })
        // 엔트리가 많으면 서버가 일부만 계산하고 pending=true를 준다.
        // 캐시가 다 찰 때까지 이어받아 폴링 (과도한 반복은 방지).
        // 배치가 작아졌으므로(서버 MAX_COMPUTE=4) 간격을 좁혀 더 빨리 채운다.
        if (data.pending && attempt < 20) {
          setTimeout(() => fetchDaily(attempt + 1), 1500)
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
        saveListCache(list)
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

  // 대표 카드는 목록 정보만으로 즉시 프레임을 렌더하고, 점수/스파크라인만 daily 로 채운다.
  // (daily 응답을 기다리며 뒤늦게 카드가 통째로 튀어나오는 현상 제거)
  const repId = representative?.id ?? deriveRepId(entries)
  const repEntry = entries.find(e => e.id === repId) ?? null
  const repName = representative?.name ?? repEntry?.name ?? ''
  const repReady = representative != null && representative.score != null && representative.id === repId

  // 대표 사주 상세 JSON 미리 받아 두면 히어로 → 차트 진입이 빨라짐
  useEffect(() => {
    if (repId) prefetchSajuEntry(repId, getGuestHeaders())
  }, [repId])

  const repSeries = repId ? daily[repId]?.series : undefined
  const heroSignals = useMemo(() => {
    if (!representative) return []
    const raw = representative.signals?.length
      ? representative.signals
      : buildDailySignals({
          score: representative.score,
          delta: representative.delta,
          bestDomain: representative.bestDomain,
          bestScore: representative.bestScore,
          worstDomain: representative.worstDomain,
          worstScore: representative.worstScore,
          series: repSeries,
        })
    // 히어로: 점수 옆 ▲▼로 변화를 이미 보여 주므로 '변화' 칩은 제외
    return raw.filter((s) => s.kind !== 'delta')
  }, [representative, repSeries])
  const heroWeekRange = useMemo(() => {
    if (!representative) return null
    if (representative.weekRange) return representative.weekRange
    return weekScoreRange(representative.score, repSeries)
  }, [representative, repSeries])

  const enableScoreSort = () => {
    const snap: Record<string, number> = {}
    for (const e of entries) snap[e.id] = daily[e.id]?.score ?? -1
    setScoreOrder(snap)
    setSortByScore(true)
  }

  const handleToggleRepresentative = async (id: string, currentlyRep: boolean) => {
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/saju/${id}`, {
        method: 'PATCH',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ setRepresentative: !currentlyRep }),
      })
      if (res.ok) {
        setEntries((prev) => {
          const next = currentlyRep
            ? prev.map((e) => (e.id === id ? { ...e, isRepresentative: false } : e))
            : prev.map((e) => ({ ...e, isRepresentative: e.id === id }))
          saveListCache(next)
          return next
        })
        setToastMsg(currentlyRep ? '대표사주가 해제되었어요' : '대표 사주로 설정했어요.')
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

  const compatHint =
    compatPick.length === 0
      ? '먼저 기준이 될 사주를 골라 주세요.'
      : compatPick.length === 1
        ? '비교할 상대를 골라 주세요.'
        : `${basePick?.name ?? '기준'} x ${partnerPick?.name ?? '상대'}`

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
      {/* Sticky header — 선택 모드일 때 모드 바로 전환 */}
      <div className="sticky top-0 z-20 bg-cp-raised/95 backdrop-blur border-b border-cp-border">
        {compatSelecting ? (
          <div className="flex items-center px-4 py-3 gap-2">
            <button
              type="button"
              onClick={exitCompatSelect}
              className="shrink-0 min-w-[3rem] -ml-1 px-2 py-1.5 text-sm font-semibold text-cp-secondary hover:text-cp-text rounded-lg hover:bg-cp-hover transition-colors"
            >
              취소
            </button>
            <div className="flex-1 min-w-0 text-center">
              <h1 className="text-lg font-bold text-cp-text leading-tight">두 사람 고르기</h1>
            </div>
            <span
              className="shrink-0 min-w-[3rem] text-center tabular-nums text-[11px] font-semibold text-cp-muted bg-cp-input border border-cp-border rounded-full px-2 py-1"
              aria-live="polite"
            >
              {compatPick.length}/2
            </span>
          </div>
        ) : (
          <div className="flex items-center px-4 py-3">
            <div className="w-8" />
            <div className="flex-1 flex items-center justify-center gap-2.5">
              <Image src="/svc_logo.png" alt="차트8자" width={32} height={29} />
              <h1 className="text-xl font-bold text-cp-text">내 사주 목록</h1>
            </div>
            <HamburgerMenu />
          </div>
        )}
      </div>

      <div className={`flex-1 px-4 pt-4 ${compatSelecting ? 'pb-40' : 'pb-24'}`}>
        {loading && entries.length === 0 ? (
          <div className="animate-pulse">
            <div className="mb-4 h-[220px] rounded-2xl bg-gradient-to-br from-cp-surface to-cp-border" />
            <div className="flex items-center justify-between mb-2.5">
              <div className="h-3.5 w-10 bg-cp-surface rounded" />
              <div className="h-6 w-28 bg-cp-surface rounded-full" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[80px] rounded-2xl bg-cp-surface" />
              ))}
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">&#x1F52E;</div>
            <p className="text-cp-muted text-sm mb-1">아직 등록된 사주가 없어요</p>
            <p className="text-cp-muted text-xs">아래 버튼을 눌러 사주를 추가해보세요</p>
          </div>
        ) : (
          <>
            {/* 선택 모드 안내 — 로그인 배너와 같은 surface 톤, 기준/상대만 차트 색 */}
            {compatSelecting && (
              <div className="mb-3 rounded-xl bg-cp-surface border border-cp-border px-3.5 py-3">
                <p className="text-[12px] text-cp-muted leading-snug">{compatHint}</p>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${
                      basePick
                        ? 'bg-cp-upMuted text-cp-line border-cp-line/35'
                        : 'bg-cp-input text-cp-dim border-cp-border'
                    }`}
                  >
                    <span className={basePick ? 'text-cp-line/80' : 'text-cp-dim'}>기준</span>
                    <span className={basePick ? 'text-cp-text' : ''}>
                      {basePick ? basePick.name : '선택'}
                    </span>
                  </span>
                  <span className="text-cp-dim text-[11px] font-medium" aria-hidden>x</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${
                      partnerPick
                        ? 'bg-cp-downMuted text-cp-down border-cp-down/35'
                        : 'bg-cp-input text-cp-dim border-cp-border'
                    }`}
                  >
                    <span className={partnerPick ? 'text-cp-down/80' : 'text-cp-dim'}>상대</span>
                    <span className={partnerPick ? 'text-cp-text' : ''}>
                      {partnerPick ? partnerPick.name : '선택'}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* 대표 히어로 — 선택 모드에선 숨겨 목록에 집중 */}
            {!compatSelecting && repId && repEntry && (
              repReady ? (
                <TodayHeroCard
                  href={`/app/saju/${repId}?focus=today`}
                  name={repName}
                  dateLabel={(todayStr || kstTodayStr()).slice(5).replace('-', '.')}
                  score={representative!.score}
                  delta={representative!.delta}
                  direction={representative!.direction}
                  domains={representative!.domains ?? daily[repId!]?.domains ?? null}
                  signals={heroSignals}
                  weekRange={heroWeekRange}
                  series={repSeries}
                />
              ) : (
                <TodayHeroCardSkeleton name={repName} />
              )
            )}

            {/* 정렬 토글 */}
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs text-cp-muted">{entries.length}개</span>
              {!compatSelecting && (
                <div className="flex bg-cp-input rounded-full p-0.5 border border-cp-border text-xs font-medium">
                  <button
                    onClick={() => setSortByScore(false)}
                    className={`px-3 py-1 rounded-full transition-all ${!sortByScore ? 'bg-cp-surface text-cp-text' : 'text-cp-muted'}`}
                  >
                    등록순
                  </button>
                  <button
                    onClick={enableScoreSort}
                    className={`px-3 py-1 rounded-full transition-all ${sortByScore ? 'bg-cp-surface text-cp-text' : 'text-cp-muted'}`}
                  >
                    오늘 운세 순
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
            {sortedEntries.map((e) => {
              const d = daily[e.id]
              const pickIdx = compatPick.indexOf(e.id)
              const isBase = pickIdx === 0
              const isPartner = pickIdx === 1
              const selected = pickIdx >= 0

              const cardInner = (
                <>
                  <SajuCharacterAvatar
                    gender={e.gender === 'female' ? 'female' : 'male'}
                    element={normalizeElement(e.dayElement ?? undefined)}
                    personId={e.id}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-cp-text truncate">{e.name}</span>
                      <span className="text-xs text-cp-muted">&middot;</span>
                      <span className="text-sm text-cp-muted shrink-0">{e.gender === 'female' ? '여성' : '남성'}</span>
                      {e.isRepresentative && !compatSelecting && (
                        <span className="text-amber-400 text-xs leading-none shrink-0" title="대표 사주" aria-label="대표 사주">&#x2B51;</span>
                      )}
                      {isBase && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cp-line/20 text-cp-line border border-cp-line/35">
                          기준
                        </span>
                      )}
                      {isPartner && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cp-down/20 text-cp-down border border-cp-down/35">
                          상대
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-cp-muted truncate">
                      {e.isLunar ? '음력' : '양력'} {formatDate(e.birthDate)}
                      {e.timeUnknown ? ' · 시간 모름' : e.birthTime ? ` ${e.birthTime}` : ''}
                    </div>
                  </div>

                  {/* 일별 점수 / 선택 체크 */}
                  <div className={`shrink-0 flex items-center min-h-[40px] ${compatSelecting ? 'pl-1' : 'gap-1.5'}`}>
                    {compatSelecting ? (
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                          isBase
                            ? 'border border-cp-line bg-cp-line text-white'
                            : isPartner
                              ? 'border border-cp-down bg-cp-down text-white'
                              : 'border border-cp-borderStrong bg-cp-input text-transparent'
                        }`}
                        aria-hidden
                      >
                        {isBase ? '1' : isPartner ? '2' : ''}
                      </span>
                    ) : d?.score != null ? (
                      <>
                        <Sparkline data={d.series} trend={d.direction} />
                        <div className="text-right min-w-[36px]">
                          <div className="flex items-center justify-end">
                            <span className="text-lg font-bold text-cp-text leading-none">{d.score}</span>
                          </div>
                          <div className={`text-xs font-semibold mt-0.5 ${deltaColor(d.direction)}`}>
                            {deltaText(d.delta)}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-[52px] h-[24px] flex items-center justify-center">
                        <Spinner size={16} className="text-cp-border" />
                      </div>
                    )}
                  </div>
                </>
              )

              return (
              <div
                key={e.id}
                className={`relative flex items-center gap-1 bg-cp-surface border rounded-2xl pl-4 py-4 transition-colors ${
                  compatSelecting ? 'pr-4' : 'pr-1.5'
                } ${
                  menuOpen === e.id ? 'z-50' : ''
                } ${
                  isBase
                    ? 'border-cp-line/50 bg-cp-upMuted'
                    : isPartner
                      ? 'border-cp-down/50 bg-cp-downMuted'
                      : 'border-cp-border hover:bg-cp-hover active:brightness-95'
                } ${compatSelecting && !selected && compatPick.length >= 2 ? 'opacity-50' : ''}`}
              >
                {compatSelecting ? (
                  <button
                    type="button"
                    onClick={() => handleCompatCardTap(e.id)}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 text-left"
                  >
                    {cardInner}
                  </button>
                ) : (
                  <Link
                    href={`/app/saju/${e.id}`}
                    prefetch={true}
                    onMouseEnter={() => prefetchSajuEntry(e.id, getGuestHeaders())}
                    onFocus={() => prefetchSajuEntry(e.id, getGuestHeaders())}
                    onTouchStart={() => prefetchSajuEntry(e.id, getGuestHeaders())}
                    className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  >
                    {cardInner}
                  </Link>
                )}

                {!compatSelecting && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    aria-label="사주 메뉴"
                    aria-expanded={menuOpen === e.id}
                    onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); setMenuOpen(menuOpen === e.id ? null : e.id) }}
                    className="w-8 h-10 flex items-center justify-center rounded-md text-cp-muted hover:bg-cp-hover active:bg-cp-border/50"
                  >
                    <span className="text-[20px] leading-none font-bold tracking-tighter" aria-hidden>&#x22EE;</span>
                  </button>

                  {menuOpen === e.id && (
                    <div
                      role="menu"
                      className="absolute top-0 right-full mr-1 bg-cp-bg border border-cp-border rounded-xl shadow-lg z-50 overflow-hidden w-max"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleToggleRepresentative(e.id, !!e.isRepresentative)}
                        className={`block w-full text-center px-3.5 py-2.5 leading-none hover:bg-cp-hover ${e.isRepresentative ? 'text-amber-400' : 'text-cp-muted'}`}
                        aria-label={e.isRepresentative ? '대표 사주 해제' : '대표 사주로 설정'}
                        title={e.isRepresentative ? '대표 사주 해제' : '대표 사주로 설정'}
                      >
                        <span className="text-[22px] leading-none" aria-hidden>&#x2B51;</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setMenuOpen(null); router.push(`/app/input?edit=${e.id}`) }}
                        className="block w-full text-center px-3.5 py-2.5 text-sm text-cp-text hover:bg-cp-hover"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setMenuOpen(null); setDeleteTarget(e) }}
                        className="block w-full text-center px-3.5 py-2.5 text-sm text-cp-up hover:bg-cp-line/10"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
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
        <div className="mx-auto max-w-[446px] p-4 bg-cp-raised border-t border-cp-border">
          {compatSelecting ? (
            <div className="space-y-2">
              {basePick && partnerPick ? (
                <>
                  <p className="text-[11px] text-center text-cp-muted leading-snug px-1">
                    <span className="text-cp-secondary font-medium">{basePick.name}</span>
                    {' x '}
                    <span className="text-cp-secondary font-medium">{partnerPick.name}</span>
                    {' 궁합 해설은 '}
                    <span className="text-cp-secondary font-medium">{basePick.name}</span>
                    {' 차트 하단에 저장됩니다'}
                  </p>
                  <button
                    type="button"
                    onClick={confirmCompatPair}
                    className="flex w-full items-center justify-center py-3.5 rounded-2xl text-[15px] font-bold bg-cp-accent text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
                  >
                    {basePick.name} 차트에서 궁합 보기
                  </button>
                </>
              ) : (
                <p className="py-3 text-center text-[13px] text-cp-muted">
                  {compatPick.length === 0
                    ? '기준 사주를 먼저 골라 주세요'
                    : '상대 사주를 골라 주세요'}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={startCompatSelect}
                disabled={loading && entries.length === 0}
                className="shrink-0 w-[84px] sm:w-[92px] flex items-center justify-center rounded-2xl text-[15px] font-semibold bg-cp-surface text-cp-secondary border border-cp-borderStrong hover:bg-cp-hover hover:text-cp-text active:scale-[0.98] transition-all disabled:opacity-50"
              >
                궁합
              </button>
              <Link
                href="/app/input"
                prefetch={true}
                className="flex-1 flex items-center justify-center py-4 rounded-2xl text-base font-bold bg-cp-accent text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
              >
                + 사주 추가하기
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 케밥 메뉴 바깥 클릭 닫기 — 카드 밖(헤더·CTA 포함)에서도 동작하도록 페이지 레벨 백드롭 */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} aria-hidden />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-cp-bg rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            onClick={ev => ev.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-cp-up" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-cp-text mb-1">사주 삭제</h3>
              <p className="text-sm text-cp-muted">
                <span className="font-semibold text-cp-text">{deleteTarget.name}</span>의 사주 정보를 정말 삭제하시겠어요?
              </p>
              <p className="text-xs text-cp-muted mt-1">삭제된 데이터는 복구할 수 없습니다.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-cp-border">
              <button disabled={deleting} onClick={() => setDeleteTarget(null)}
                className="py-3.5 text-sm font-medium text-cp-muted hover:bg-cp-bg transition-colors border-r border-cp-border">
                취소
              </button>
              <button disabled={deleting} onClick={handleDeleteConfirm}
                className="py-3.5 text-sm font-bold text-cp-up hover:bg-cp-line/10 transition-colors">
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
