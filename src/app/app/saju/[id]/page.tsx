'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'
import { ChartTab } from '@/components/ChartTab'
import { InfoTab } from '@/components/InfoTab'
import type { SajuReportJson } from '@/types/saju-report'
import type { ChartPayload } from '@/types/chart'
import { buildLifeChartData } from '@/lib/saju/life-chart-data'
import { HamburgerMenu } from '@/components/HamburgerMenu'
import { SajuCharacterAvatar, normalizeElement } from '@/components/SajuCharacterAvatar'
import { BottomSheet } from '@/components/BottomSheet'

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
  if (typeof window !== 'undefined') {
    const gid = localStorage.getItem('saju_guest_id')
    if (gid) h['x-guest-id'] = gid
  }
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


function SummaryLine({ stockLine, isUp, scrolled }: { stockLine: StockTypeLine; isUp: boolean; scrolled: boolean }) {
  const { linePath, areaPath, dotPos } = useMemo(() => {
    const data = stockLine.sparkData
    if (data.length < 2) return { linePath: '', areaPath: '', dotPos: null }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const w = 70
    const h = 20
    const pad = 1
    const pts = data.map((v, i) => ({
      x: (i / (data.length - 1)) * w,
      y: pad + (h - 2 * pad) - ((v - min) / range) * (h - 2 * pad),
    }))

    const n = pts.length
    const tangents: { x: number; y: number }[] = []
    for (let i = 0; i < n; i++) {
      if (i === 0) tangents.push({ x: pts[1]!.x - pts[0]!.x, y: pts[1]!.y - pts[0]!.y })
      else if (i === n - 1) tangents.push({ x: pts[n - 1]!.x - pts[n - 2]!.x, y: pts[n - 1]!.y - pts[n - 2]!.y })
      else {
        const s0 = (pts[i]!.y - pts[i - 1]!.y) / (pts[i]!.x - pts[i - 1]!.x || 1)
        const s1 = (pts[i + 1]!.y - pts[i]!.y) / (pts[i + 1]!.x - pts[i]!.x || 1)
        const m = (s0 + s1) / 2
        const dx = pts[i + 1]!.x - pts[i - 1]!.x
        tangents.push({ x: dx / 2, y: m * dx / 2 })
      }
    }

    let line = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i]!, p1 = pts[i + 1]!
      const t0 = tangents[i]!, t1 = tangents[i + 1]!
      const cp1x = p0.x + t0.x / 3, cp1y = p0.y + t0.y / 3
      const cp2x = p1.x - t1.x / 3, cp2y = p1.y - t1.y / 3
      line += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`
    }

    const area = line + ` L${pts[n - 1]!.x.toFixed(1)},${h} L${pts[0]!.x.toFixed(1)},${h} Z`
    const cidx = stockLine.currentIdx
    const dot = cidx >= 0 && cidx < n ? { x: pts[cidx]!.x, y: pts[cidx]!.y } : null
    return { linePath: line, areaPath: area, dotPos: dot }
  }, [stockLine.sparkData, stockLine.currentIdx])

  const strokeColor = isUp ? '#d63031' : '#2d6cdf'
  const fillColor = isUp ? 'rgba(214,48,49,0.1)' : 'rgba(45,108,223,0.1)'

  return (
    <div className={`px-4 h-[36px] flex items-center transition-colors ${
      scrolled
        ? (isUp ? 'bg-[#fff0f0] border-t border-[#ffcccc]' : 'bg-[#f0f4ff] border-t border-[#ccd6ff]')
        : 'bg-white'
    }`}>
      {!scrolled ? (
        <p className="text-[11px] text-gray-700 text-center font-medium w-full whitespace-nowrap overflow-hidden text-ellipsis">
          올해 운세 <span className="font-bold">{stockLine.score}점</span> | {stockLine.label}, {stockLine.desc} {stockLine.emoji}
        </p>
      ) : (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-baseline gap-2">
            <span className={`text-lg font-bold ${isUp ? 'text-[#d63031]' : 'text-[#2d6cdf]'}`}>{stockLine.score}</span>
            <span className={`text-xs font-semibold ${isUp ? 'text-[#e05050]' : 'text-[#4a8af4]'}`}>
              {isUp ? '\u25b2' : '\u25bc'}{Math.abs(stockLine.delta)}
            </span>
            <span className={`text-[10px] ${isUp ? 'text-[#e87070]' : 'text-[#6fa0f6]'}`}>
              ({isUp ? '+' : ''}{stockLine.deltaPercent}%)
            </span>
          </div>
          <svg width="70" height="20" viewBox="0 0 70 20" className="flex-shrink-0">
            <path d={areaPath} fill={fillColor} />
            <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
            {dotPos && <circle cx={dotPos.x} cy={dotPos.y} r="2.5" fill={strokeColor} stroke="white" strokeWidth="1" />}
          </svg>
        </div>
      )}
    </div>
  )
}

type TabKey = 'chart' | 'info'

export default function PersonalSajuPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
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

  useEffect(() => {
    fetch(`/api/saju/${id}`, { headers: getHeaders(), cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setEntry(d))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [id])

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

  const handleRegenerateClick = useCallback(async () => {
    try {
      const balRes = await fetch('/api/user/balance', { headers: getHeaders() })
      if (balRes.ok) {
        const bal = await balRes.json()
        if ((bal.chartCredits ?? 0) > 0) {
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
  }, [])

  const handleRegenerateConfirm = useCallback(async () => {
    setRegenModal(null)
    setRegenerating(true)
    try {
      const headers = getHeaders()
      const res = await fetch(`/api/saju/${id}/fortune?regenerate=true&consumeCredit=true`, { headers })
      if (res.ok) {
        const d = await res.json()
        if (d?.items) {
          setEntry(prev => prev ? { ...prev, fortuneJson: { items: d.items } } : prev)
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

  const handleKakaoShare = useCallback(() => {
    if (!entry) return
    const kakao = window.Kakao
    if (!kakao) { alert('카카오 SDK를 불러오지 못했습니다.'); return }
    const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
    if (jsKey && !kakao.isInitialized()) {
      try { kakao.init(jsKey) } catch { /* already initialized */ }
    }
    if (!kakao.isInitialized()) { alert('카카오 앱키가 설정되지 않았습니다.'); return }
    const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://chartpalja.com'
    try {
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `${entry.name}님의 인생 차트`,
          description: stockLine ? `올해 운세 ${stockLine.score}점 | ${stockLine.label}` : '100년의 흐름을 하나의 차트로',
          imageUrl: `${siteUrl}/svc_logo_with_slogan_horizontal.png`,
          link: { mobileWebUrl: pageUrl, webUrl: pageUrl },
        },
        buttons: [{ title: '차트 보기', link: { mobileWebUrl: pageUrl, webUrl: pageUrl } }],
      })
    } catch (err) {
      console.error('Kakao share error:', err)
      alert('카카오톡 공유에 실패했습니다.')
    }
    setShareOpen(false)
  }, [entry, stockLine])

  const handleCopyLink = useCallback(async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      alert('링크가 복사되었어요!')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      alert('링크가 복사되었어요!')
    }
    setShareOpen(false)
  }, [])

  const handleImageSave = useCallback(async () => {
    setImageSaving(true)
    try {
      window.dispatchEvent(new Event('fortune-expand-all'))
      await new Promise(r => setTimeout(r, 150))

      const html2canvas = (await import('html2canvas')).default
      const targets = document.querySelectorAll<HTMLElement>('[data-capture]')
      if (!targets.length) { alert('저장할 콘텐츠가 없습니다.'); setImageSaving(false); return }

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
      alert('이미지 저장에 실패했습니다.')
    }
    setImageSaving(false)
    setShareOpen(false)
  }, [entry?.name])

  if (loading) {
    return <MobileContainer><div className="flex items-center justify-center min-h-screen text-gray-400">불러오는 중...</div></MobileContainer>
  }
  if (!entry) {
    return <MobileContainer><div className="flex flex-col items-center justify-center min-h-screen text-gray-500 gap-2"><p>데이터를 찾을 수 없습니다</p><button onClick={() => router.push('/app/list')} className="text-purple-600 text-sm">목록으로</button></div></MobileContainer>
  }

  const isUp = (stockLine?.delta ?? 0) >= 0

  return (
    <MobileContainer>
      <div>
        {/* Sticky Header + Tabs */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
          <div className="px-4 pt-3 pb-2 flex items-center">
            <div className="flex items-center gap-1 flex-shrink-0 w-[72px]">
              <button onClick={() => router.push('/app/list')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg leading-none">&larr;</button>
            </div>
            <div className="flex-1 text-center min-w-0">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="font-bold text-gray-900">{entry.name}</span>
                <span className="text-sm text-gray-500">(만 {calcAge(entry.birthDate)}세)</span>
                <span className="text-xs text-gray-400">&middot;</span>
                <span className="text-sm text-gray-500">{entry.gender === 'female' ? '여성' : '남성'}</span>
              </div>
              <div className="text-xs text-gray-500">{formatBirthLine(entry)}</div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 w-[72px] justify-end">
              <button onClick={handleRegenerateClick} disabled={regenerating}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-purple-600 disabled:opacity-30 transition-colors"
                title="운세 재분석">
                <svg className={`w-5 h-5 ${regenerating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h4.586M20 20v-5h-4.586M4.929 9A8 8 0 0119.07 9M19.071 15A8 8 0 014.93 15" />
                </svg>
              </button>
              <HamburgerMenu />
            </div>
          </div>
          <div className="flex border-t border-gray-50">
            {([['chart', '총운 차트'], ['info', '사주 정보']] as [TabKey, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                  tab === k ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Summary line: sticky only for chart tab */}
          {tab === 'chart' && stockLine && (
            <SummaryLine stockLine={stockLine} isUp={isUp} scrolled={scrolled} />
          )}
        </div>

        {/* Summary line: scrollable for info tab (not inside sticky header) */}
        {tab === 'info' && stockLine && (
          <SummaryLine stockLine={stockLine} isUp={isUp} scrolled={false} />
        )}

        <div className="pb-16">
          <div className={tab === 'chart' ? '' : 'hidden'} ref={chartAreaRef}>
            <ChartTab report={report} birthYear={birthYear} fortuneJson={entry.fortuneJson} entryId={entry.id} currentName={entry.name} currentGender={entry.gender} overlayEntries={overlayEntries} />
          </div>
          <div className={tab === 'info' ? '' : 'hidden'}>
            <InfoTab report={report} />
          </div>
        </div>

        <div className={`fixed bottom-0 left-0 right-0 z-20 transition-transform duration-300 ${toolbarVisible ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="mx-auto max-w-[446px] flex gap-2 px-4 py-2 bg-white/95 backdrop-blur-sm border-t border-gray-100">
            <button onClick={() => setShareOpen(true)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              공유하기
            </button>
            <button onClick={() => setSwitchSheetOpen(true)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors">
              다른 사주 보기
            </button>
          </div>
        </div>
      </div>

      {/* Switch saju bottom sheet */}
      {switchSheetOpen && (
        <BottomSheet onClose={() => setSwitchSheetOpen(false)}>
          <h3 className="font-bold text-gray-900 mb-4">다른 사주 보기</h3>
          {overlayEntries.filter(e => e.id !== id).length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 mb-3">다른 사주가 없습니다</p>
              <button onClick={() => { setSwitchSheetOpen(false); router.push('/app/input') }}
                className="text-sm text-purple-600 font-medium">+ 새 사주 등록하기</button>
            </div>
          ) : (
            <div className="space-y-1">
              {overlayEntries.filter(e => e.id !== id).map(e => (
                <button key={e.id} onClick={() => { setSwitchSheetOpen(false); router.push(`/app/saju/${e.id}`) }}
                  className="w-full text-left p-3.5 rounded-xl hover:bg-purple-50 flex items-center gap-3 transition-colors">
                  <SajuCharacterAvatar gender={e.gender === 'female' ? 'female' : 'male'} element={normalizeElement(e.dayElement ?? undefined)} personId={e.id} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">{e.name}</div>
                    <div className="text-xs text-gray-400">{e.gender === 'female' ? '여성' : '남성'} · {e.birthDate.replace(/-/g, '.')}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
            <button onClick={() => { setSwitchSheetOpen(false); router.push('/app/list') }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
              목록으로
            </button>
            <button onClick={() => { setSwitchSheetOpen(false); router.push('/app/input') }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors">
              새 사주 등록
            </button>
          </div>
        </BottomSheet>
      )}
      {/* Share bottom sheet */}
      {shareOpen && (
        <BottomSheet onClose={() => setShareOpen(false)}>
          <h3 className="font-bold text-gray-900 mb-4 text-center">공유하기</h3>
          <div className="space-y-2.5">
            <button onClick={handleKakaoShare}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#FEE500] text-[#3C1E1E] hover:brightness-95 transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3C1E1E"><path d="M12 3C6.48 3 2 6.36 2 10.5c0 2.67 1.78 5.01 4.44 6.35-.15.54-.97 3.5-.99 3.72 0 0-.02.17.09.24.11.06.24.01.24.01.32-.04 3.7-2.44 4.28-2.86.62.09 1.26.14 1.94.14 5.52 0 10-3.36 10-7.5S17.52 3 12 3z"/></svg>
              카카오톡으로 공유
            </button>
            <button onClick={handleCopyLink}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              링크 복사
            </button>
            <button onClick={handleImageSave} disabled={imageSaving}
              className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              {imageSaving ? '저장 중...' : '이미지로 저장'}
            </button>
          </div>
          <button onClick={() => setShareOpen(false)}
            className="w-full py-3 mt-3 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors">
            닫기
          </button>
        </BottomSheet>
      )}
      {/* Regenerate confirmation modal */}
      {regenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRegenModal(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl p-6 mx-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            {regenModal === 'confirm' ? (
              <>
                <p className="text-base font-semibold text-gray-900 mb-1.5 text-center">새로운 운세 해설을 받아볼 수 있어요.</p>
                <p className="text-sm text-gray-500 text-center mb-5">이용권 1회가 사용됩니다. 다시 생성할까요?</p>
                <div className="flex gap-3">
                  <button onClick={() => setRegenModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                    나중에
                  </button>
                  <button onClick={handleRegenerateConfirm}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg transition-all active:scale-[0.98]">
                    다시 생성
                  </button>
                </div>
              </>
            ) : regenModal === 'failed' ? (
              <>
                <p className="text-base font-semibold text-gray-900 mb-1.5 text-center">재생성에 실패했습니다.</p>
                <p className="text-sm text-gray-500 text-center mb-5">이용권은 차감되지 않았습니다.</p>
                <div className="flex gap-3">
                  <button onClick={() => setRegenModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                    나가기
                  </button>
                  <button onClick={handleRegenerateConfirm}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg transition-all active:scale-[0.98]">
                    다시 생성
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-gray-900 mb-1.5 text-center">이용권이 모두 사용됐어요.</p>
                <p className="text-sm text-gray-500 text-center mb-5">새로운 해설을 보려면 이용권이 필요해요.</p>
                <div className="flex gap-3">
                  <button onClick={() => setRegenModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
                    나중에
                  </button>
                  <button onClick={() => { setRegenModal(null); router.push(`/app/checkout?returnUrl=${encodeURIComponent(window.location.pathname)}`) }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg transition-all active:scale-[0.98]">
                    이용권 구매
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </MobileContainer>
  )
}
