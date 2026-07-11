'use client'

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { InfoTab } from '@/components/InfoTab'
import { SummaryLine } from '@/components/SummaryLine'
import { CompatSummaryBar } from '@/components/CompatSummaryBar'
import { CompatConfirmSheet } from '@/components/CompatConfirmSheet'
import { JuShortageNudge } from '@/components/JuShortageNudge'
import type { OverlayCompatInfo, CompatGenerationState, RelationshipType } from '@/lib/compat/types'
import { compatCardKey } from '@/lib/compat/relationship'
import { getGeneratedRelationships } from '@/lib/compat/storage'
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import { readCachedSajuEntry, writeCachedSajuEntry } from '@/lib/saju/entry-cache'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { SajuCharacterAvatar, normalizeElement } from '@/components/SajuCharacterAvatar'
import { BottomSheet } from '@/components/BottomSheet'
import { LoginPromptSheet } from '@/components/LoginPromptSheet'
import { AlertSheet } from '@/components/AlertSheet'
import { Toast } from '@/components/Toast'
import { getGuestId } from '@/lib/auth/guest'
import { clearBalanceCache } from '@/lib/hooks/useBalance'
import { READING_COST } from '@/lib/payment/products'

const ChartTab = dynamic(
  () => import('@/components/ChartTab').then((m) => ({ default: m.ChartTab })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-3 mt-4 h-[300px] rounded-2xl bg-cp-surface border border-cp-border animate-pulse" />
    ),
  },
)

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void
      isInitialized: () => boolean
      Share: {
        sendDefault: (options: Record<string, unknown>) => void
      }
    }
  }
}

interface SajuEntryData {
  id: string
  name: string
  gender: string
  birthDate: string
  birthTime: string | null
  timeUnknown: boolean
  isLunar: boolean
  sajuReportJson: SajuReportJson | null
  fortuneJson: unknown | null
  weekSeries?: {
    dates: string[]
    scores: (number | null)[]
    days?: unknown[]
    todayIndex?: number
  } | null
}

interface OverlayEntryBasic {
  id: string
  name: string
  gender: string
  birthDate: string
  dayElement?: string | null
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {}
  const gid = getGuestId()
  if (gid) h['x-guest-id'] = gid
  return h
}

function calcAge(birthDate: string): number {
  const y = parseInt(birthDate.slice(0, 4), 10)
  return new Date().getFullYear() - y
}

function formatBirthLine(e: SajuEntryData): string {
  const d = e.birthDate.replace(/-/g, '.')
  const t = e.timeUnknown ? '시간 모름' : (e.birthTime || '')
  return `${e.isLunar ? '음력' : '양력'} ${d} ${t}`.trim()
}

interface StockTypeLine {
  score: number
  label: string
  desc: string
  ticker: string
  emoji: string
  delta: number
  deltaPercent: number
  sparkData: number[]
  currentIdx: number
}

type StockEntry = { min: number; max: number; label: string; desc: string; ticker: string; emoji: string }

function pickStock(score: number, delta: number): StockEntry {
  const isRising = delta > 3
  const isFalling = delta < -3
  const isStable = !isRising && !isFalling

  if (score >= 95) return { min: 95, max: 200, label: '엔비디아 같은 초고성장 모멘텀주', desc: '폭발적 상승 구간, 지금이 전성기', ticker: 'NVDA', emoji: '🚀' }
  if (score >= 90) {
    if (isRising) return { min: 90, max: 94, label: '테슬라 같은 혁신 고성장주', desc: '가속 붙은 강한 상승세', ticker: 'TSLA', emoji: '🚀' }
    return { min: 90, max: 94, label: '아마존 같은 메가트렌드주', desc: '큰 흐름 위에 올라탄 시기', ticker: 'AMZN', emoji: '🚀' }
  }
  if (score >= 85) {
    if (isRising) return { min: 85, max: 89, label: '애플 같은 대형 퀄리티주', desc: '안정 속 꾸준한 상승세', ticker: 'AAPL', emoji: '📈' }
    if (isFalling) return { min: 85, max: 89, label: '구글 같은 플랫폼 독점주', desc: '높은 위치에서 조정 중, 기반은 탄탄', ticker: 'GOOG', emoji: '📈' }
    return { min: 85, max: 89, label: '마이크로소프트 같은 장기복리주', desc: '꾸준히 우상향하는 안정 궤도', ticker: 'MSFT', emoji: '📈' }
  }
  if (score >= 80) {
    if (isRising) return { min: 80, max: 84, label: '코스트코 같은 고ROE 실적주', desc: '실적이 뒷받침하는 상승 흐름', ticker: 'COST', emoji: '📈' }
    return { min: 80, max: 84, label: '비자 같은 현금흐름 우량주', desc: '조용하지만 확실한 성장 경로', ticker: 'V', emoji: '📈' }
  }
  if (score >= 75) {
    if (isRising) return { min: 75, max: 79, label: '스타벅스 같은 배당성장주', desc: '안정적 기반 위에 성장 가속', ticker: 'SBUX', emoji: '📊' }
    if (isFalling) return { min: 75, max: 79, label: '나이키 같은 글로벌 소비재주', desc: '일시적 둔화, 브랜드 파워는 건재', ticker: 'NKE', emoji: '📊' }
    return { min: 75, max: 79, label: '존슨앤존슨 같은 디펜시브 우량주', desc: '흔들려도 방향은 유지', ticker: 'JNJ', emoji: '📊' }
  }
  if (score >= 70) {
    if (isRising) return { min: 70, max: 74, label: '맥도날드 같은 방어주', desc: '흔들림 속에서도 꾸준한 반등 조짐', ticker: 'MCD', emoji: '📊' }
    if (isFalling) return { min: 70, max: 74, label: '월마트 같은 내수 안정주', desc: '하락 폭 제한적, 바닥이 단단함', ticker: 'WMT', emoji: '📊' }
    return { min: 70, max: 74, label: 'P&G 같은 로우베타 안정주', desc: '변동성 낮은 안전 항해 구간', ticker: 'PG', emoji: '📊' }
  }
  if (score >= 65) {
    if (isRising) return { min: 65, max: 69, label: '코카콜라 같은 고배당주', desc: '바닥을 지나 서서히 올라가는 중', ticker: 'KO', emoji: '📊' }
    return { min: 65, max: 69, label: '펩시 같은 안정 인컴주', desc: '큰 점프는 없지만 안정적 흐름', ticker: 'PEP', emoji: '📊' }
  }
  if (score >= 60) {
    if (isRising) return { min: 60, max: 64, label: '리얼티인컴 같은 리츠(REITs)', desc: '회복세 진입, 속도보단 방향이 중요', ticker: 'O', emoji: '🏢' }
    if (isFalling) return { min: 60, max: 64, label: 'AT&T 같은 고배당 가치주', desc: '하락 압력 있지만 배당이 버팀목', ticker: 'T', emoji: '🏢' }
    return { min: 60, max: 64, label: '리츠 같은 인컴주', desc: '속도보단 안정 수익 흐름', ticker: 'REITs', emoji: '🏢' }
  }
  if (score >= 55) {
    if (isRising) return { min: 55, max: 59, label: '인텔 같은 턴어라운드주', desc: '반등을 준비하는 시기', ticker: 'INTC', emoji: '🔄' }
    return { min: 55, max: 59, label: 'IBM 같은 사이클 전환주', desc: '바닥 근처, 전환점을 기다리는 중', ticker: 'IBM', emoji: '🔄' }
  }
  if (score >= 50) {
    if (isRising) return { min: 50, max: 54, label: '포드 같은 경기민감 회복주', desc: '사이클이 돌기 시작하는 구간', ticker: 'F', emoji: '🔄' }
    return { min: 50, max: 54, label: '시티그룹 같은 저PBR 금융주', desc: '저평가 구간, 인내의 시기', ticker: 'C', emoji: '🔄' }
  }
  if (score >= 45) {
    if (isRising) return { min: 45, max: 49, label: 'GE 같은 구조조정 후 회복주', desc: '최악은 지났고, 회복 신호가 보임', ticker: 'GE', emoji: '🔧' }
    return { min: 45, max: 49, label: '구조조정 중인 가치주', desc: '기다림이 필요한 시기, 기반 재정비 중', ticker: 'GE', emoji: '🔧' }
  }
  if (score >= 40) {
    if (isRising) return { min: 40, max: 44, label: '스핀오프 직후 독립 성장주', desc: '새 출발, 아직 방향을 잡는 중', ticker: 'SPIN', emoji: '🔧' }
    return { min: 40, max: 44, label: '저부채 자산주', desc: '보이지 않는 가치가 축적되는 시기', ticker: 'VALUE', emoji: '🔧' }
  }
  if (score >= 35) {
    return { min: 35, max: 39, label: '바닥을 다지는 디스카운트주', desc: '가장 어두울 때가 새벽 직전', ticker: 'DISC', emoji: '⏳' }
  }
  if (isRising) return { min: 0, max: 34, label: '극초기 스몰캡 성장주', desc: '바닥에서 반등 에너지가 모이는 중', ticker: 'SMCAP', emoji: '⏳' }
  return { min: 0, max: 34, label: '겨울잠 중인 니치마켓주', desc: '지금은 쉬는 구간, 다음 시즌을 준비', ticker: 'NICHE', emoji: '⏳' }
}

function buildStockLine(report: SajuReportJson | null, birthYear: number | null): StockTypeLine | null {
  if (!report || !birthYear) return null
  const chartPayload = report.chartData as ChartPayload | undefined
  const lifeChart = buildLifeChartData(chartPayload, report, birthYear)
  if (!lifeChart?.data?.length) return null

  const thisYear = new Date().getFullYear()
  const current = lifeChart.data.find(d => d.year === thisYear)
  const prev = lifeChart.data.find(d => d.year === thisYear - 1)
  if (!current) return null

  const score = Math.round(current.score)
  const prevScore = prev ? Math.round(prev.score) : score
  const delta = score - prevScore
  const deltaPercent = prevScore > 0 ? Math.round((delta / prevScore) * 1000) / 10 : 0

  const match = pickStock(score, delta)

  const sparkData = lifeChart.data.map(d => Math.round(d.score))
  const currentIdx = lifeChart.data.findIndex(d => d.year === thisYear)

  return { score, label: match.label, desc: match.desc, ticker: match.ticker, emoji: match.emoji, delta, deltaPercent, sparkData, currentIdx }
}


type TabKey = 'chart' | 'info'

function PersonalSajuPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const initialOverlayId = searchParams.get('overlay')
  const initialFocus = searchParams.get('focus') === 'today' ? 'today' as const : null
  const [entry, setEntry] = useState<SajuEntryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('chart')
  const [shareOpen, setShareOpen] = useState(false)
  const [switchSheetOpen, setSwitchSheetOpen] = useState(false)
  const [imageSaving, setImageSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [regenModal, setRegenModal] = useState<'confirm' | 'no-credit' | 'failed' | null>(null)
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const lastScrollY = useRef(0)
  const [overlayEntries, setOverlayEntries] = useState<OverlayEntryBasic[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [loginSheet, setLoginSheet] = useState<{ open: boolean; feature?: string }>({ open: false })
  const [alertState, setAlertState] = useState<{ open: boolean; title: string; description?: string }>({ open: false, title: '' })
  const [welcomeToast, setWelcomeToast] = useState(false)
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(true)
  const [activeOverlay, setActiveOverlay] = useState<OverlayCompatInfo | null>(null)
  const [compatConfirmOpen, setCompatConfirmOpen] = useState(false)
  const [compatGeneration, setCompatGeneration] = useState<CompatGenerationState | null>(null)
  const [expandCompatCardKey, setExpandCompatCardKey] = useState<string | null>(null)
  const [juShortage, setJuShortage] = useState<{ needed: number; current: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    const cached = readCachedSajuEntry<SajuEntryData>(id)
    if (cached?.id === id && cached.sajuReportJson) {
      setEntry(cached)
      setLoading(false)
    }
    fetch(`/api/saju/${id}`, { headers: getHeaders(), cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d) return
        setEntry(d)
        writeCachedSajuEntry(id, d)
      })
      .catch(() => {
        if (!cancelled && !cached) setEntry(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  // 로그인 여부 조회 — 차트 잠금 여부 결정.
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setIsLoggedIn(!!data?.user) })
      .catch(() => { if (!cancelled) setIsLoggedIn(false) })
    return () => { cancelled = true }
  }, [])

  // 카카오 로그인 직후 진입(?welcome=1)이면 토스트로 잠금 해제 알림 (피크엔드).
  // 또한 이전 사용자(혹은 게스트)가 같은 브라우저에 남긴 잔액 캐시를 비워서
  // 다른 사용자의 이용권 수가 노출되는 일이 없도록 보장한다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('welcome') === '1') {
      setWelcomeToast(true)
      clearBalanceCache()
      url.searchParams.delete('welcome')
      const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : '')
      window.history.replaceState({}, '', clean)
    }
  }, [])

  // 게스트 상단 배너: 한 번 닫으면 세션 동안 다시 안 보임 + 스크롤 시 자연스럽게 사라짐.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem('saju_login_banner_dismissed_v1') === '1') {
        setGuestBannerDismissed(true)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const onScroll = () => {
      if (typeof window === 'undefined') return
      setBannerVisible(window.scrollY < 80)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('/api/saju', { headers: getHeaders(), cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.entries) setOverlayEntries(d.entries) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY
      setScrolled(y > 120)
      if (y > lastScrollY.current + 5) setToolbarVisible(false)
      else if (y < lastScrollY.current - 5) setToolbarVisible(true)
      lastScrollY.current = y
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const report = entry?.sajuReportJson ?? null
  const birthYear = entry ? parseInt(entry.birthDate.slice(0, 4), 10) : null
  const stockLine = useMemo(() => buildStockLine(report, birthYear), [report, birthYear])

  const [ogPreviewKey, setOgPreviewKey] = useState(0)

  const handleRegenerateClick = useCallback(async () => {
    // 게스트는 LLM 호출 자체가 막혀 있으므로 모달 fall-through 없이 바로 로그인 시트.
    if (isLoggedIn !== true) {
      setLoginSheet({ open: true, feature: '운세 재해석' })
      return
    }
    try {
      const balRes = await fetch('/api/user/balance', { headers: getHeaders() })
      if (balRes.status === 401) {
        // 세션이 만료된 경우에도 로그인 시트로 유도.
        setLoginSheet({ open: true, feature: '운세 재해석' })
        return
      }
      if (balRes.ok) {
        const bal = await balRes.json()
        if ((bal.ju ?? 0) >= READING_COST.fortune) {
          setRegenModal('confirm')
        } else {
          setRegenModal('no-credit')
        }
      } else {
        setRegenModal('confirm')
      }
    } catch {
      setRegenModal('confirm')
    }
  }, [isLoggedIn])

  const handleRegenerateConfirm = useCallback(async () => {
    setRegenModal(null)
    setRegenerating(true)
    try {
      const headers = getHeaders()
      const res = await fetch(`/api/saju/${id}/fortune?regenerate=true&consumeCredit=true`, { headers })
      if (res.ok) {
        const d = await res.json()
        if (d?.items) {
          setEntry(prev => {
            if (!prev) return prev
            const existing = (prev.fortuneJson && typeof prev.fortuneJson === 'object')
              ? prev.fortuneJson as Record<string, unknown>
              : {}
            return { ...prev, fortuneJson: { ...existing, items: d.items } }
          })
        }
      } else {
        const err = await res.json().catch(() => ({}))
        if (err.error?.includes('이용권')) {
          setRegenModal('no-credit')
        } else {
          setRegenModal('failed')
        }
      }
    } catch {
      setRegenModal('failed')
    }
    setRegenerating(false)
  }, [id])

  const handleCompatCta = useCallback(async () => {
    if (!activeOverlay) return
    if (isLoggedIn !== true) {
      setLoginSheet({ open: true, feature: '궁합 해설' })
      return
    }
    try {
      const balRes = await fetch('/api/user/balance', { headers: getHeaders() })
      if (balRes.status === 401) {
        setLoginSheet({ open: true, feature: '궁합 해설' })
        return
      }
      if (balRes.ok) {
        const bal = await balRes.json()
        if ((bal.ju ?? 0) < READING_COST.compat) {
          setJuShortage({ needed: READING_COST.compat, current: bal.ju ?? 0 })
          return
        }
      }
      setCompatConfirmOpen(true)
    } catch {
      setCompatConfirmOpen(true)
    }
  }, [activeOverlay, isLoggedIn])

  const handleCompatViewExisting = useCallback((relationship: RelationshipType) => {
    if (!activeOverlay) return
    setCompatConfirmOpen(false)
    setExpandCompatCardKey(compatCardKey(activeOverlay.overlayId, relationship))
    setTab('chart')
  }, [activeOverlay])

  const handleCompatConfirm = useCallback(async (relationship: RelationshipType) => {
    if (!activeOverlay) return
    setCompatConfirmOpen(false)
    const overlayId = activeOverlay.overlayId
    setCompatGeneration({
      partnerId: overlayId,
      partnerName: activeOverlay.overlayName,
      relationship,
      type: activeOverlay.type,
    })
    setTab('chart')
    try {
      const res = await fetch(
        `/api/saju/${id}/compat?overlayId=${encodeURIComponent(overlayId)}&relationship=${relationship}`,
        { method: 'POST', headers: getHeaders() },
      )
      const data = await res.json().catch(() => ({}))
      if (res.status === 402) {
        setCompatGeneration(null)
        setJuShortage({ needed: READING_COST.compat, current: data.ju ?? 0 })
        return
      }
      if (!res.ok) {
        setCompatGeneration(null)
        setAlertState({ open: true, title: '궁합 해설 생성 실패', description: data.error ?? '잠시 후 다시 시도해 주세요.' })
        return
      }
      if (data.compat) {
        const compatKey = `compat_${overlayId}_${relationship}`
        setEntry(prev => {
          if (!prev) return prev
          const existing = (prev.fortuneJson && typeof prev.fortuneJson === 'object')
            ? prev.fortuneJson as Record<string, unknown>
            : {}
          return { ...prev, fortuneJson: { ...existing, [compatKey]: data.compat } }
        })
        setActiveOverlay(prev => prev ? {
          ...prev,
          generatedRelationships: getGeneratedRelationships(
            { ...(entry?.fortuneJson as object), [compatKey]: data.compat },
            overlayId,
          ),
        } : prev)
        setCompatGeneration(null)
        setExpandCompatCardKey(compatCardKey(overlayId, relationship))
        clearBalanceCache()
      }
    } catch {
      setCompatGeneration(null)
      setAlertState({ open: true, title: '궁합 해설 생성 실패', description: '네트워크 오류가 발생했어요.' })
    }
  }, [activeOverlay, id, entry?.fortuneJson])

  // 공유 시 비로그인 수신자도 결과를 볼 수 있도록 isShared=true 로 올린다.
  const ensureShared = useCallback(async () => {
    try {
      await fetch(`/api/saju/${id}`, {
        method: 'PATCH',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ share: true }),
      })
    } catch { /* 공유 토글 실패해도 링크 자체는 동작 시도 */ }
  }, [id])

  const openShareSheet = useCallback(async () => {
    await ensureShared()
    setOgPreviewKey(Date.now())
    setShareOpen(true)
  }, [ensureShared])

  const handleKakaoShare = useCallback(async () => {
    if (!entry) return
    const kakao = window.Kakao
    if (!kakao) { setAlertState({ open: true, title: '카카오 SDK를 불러오지 못했어요', description: '잠시 후 다시 시도해 주세요.' }); return }
    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
    if (jsKey && !kakao.isInitialized()) {
      try { kakao.init(jsKey) } catch { /* already initialized */ }
    }
    if (!kakao.isInitialized()) { setAlertState({ open: true, title: '카카오 공유 설정이 누락되었어요' }); return }
    await ensureShared()
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.chartpalja.com'
    const shareUrl = `${siteUrl}/share/${id}`
    const ogImageUrl = `${siteUrl}/share/${id}/opengraph-image`
    try {
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${entry?.name ?? ''}님의 인생 차트`,
          description: stockLine ? `올해 운세 ${stockLine.score}점 | ${stockLine.label}` : '100년의 흐름을 하나의 차트로',
          imageUrl: ogImageUrl,
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [{ title: '차트 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
      })
    } catch (err) {
      console.error('Kakao share error:', err)
      setAlertState({ open: true, title: '카카오톡 공유에 실패했어요', description: '잠시 후 다시 시도해 주세요.' })
    }
    setShareOpen(false)
  }, [entry, stockLine, id, ensureShared])

  const handleCopyLink = useCallback(async () => {
    await ensureShared()
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.chartpalja.com'
    const url = `${siteUrl}/share/${id}`
    try {
      await navigator.clipboard.writeText(url)
      setAlertState({ open: true, title: '공유 링크가 복사되었어요' })
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setAlertState({ open: true, title: '공유 링크가 복사되었어요' })
    }
    setShareOpen(false)
  }, [id, ensureShared])

  const handleImageSave = useCallback(async () => {
    setImageSaving(true)
    try {
      window.dispatchEvent(new Event('fortune-expand-all'))
      await new Promise(r => setTimeout(r, 150))

      const html2canvas = (await import('html2canvas')).default
      const targets = document.querySelectorAll<HTMLElement>('[data-capture]')
      if (!targets.length) {
        setAlertState({ open: true, title: '저장할 콘텐츠가 없어요' })
        setImageSaving(false)
        return
      }

      const name = entry?.name ?? 'chart'
      const blobs: { url: string; filename: string }[] = []

      for (let i = 0; i < targets.length; i++) {
        const el = targets[i]!
        const label = el.getAttribute('data-capture') || String(i + 1)
        const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
        blobs.push({ url: canvas.toDataURL('image/png'), filename: `${name}_${label}.png` })
      }

      for (const { url, filename } of blobs) {
        const link = document.createElement('a')
        link.download = filename
        link.href = url
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch {
      setAlertState({ open: true, title: '이미지 저장에 실패했어요', description: '잠시 후 다시 시도해 주세요.' })
    }
    setImageSaving(false)
    setShareOpen(false)
  }, [entry?.name])

  // 캐시가 없을 때도 전체 화면 "불러오는 중"으로 막지 않고, 헤더+차트 골격을 바로 보여준다.
  if (!loading && !entry) {
    return <MobileContainer><div className="flex flex-col items-center justify-center min-h-screen text-cp-muted gap-2"><p>데이터를 찾을 수 없습니다</p><button onClick={() => router.push('/app/list')} className="text-cp-line text-sm">목록으로</button></div></MobileContainer>
  }

  const isUp = (stockLine?.delta ?? 0) >= 0
  const displayName = entry?.name ?? '…'
  const displayBirth = entry?.birthDate
  const displayGender = entry?.gender

  return (
    <MobileContainer>
      <div className="min-h-screen flex flex-col">
        {/* Sticky Header + Tabs */}
        <div className="sticky top-0 z-30 bg-cp-raised/95 backdrop-blur border-b border-cp-border">
          <div className="px-4 pt-3 pb-2 flex items-center">
            <div className="flex items-center gap-1 flex-shrink-0 w-[72px]">
              <button onClick={() => router.push('/app/list')} className="w-8 h-8 flex items-center justify-center text-cp-muted hover:text-cp-muted text-lg leading-none">&larr;</button>
            </div>
            <div className="flex-1 text-center min-w-0">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="font-bold text-cp-text">{displayName}</span>
                {displayBirth && (
                  <>
                    <span className="text-sm text-cp-muted">(만 {calcAge(displayBirth)}세)</span>
                    <span className="text-xs text-cp-muted">&middot;</span>
                    <span className="text-sm text-cp-muted">{displayGender === 'female' ? '여성' : '남성'}</span>
                  </>
                )}
              </div>
              {entry && (
              <div className="flex items-center justify-center gap-1">
                <span className="text-xs text-cp-muted">{formatBirthLine(entry)}</span>
                <button
                  type="button"
                  onClick={() => router.push(`/app/input?edit=${id}`)}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-cp-muted hover:text-cp-line hover:bg-cp-surface transition-colors"
                  title="생년월일·출생시간 수정"
                  aria-label="사주 정보 수정"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 w-[72px] justify-end">
              <button onClick={handleRegenerateClick} disabled={regenerating}
                className="relative w-8 h-8 flex items-center justify-center text-cp-muted hover:text-cp-line disabled:opacity-30 transition-colors"
                title={isLoggedIn === false ? '운세 풀이 재생성 (로그인 필요)' : '운세 풀이 재생성'}>
                <svg className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h4.586M20 20v-5h-4.586M4.929 9A8 8 0 0119.07 9M19.071 15A8 8 0 014.93 15" />
                </svg>
                {isLoggedIn === false && (
                  <span className="absolute -bottom-0.5 -right-0.5 text-[9px] leading-none" aria-hidden>🔒</span>
                )}
              </button>
              <HamburgerMenu />
            </div>
          </div>
          <div className="flex border-t border-cp-border">
            {([['chart', '총운 차트'], ['info', '사주 정보']] as [TabKey, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                  tab === k ? 'text-cp-line border-b-2 border-cp-line' : 'text-cp-muted hover:text-cp-muted'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Summary line: sticky only for chart tab */}
          {tab === 'chart' && activeOverlay ? (
            <CompatSummaryBar
              info={activeOverlay}
              myName={entry?.name ?? '나'}
              scrolled={scrolled}
              onCta={handleCompatCta}
            />
          ) : tab === 'chart' && stockLine ? (
            <SummaryLine data={stockLine} isUp={isUp} scrolled={scrolled} />
          ) : null}
        </div>

        {/* Summary line: scrollable for info tab (not inside sticky header) */}
        {tab === 'info' && stockLine && (
          <SummaryLine data={stockLine} isUp={isUp} scrolled={false} />
        )}

        {/* 상단 슬림 배너 — 통일된 카피, 닫기 가능, 스크롤 시 자연스럽게 사라짐. */}
        {isLoggedIn === false && !guestBannerDismissed && (
          <div
            className={`px-4 mt-2 transition-all duration-200 ${
              bannerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="rounded-xl bg-cp-surface border border-cp-border px-3.5 py-2.5 flex items-center gap-2.5 animate-fade-in">
              <span className="text-base leading-none" aria-hidden>🔓</span>
              <p className="text-[12px] text-cp-line/90 leading-snug flex-1">
                로그인하면 모든 기능이 열려요
              </p>
              <button
                type="button"
                onClick={() => setLoginSheet({ open: true })}
                className="text-[12px] font-semibold text-cp-line px-2.5 py-1.5 rounded-md hover:bg-cp-border transition-colors min-h-[36px]"
              >
                로그인 →
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuestBannerDismissed(true)
                  try { sessionStorage.setItem('saju_login_banner_dismissed_v1', '1') } catch { /* ignore */ }
                }}
                aria-label="배너 닫기"
                className="w-7 h-7 flex items-center justify-center rounded-full text-cp-muted hover:text-cp-line hover:bg-cp-border transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 pb-16">
          <div className={tab === 'chart' ? '' : 'hidden'} ref={chartAreaRef}>
            {entry ? (
              <ChartTab
                report={report}
                birthYear={birthYear}
                fortuneJson={entry.fortuneJson}
                entryId={entry.id}
                currentName={entry.name}
                currentGender={entry.gender}
                overlayEntries={overlayEntries}
                isLocked={isLoggedIn !== true}
                onLockedClick={(feature) => setLoginSheet({ open: true, feature })}
                onOverlayChange={setActiveOverlay}
                onCompatCta={handleCompatCta}
                expandCompatCardKey={expandCompatCardKey}
                compatGeneration={compatGeneration}
                entryName={entry.name}
                myGender={entry.gender}
                initialOverlayId={initialOverlayId}
                initialFocus={initialFocus}
                weekSeries={entry.weekSeries}
                onFortuneJsonUpdate={(fj) => {
                  setEntry(prev => {
                    if (!prev) return prev
                    return { ...prev, fortuneJson: fj }
                  })
                }}
              />
            ) : (
              <div className="mx-3 mt-4 h-[300px] rounded-2xl bg-cp-surface border border-cp-border animate-pulse" />
            )}
          </div>
          {tab === 'info' && entry && (
            <InfoTab
              report={report}
              isLocked={isLoggedIn !== true}
              onLockedClick={(feature) => setLoginSheet({ open: true, feature })}
            />
          )}
        </div>

        <MinimalLegalFooter />

        <div className={`fixed bottom-0 left-0 right-0 z-20 transition-transform duration-300 ${toolbarVisible ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="mx-auto max-w-[446px] flex gap-2 px-4 py-2.5 bg-cp-raised/95 backdrop-blur-sm border-t border-cp-borderStrong">
            <button onClick={openShareSheet}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-cp-surface text-cp-secondary border border-cp-borderStrong hover:bg-cp-hover hover:text-cp-text transition-colors">
              공유하기
            </button>
            <button onClick={() => setSwitchSheetOpen(true)}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-cp-accent text-white hover:brightness-110 transition-colors">
              다른 사주 보기
            </button>
          </div>
        </div>
      </div>

      {/* Switch saju bottom sheet */}
      {switchSheetOpen && (
        <BottomSheet
          onClose={() => setSwitchSheetOpen(false)}
          header={<h3 className="font-bold text-cp-text pt-1 pb-2">다른 사주 보기</h3>}
          footer={(
            <div className="flex gap-2">
              <button onClick={() => { setSwitchSheetOpen(false); router.push('/app/list') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-cp-muted bg-cp-surface hover:bg-cp-border transition-colors">
                목록으로
              </button>
              <button onClick={() => { setSwitchSheetOpen(false); router.push('/app/input') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-cp-accent hover:brightness-110 transition-colors">
                새 사주 등록
              </button>
            </div>
          )}
        >
          {overlayEntries.filter(e => e.id !== id).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-cp-muted mb-3">다른 사주가 없습니다</p>
              <button onClick={() => { setSwitchSheetOpen(false); router.push('/app/input') }}
                className="text-sm text-cp-line font-medium">+ 새 사주 등록하기</button>
            </div>
          ) : (
            <div className="space-y-1">
              {overlayEntries.filter(e => e.id !== id).map(e => (
                <button key={e.id} onClick={() => { setSwitchSheetOpen(false); router.push(`/app/saju/${e.id}`) }}
                  className="w-full text-left p-3.5 rounded-xl hover:bg-cp-surface flex items-center gap-3 transition-colors">
                  <SajuCharacterAvatar gender={e.gender === 'female' ? 'female' : 'male'} element={normalizeElement(e.dayElement ?? undefined)} personId={e.id} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-cp-text text-sm">{e.name}</div>
                    <div className="text-xs text-cp-muted">{e.gender === 'female' ? '여성' : '남성'} · {e.birthDate.replace(/-/g, '.')}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </BottomSheet>
      )}
      {/* Share bottom sheet */}
      {shareOpen && (
        <BottomSheet
          onClose={() => setShareOpen(false)}
          header={<h3 className="font-bold text-cp-text text-center pt-1 pb-2">공유하기</h3>}
          footer={(
            <button onClick={() => setShareOpen(false)}
              className="w-full py-3 rounded-xl text-sm font-medium text-cp-muted border border-cp-border bg-transparent hover:bg-cp-hover/50 transition-colors">
              닫기
            </button>
          )}
        >
          <div className="space-y-2.5 pb-2">
            <div className="rounded-xl overflow-hidden border border-cp-border bg-cp-surface mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/share/${id}/opengraph-image?v=${ogPreviewKey}`}
                alt="카카오톡에 공유될 이미지 미리보기"
                className="w-full aspect-[1200/630] object-cover"
              />
            </div>
            <p className="text-[11px] text-cp-muted text-center -mt-1 mb-1">카카오톡에 이렇게 보여요</p>
            <button onClick={handleKakaoShare}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#FEE500] text-[#191600] hover:brightness-95 transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.67 1.78 5.01 4.44 6.35-.15.54-.97 3.5-.99 3.72 0 0-.02.17.09.24.11.06.24.01.24.01.32-.04 3.7-2.44 4.28-2.86.62.09 1.26.14 1.94.14 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"/></svg>
              카카오톡으로 공유
            </button>
            <button onClick={handleCopyLink}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-cp-accent text-white hover:bg-cp-accent/90 transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              링크 복사
            </button>
            <button onClick={handleImageSave} disabled={imageSaving}
              className="w-full py-3.5 rounded-xl text-sm font-semibold border border-cp-borderStrong bg-cp-input text-cp-secondary hover:bg-cp-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <svg className="w-5 h-5 text-cp-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              {imageSaving ? '저장 중...' : '이미지로 저장'}
            </button>
          </div>
        </BottomSheet>
      )}
      {/* Regenerate confirmation modal */}
      {regenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRegenModal(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-cp-bg rounded-2xl p-6 mx-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            {regenModal === 'confirm' ? (
              <>
                <p className="text-base font-semibold text-cp-text mb-1.5 text-center">운세 풀이를 다시 생성할까요?</p>
                <p className="text-sm text-cp-muted text-center mb-5">운세 해설 {READING_COST.fortune}주가 차감됩니다.</p>
                <div className="flex gap-3">
                  <button onClick={() => setRegenModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-cp-muted bg-cp-surface hover:bg-cp-border transition-colors">
                    나중에
                  </button>
                  <button onClick={handleRegenerateConfirm}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-cp-accent hover:shadow-lg transition-all active:scale-[0.98]">
                    운세 풀이 재생성
                  </button>
                </div>
              </>
            ) : regenModal === 'failed' ? (
              <>
                <p className="text-base font-semibold text-cp-text mb-1.5 text-center">재생성에 실패했습니다.</p>
                <p className="text-sm text-cp-muted text-center mb-5">이용권은 차감되지 않았습니다.</p>
                <div className="flex gap-3">
                  <button onClick={() => setRegenModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-cp-muted bg-cp-surface hover:bg-cp-border transition-colors">
                    나가기
                  </button>
                  <button onClick={handleRegenerateConfirm}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-cp-accent hover:shadow-lg transition-all active:scale-[0.98]">
                    다시 생성
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-cp-text mb-1.5 text-center">주(株)가 부족해요</p>
                <p className="text-sm text-cp-muted text-center mb-5">운세 해설은 {READING_COST.fortune}주가 필요해요.</p>
                <div className="flex gap-3">
                  <button onClick={() => setRegenModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-cp-muted bg-cp-surface hover:bg-cp-border transition-colors">
                    나중에
                  </button>
                  <button onClick={() => { setRegenModal(null); router.push(`/app/checkout?returnUrl=${encodeURIComponent(window.location.pathname)}`) }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-cp-accent hover:shadow-lg transition-all active:scale-[0.98]">
                    충전하기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <CompatConfirmSheet
        open={compatConfirmOpen}
        partnerName={activeOverlay?.overlayName ?? '상대'}
        myGender={entry?.gender ?? 'male'}
        partnerGender={activeOverlay?.overlayGender ?? 'male'}
        existingRelationships={activeOverlay?.generatedRelationships ?? []}
        onConfirm={handleCompatConfirm}
        onViewExisting={handleCompatViewExisting}
        onCancel={() => setCompatConfirmOpen(false)}
      />
      {juShortage && (
        <JuShortageNudge
          needed={juShortage.needed}
          current={juShortage.current}
          onDismiss={() => setJuShortage(null)}
        />
      )}
      <LoginPromptSheet
        open={loginSheet.open}
        onClose={() => setLoginSheet({ open: false })}
        feature={loginSheet.feature}
        returnTo={typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined}
      />
      <AlertSheet
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        onClose={() => setAlertState({ open: false, title: '' })}
      />
      <Toast
        open={welcomeToast}
        message="모든 잠금이 해제됐어요"
        onClose={() => setWelcomeToast(false)}
      />
    </MobileContainer>
  )
}

export default function PersonalSajuPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-cp-muted">불러오는 중...</div>}>
      <PersonalSajuPageInner />
    </Suspense>
  )
}
