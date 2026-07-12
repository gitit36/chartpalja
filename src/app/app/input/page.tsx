'use client'

import { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { MobileContainer } from '@/components/MobileContainer'
import { MinimalLegalFooter } from '@/components/MinimalLegalFooter'
import { RecentEntryBanner } from '@/components/RecentEntryBanner'
import { ConfirmSheet } from '@/components/ConfirmSheet'
import { AlertSheet } from '@/components/AlertSheet'
import { getOrCreateGuestId, getGuestId } from '@/lib/auth/guest'
import { READING_COST } from '@/lib/payment/products'
import { Toast } from '@/components/Toast'

const FORTUNE_DEFERRED_TOAST =
  '차트·사주 정보는 바로 만들어요. 운세 해설은 주(株) 충전 후 생성돼요.'

interface FormData {
  name: string
  birthDate: string
  birthTime: string
  timeUnknown: boolean
  gender: 'male' | 'female'
  isLunar: boolean
  isLeapMonth: boolean
  job: string
}

const defaultForm: FormData = {
  name: '',
  birthDate: '',
  birthTime: '',
  timeUnknown: false,
  gender: 'male',
  isLunar: false,
  isLeapMonth: false,
  job: '',
}

const JOB_SUGGESTIONS = ['교사', '개발자', '트레이더', '디자이너', '마케터'] as const

function normalizeJob(raw: string): string {
  const trimmed = raw.trim().slice(0, 30)
  return trimmed || ''
}

function isValidDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function isValidTime(h: number, m: number): boolean {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function expandYyToYear(yy: number): number {
  // 미래 연도면 1900년대, 아니면 2000년대 (예: 97→1997, 02→2002, 26→2026)
  const candidate = 2000 + yy
  const now = new Date().getFullYear()
  return candidate > now ? 1900 + yy : candidate
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // 19xx/20xx로 시작하면 8자리(YYYYMMDD), 그 외는 6자리(YYMMDD)
  const isFullYear = digits.length >= 2 && (digits.startsWith('19') || digits.startsWith('20'))
  if (isFullYear) {
    const d = digits.slice(0, 8)
    if (d.length <= 4) return d
    if (d.length <= 6) return `${d.slice(0, 4)}.${d.slice(4)}`
    return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}`
  }
  const d = digits.slice(0, 6)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`
}

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return digits.slice(0, 2) + ':' + digits.slice(2)
}

function parseDateStr(formatted: string): string | null {
  const digits = formatted.replace(/\D/g, '')
  let y: number
  let m: number
  let d: number
  if (digits.length === 6) {
    y = expandYyToYear(Number(digits.slice(0, 2)))
    m = Number(digits.slice(2, 4))
    d = Number(digits.slice(4, 6))
  } else if (digits.length === 8) {
    y = Number(digits.slice(0, 4))
    m = Number(digits.slice(4, 6))
    d = Number(digits.slice(6, 8))
  } else {
    return null
  }
  if (!y || !m || !d) return null
  if (!isValidDate(y, m, d)) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseTimeStr(formatted: string): string | null {
  const parts = formatted.split(':')
  if (parts.length !== 2) return null
  const [h, m] = parts.map(Number)
  if (h == null || m == null || isNaN(h) || isNaN(m)) return null
  if (!isValidTime(h, m)) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const gid = getGuestId()
  if (gid) h['x-guest-id'] = gid
  return h
}

const LOADING_SLIDES = [
  {
    icon: '📈',
    title: '인생 흐름을 보는 차트예요',
    desc: '터치하면 시기별 점수를 볼 수 있어요',
    visual: (
      <div className="w-64 h-36 mx-auto mb-5 relative rounded-xl bg-cp-bg/10 border border-white/20 overflow-hidden">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path d="M10,70 Q40,30 70,50 T130,35 T190,45" fill="none" stroke="#F04452" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="100" y1="20" x2="100" y2="80" stroke="#F04452" strokeWidth="1" strokeDasharray="3 2" opacity="0.5"/>
          <circle cx="100" cy="42" r="3" fill="#F0445280"/>
          <text x="100" y="16" textAnchor="middle" fontSize="8" fill="#d8b4fe">2026</text>
        </svg>
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <span className="text-sm text-white/50">👆</span>
          <span className="text-[9px] text-white/40">터치</span>
        </div>
      </div>
    ),
  },
  {
    icon: '⚙️',
    title: '지표를 켜서 더 자세히 분석해요',
    desc: '대운선, 시즌 배경, 보조지표를 켤 수 있어요',
    visual: (
      <div className="w-64 mx-auto mb-5 rounded-xl bg-cp-bg/10 border border-white/20 p-4 space-y-3">
        {[
          { label: '대운 흐름선', on: true },
          { label: '시즌 배경색', on: true },
          { label: '📊 보조지표', on: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded border flex items-center justify-center ${item.on ? 'bg-cp-line/80 border-cp-border' : 'border-white/30'}`}>
              {item.on && <svg viewBox="0 0 14 14" className="w-3.5 h-3.5"><path d="M3 7l3 3 5-5" fill="none" stroke="white" strokeWidth="2"/></svg>}
            </div>
            <span className="text-sm text-white/70">{item.label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: '🗓️',
    title: '궁금한 기간만 골라 해설을 봐요',
    desc: '사주엔진이 선택한 기간의 운세를 해석해드려요',
    visual: (
      <div className="w-64 h-40 mx-auto mb-5 relative rounded-xl bg-cp-bg/10 border border-white/20 overflow-hidden">
        <div className="absolute top-2.5 right-3 bg-cp-bg/10 border border-white/20 rounded-full px-2.5 py-1 flex items-center gap-1">
          <span className="text-[10px]">🗓️</span>
          <span className="text-[9px] text-white/70 font-medium">구간</span>
        </div>
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path d="M10,60 Q50,30 90,50 T190,40" fill="none" stroke="#F04452" strokeWidth="2" opacity="0.4"/>
          <rect x="60" y="15" width="80" height="60" rx="4" fill="#F0445280" fillOpacity="0.15" stroke="#F04452" strokeWidth="1" strokeOpacity="0.4"/>
          <text x="100" y="88" textAnchor="middle" fontSize="8" fill="#d8b4fe">2030~2035년</text>
        </svg>
      </div>
    ),
  },
  {
    icon: '👥',
    title: '다른 사람과 비교해보세요',
    desc: '궁합 흐름을 차트 위에서 비교할 수 있어요',
    visual: (
      <div className="w-64 h-40 mx-auto mb-5 relative rounded-xl bg-cp-bg/10 border border-white/20 overflow-hidden">
        <div className="absolute top-2.5 right-3 bg-cp-bg/10 border border-white/20 rounded-full px-2.5 py-1 flex items-center gap-1">
          <span className="text-[10px]">👥</span>
          <span className="text-[9px] text-white/70 font-medium">비교</span>
        </div>
        <svg viewBox="0 0 200 100" className="w-full h-full">
          <path d="M10,55 Q50,25 90,45 T190,35" fill="none" stroke="#F04452" strokeWidth="2"/>
          <path d="M10,65 Q50,45 90,60 T190,50" fill="none" stroke="#fb7185" strokeWidth="2" strokeDasharray="4 2"/>
        </svg>
        <div className="absolute top-3 left-4 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-white/60"><span className="w-4 h-0.5 bg-cp-line rounded inline-block"/>나</span>
          <span className="flex items-center gap-1 text-[9px] text-white/60"><span className="w-4 h-0.5 bg-cp-down rounded inline-block"/>상대</span>
        </div>
      </div>
    ),
  },
  {
    icon: '🔮',
    title: '타고난 기운과 상세 해석을 봐요',
    desc: '사주원국, 관계, 신살 등 상세 분석이 있어요',
    visual: (
      <div className="w-64 mx-auto mb-5 rounded-xl bg-cp-bg/10 border border-white/20 p-4">
        <div className="flex gap-1.5 mb-3">
          <div className="flex-1 py-1.5 text-center rounded bg-cp-bg/5 text-xs text-white/40">총운 차트</div>
          <div className="flex-1 py-1.5 text-center rounded bg-cp-line/30 border border-cp-line/40 text-xs text-cp-muted font-medium">사주 정보</div>
        </div>
        <div className="space-y-2">
          {['사주원국', '타고난 기운의 관계', '타고난 복과 걸림돌'].map((label, i) => (
            <div key={i} className="flex items-center gap-2 bg-cp-bg/5 rounded px-3 py-1.5">
              <span className="text-xs text-white/60">{label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

function InputPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const compatInvite = searchParams.get('compatInvite')

  const [form, setForm] = useState<FormData>(defaultForm)
  const [dateDisplay, setDateDisplay] = useState('')
  const [timeDisplay, setTimeDisplay] = useState('')
  const [dateError, setDateError] = useState('')
  const [timeError, setTimeError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [prefilling, setPrefilling] = useState(!!editId)
  const [fortuneDeferredToast, setFortuneDeferredToast] = useState(false)
  const initialBirthRef = useRef<{
    birthDate: string
    birthTime: string
    timeUnknown: boolean
    isLunar: boolean
    isLeapMonth: boolean
    gender: FormData['gender']
  } | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [recentEntry, setRecentEntry] = useState<{ id: string; name: string } | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [duplicateAsk, setDuplicateAsk] = useState<{ open: boolean; message: string; existingId?: string }>({ open: false, message: '' })
  const [alertState, setAlertState] = useState<{ open: boolean; title: string; description?: string }>({ open: false, title: '' })
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (loadingInterval.current) clearInterval(loadingInterval.current) }
  }, [])

  // 게스트 ID 보장: 입력 페이지 진입 즉시 localStorage에 saju_guest_id를 생성한다.
  // 백엔드 sajuEntry는 user 또는 guest 둘 중 하나에 소유되어야 한다.
  useEffect(() => {
    getOrCreateGuestId()
  }, [])

  // 로그인 여부 조회 (잔액 체크 분기용 + 알림 띠 분기용).
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        setIsLoggedIn(!!data?.user)
      })
      .catch(() => { if (!cancelled) setIsLoggedIn(false) })
    return () => { cancelled = true }
  }, [])

  // 게스트 사용자가 입력 페이지로 다시 들어왔을 때, 이전에 만든 차트가 있으면 알림 띠로 안내.
  // editId 모드일 땐 노출하지 않는다(이미 특정 차트를 편집 중이므로).
  useEffect(() => {
    if (editId) return
    if (isLoggedIn !== false) return
    if (typeof window !== 'undefined') {
      const dismissed = sessionStorage.getItem('chartpalja_dismiss_recent_banner')
      if (dismissed === '1') {
        setBannerDismissed(true)
        return
      }
    }
    let cancelled = false
    fetch('/api/saju', { headers: getHeaders(), cache: 'no-store' })
      .then(r => r.ok ? r.json() : { entries: [] })
      .then((data) => {
        if (cancelled) return
        const entries = (data?.entries ?? []) as Array<{ id: string; name: string }>
        if (entries.length > 0) {
          setRecentEntry({ id: entries[0].id, name: entries[0].name })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [editId, isLoggedIn])

  useEffect(() => {
    if (!editId) return
    setPrefilling(true)
    const headers: Record<string, string> = {}
    const gid = getGuestId()
    if (gid) headers['x-guest-id'] = gid
    fetch(`/api/saju/${editId}`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        const bd = (data.birthDate ?? '') as string
        const bt = (data.birthTime ?? '') as string
        const newForm: FormData = {
          name: data.name ?? '',
          gender: data.gender === 'female' ? 'female' : 'male',
          birthDate: bd,
          birthTime: bt,
          timeUnknown: !!data.timeUnknown,
          isLunar: !!data.isLunar,
          isLeapMonth: !!data.isLeapMonth,
          job: data.job ?? '',
        }
        setForm(newForm)
        initialBirthRef.current = {
          birthDate: newForm.birthDate,
          birthTime: newForm.birthTime,
          timeUnknown: newForm.timeUnknown,
          isLunar: newForm.isLunar,
          isLeapMonth: newForm.isLeapMonth,
          gender: newForm.gender,
        }
        if (bd) {
          const parts = bd.split('-')
          if (parts.length === 3) setDateDisplay(parts.join('.'))
        }
        if (bt && !data.timeUnknown) {
          setTimeDisplay(bt)
        }
      })
      .catch(() => {})
      .finally(() => setPrefilling(false))
  }, [editId])

  const handleDateChange = useCallback((value: string) => {
    const formatted = formatDateInput(value)
    setDateDisplay(formatted)
    const digits = value.replace(/\D/g, '')
    const isFullYear = digits.length >= 2 && (digits.startsWith('19') || digits.startsWith('20'))
    // 8자리 YYYYMMDD, 또는 19/20이 아닌 6자리 YYMMDD만 확정 파싱
    const ready = digits.length === 8 || (digits.length === 6 && !isFullYear)
    if (ready) {
      const parsed = parseDateStr(formatted)
      if (parsed) {
        setForm(p => ({ ...p, birthDate: parsed }))
        setDateError('')
        // 6자리 입력이면 확인용으로 4자리 연도로 펼쳐 보여준다
        if (digits.length === 6 && !isFullYear) {
          const [y, m, d] = parsed.split('-')
          setDateDisplay(`${y}.${m}.${d}`)
        }
      } else {
        setDateError('올바르지 않은 날짜입니다')
        setForm(p => ({ ...p, birthDate: '' }))
      }
    } else {
      setDateError('')
      setForm(p => ({ ...p, birthDate: '' }))
    }
  }, [])

  const handleTimeChange = useCallback((value: string) => {
    const formatted = formatTimeInput(value)
    setTimeDisplay(formatted)
    const digits = value.replace(/\D/g, '')
    if (digits.length === 4) {
      const parsed = parseTimeStr(formatted)
      if (parsed) { setForm(p => ({ ...p, birthTime: parsed })); setTimeError('') }
      else { setTimeError('올바르지 않은 시간입니다'); setForm(p => ({ ...p, birthTime: '' })) }
    } else {
      setTimeError(''); setForm(p => ({ ...p, birthTime: '' }))
    }
  }, [])

  const canSubmit = !!form.name.trim() && !!form.birthDate && (form.timeUnknown || !!form.birthTime)

  const birthFieldsChanged = () => {
    const init = initialBirthRef.current
    if (!editId || !init) return true
    return (
      form.birthDate !== init.birthDate ||
      (form.timeUnknown ? null : form.birthTime) !== (init.timeUnknown ? null : init.birthTime) ||
      form.timeUnknown !== init.timeUnknown ||
      form.isLunar !== init.isLunar ||
      form.isLeapMonth !== init.isLeapMonth ||
      form.gender !== init.gender
    )
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    // 주가 부족해도 차트·사주 정보는 생성한다. 운세 해설만 미생성 — 미리 토스트로 안내.
    // 게스트는 무료 생성(한도만 적용)이므로 이 안내를 띄우지 않는다.
    if (isLoggedIn === true && birthFieldsChanged()) {
      try {
        const balRes = await fetch('/api/user/balance', { headers: getHeaders() })
        if (balRes.ok) {
          const bal = await balRes.json()
          if ((bal.ju ?? 0) < READING_COST.fortune) {
            setFortuneDeferredToast(true)
          }
        }
      } catch { /* proceed on network error */ }
    }

    setIsLoading(true)
    setLoadingStep(0)
    loadingInterval.current = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_SLIDES.length)
    }, 5000)

    try {
      if (editId) {
        const res = await fetch(`/api/saju/${editId}`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            name: form.name.trim(),
            gender: form.gender,
            birthDate: form.birthDate,
            birthTime: form.timeUnknown ? null : form.birthTime,
            timeUnknown: form.timeUnknown,
            isLunar: form.isLunar,
            isLeapMonth: form.isLunar && form.isLeapMonth,
            job: normalizeJob(form.job) || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || '수정 실패')
        }
        if (loadingInterval.current) clearInterval(loadingInterval.current)
        router.push(`/app/saju/${editId}`)
      } else {
        const res = await fetch('/api/saju', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            name: form.name.trim(),
            gender: form.gender,
            birthDate: form.birthDate,
            birthTime: form.timeUnknown ? null : form.birthTime,
            timeUnknown: form.timeUnknown,
            isLunar: form.isLunar,
            isLeapMonth: form.isLunar && form.isLeapMonth,
            job: normalizeJob(form.job) || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          if (err.error === 'duplicate') {
            if (loadingInterval.current) clearInterval(loadingInterval.current)
            setIsLoading(false)
            setDuplicateAsk({ open: true, message: err.message ?? '이미 동일한 사주 정보가 등록되어 있습니다.', existingId: err.existingId })
            return
          }
          if (err.error === 'guest_limit') {
            if (loadingInterval.current) clearInterval(loadingInterval.current)
            setIsLoading(false)
            setAlertState({
              open: true,
              title: '오늘의 게스트 한도를 채웠어요',
              description: err.message ?? '하루에 게스트로 만들 수 있는 차트는 3개까지예요. 로그인하면 무제한이에요.',
            })
            return
          }
          throw new Error(err.message || err.error || '분석 실패')
        }
        const { id } = await res.json()
        if (loadingInterval.current) clearInterval(loadingInterval.current)
        if (compatInvite) {
          try {
            const acceptRes = await fetch(`/api/compat/invite/${encodeURIComponent(compatInvite)}/accept`, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ inviteeEntryId: id }),
            })
            if (acceptRes.ok) {
              const acceptData = await acceptRes.json().catch(() => ({}))
              router.push(acceptData.redirectUrl ?? `/app/saju/${id}`)
              return
            }
          } catch { /* fall through to default redirect */ }
        }
        router.push(`/app/saju/${id}`)
      }
    } catch (error) {
      if (loadingInterval.current) clearInterval(loadingInterval.current)
      setIsLoading(false)
      setAlertState({
        open: true,
        title: '잠시 후 다시 시도해 주세요',
        description: error instanceof Error ? error.message : '오류가 발생했습니다',
      })
    }
  }

  if (isLoading) {
    const slide = LOADING_SLIDES[loadingStep % LOADING_SLIDES.length]
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-cp-bg via-cp-bg to-cp-surface flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm">
            <div className="relative mb-4">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2">
                <div className="w-16 h-16 rounded-full border-2 border-cp-line/30 border-t-cp-line animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image src="/svc_logo.png" alt="차트8자" width={28} height={26} className="animate-pulse drop-shadow-lg" />
                </div>
              </div>
            </div>

            <div className="mt-10 text-center">
              <p className="text-white/50 text-sm mb-5">사주를 분석하는 동안 사용법을 확인해보세요</p>
            </div>

            <div key={loadingStep} className="animate-fade-in text-center">
              {slide.visual}
              <p className="text-white/90 text-lg font-semibold mb-1.5">{slide.title}</p>
              <p className="text-white/60 text-base">{slide.desc}</p>
            </div>

            <div className="flex justify-center gap-2.5 mt-8">
              {LOADING_SLIDES.map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all duration-500 ${
                  i === loadingStep % LOADING_SLIDES.length ? 'w-7 bg-cp-line' : 'w-2 bg-cp-bg/20'
                }`} />
              ))}
            </div>

            <div className="mt-6" />
          </div>
        </div>
        <Toast
          open={fortuneDeferredToast}
          message={FORTUNE_DEFERRED_TOAST}
          duration={4500}
          onClose={() => setFortuneDeferredToast(false)}
        />
      </>
    )
  }

  if (prefilling) {
    return (
      <MobileContainer>
        <div className="flex items-center justify-center min-h-screen text-cp-muted">불러오는 중...</div>
      </MobileContainer>
    )
  }

  return (
    <MobileContainer>
      <div className="px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4 min-h-[44px]">
          <button
            onClick={() => router.back()}
            className="min-h-[44px] -ml-1 px-2 text-cp-muted text-sm hover:text-cp-muted hover:bg-cp-bg rounded-lg transition-colors"
            aria-label="뒤로가기"
          >
            &larr; 뒤로
          </button>
          <Image src="/svc_logo.png" alt="차트8자" width={32} height={29} />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-cp-text mb-1">{editId ? '사주 정보 수정' : '사주 정보 입력'}</h1>
          <p className="text-sm text-cp-muted">
            {compatInvite && !editId
              ? '입력하면 초대한 친구와 차트를 겹쳐볼 수 있어요'
              : editId
                ? (
                  <>
                    수정하면 차트·점수가 다시 계산돼요.
                    <br />
                    기존 운세 해설은 새로 생성해야 할 수 있어요.
                  </>
                )
                : '생년월일을 입력하면 인생 운세 차트를 그려드려요'}
          </p>
        </div>

        {!editId && recentEntry && !bannerDismissed && (
          <RecentEntryBanner
            name={recentEntry.name}
            onGo={() => router.push(`/app/saju/${recentEntry.id}`)}
            onDismiss={() => {
              setBannerDismissed(true)
              try { sessionStorage.setItem('chartpalja_dismiss_recent_banner', '1') } catch {}
            }}
          />
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-cp-text mb-1.5">이름</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-cp-border rounded-xl px-4 py-3 text-base bg-cp-input text-cp-text placeholder:text-cp-muted focus:ring-2 focus:ring-cp-accent/40 focus:border-cp-accent outline-none transition" placeholder="홍길동" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-cp-text mb-1.5">성별</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map(g => (
                <button key={g} onClick={() => setForm({ ...form, gender: g })}
                  className={`py-3 rounded-xl text-base font-medium transition-all ${
                    form.gender === g
                      ? (g === 'male' ? 'bg-blue-500 text-white' : 'bg-pink-500 text-white')
                      : 'bg-cp-input text-cp-muted hover:bg-cp-hover'
                  }`}>
                  {g === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-cp-text">생년월일</label>
              <div className="flex items-center gap-2">
                {form.isLunar && (
                  <div className="flex bg-cp-input rounded-full p-0.5 border border-cp-border">
                    <button onClick={() => setForm(p => ({ ...p, isLeapMonth: false }))}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-all ${
                        !form.isLeapMonth ? 'bg-cp-surface text-cp-text' : 'text-cp-muted'
                      }`}>평달</button>
                    <button onClick={() => setForm(p => ({ ...p, isLeapMonth: true }))}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-all ${
                        form.isLeapMonth ? 'bg-cp-surface text-cp-text' : 'text-cp-muted'
                      }`}>윤달</button>
                  </div>
                )}
                <div className="flex bg-cp-input rounded-full p-0.5 border border-cp-border">
                  <button onClick={() => setForm(p => ({ ...p, isLunar: false, isLeapMonth: false }))}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                      !form.isLunar ? 'bg-cp-surface text-cp-text' : 'text-cp-muted'
                    }`}>양력</button>
                  <button onClick={() => setForm(p => ({ ...p, isLunar: true }))}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                      form.isLunar ? 'bg-cp-surface text-cp-text' : 'text-cp-muted'
                    }`}>음력</button>
                </div>
              </div>
            </div>
            <input type="text" inputMode="numeric" value={dateDisplay} onChange={e => handleDateChange(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-lg tracking-wider bg-cp-input text-cp-text focus:ring-2 focus:ring-cp-accent/40 focus:border-cp-accent outline-none transition ${dateError ? 'border-red-400' : 'border-cp-border'}`}
              placeholder="예 990812 or 19990812" maxLength={10} />
            {dateError && <p className="text-cp-up text-xs mt-1">{dateError}</p>}
            {dateDisplay && !dateError && form.birthDate && (
              <p className="text-cp-muted text-xs mt-1">
                {form.birthDate.replace(/-/g, '.')} ({form.isLunar ? (form.isLeapMonth ? '음력 윤달' : '음력') : '양력'})
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-cp-text">태어난 시간</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-cp-muted">시간 모름</span>
                <div onClick={() => setForm(p => ({ ...p, timeUnknown: !p.timeUnknown }))}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.timeUnknown ? 'bg-cp-accent' : 'bg-cp-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-cp-text shadow transition-transform ${form.timeUnknown ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {form.timeUnknown ? (
              <div className="w-full border border-cp-border rounded-xl px-4 py-3 text-lg tracking-wider text-cp-muted bg-cp-input">--:--</div>
            ) : (
              <>
                <input type="text" inputMode="numeric" value={timeDisplay} onChange={e => handleTimeChange(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-lg tracking-wider bg-cp-input text-cp-text focus:ring-2 focus:ring-cp-accent/40 focus:border-cp-accent outline-none transition ${timeError ? 'border-red-400' : 'border-cp-border'}`}
                  placeholder="예: 0530" maxLength={5} />
                {timeError && <p className="text-cp-up text-xs mt-1">{timeError}</p>}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-cp-text mb-1.5">
              직업 <span className="font-normal text-cp-muted">(선택)</span>
            </label>
            <input
              type="text"
              value={form.job}
              onChange={e => setForm({ ...form, job: e.target.value.slice(0, 30) })}
              className="w-full border border-cp-border rounded-xl px-4 py-3 text-base bg-cp-input text-cp-text placeholder:text-cp-muted focus:ring-2 focus:ring-cp-accent/40 focus:border-cp-accent outline-none transition"
              placeholder="예: 디자이너, 마케터, 교사, 요리사"
              maxLength={30}
            />
            <div className={`flex flex-wrap gap-2 mt-2 transition-opacity ${form.job.trim() ? 'opacity-40' : 'opacity-100'}`}>
              {JOB_SUGGESTIONS.map(j => (
                <button
                  key={j}
                  type="button"
                  onClick={() => setForm({ ...form, job: j })}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                    form.job === j
                      ? 'bg-cp-surface border-cp-borderStrong text-cp-text font-medium'
                      : 'bg-cp-input border-cp-border text-cp-muted hover:bg-cp-hover hover:border-cp-borderStrong'
                  }`}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6"/>
        <button onClick={handleSubmit} disabled={!canSubmit}
          className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${
            canSubmit
              ? 'bg-cp-accent text-white active:scale-[0.98]'
              : 'bg-cp-border text-cp-muted cursor-not-allowed'
          }`}>
          {editId ? '수정 완료' : '내 운세 차트 보기'}
        </button>
      </div>

      <MinimalLegalFooter />

      <ConfirmSheet
        open={duplicateAsk.open}
        title="동일한 차트가 이미 있어요"
        description={duplicateAsk.message}
        confirmLabel="기존 결과 보기"
        cancelLabel="닫기"
        onConfirm={() => {
          const id = duplicateAsk.existingId
          setDuplicateAsk({ open: false, message: '' })
          if (id) router.push(`/app/saju/${id}`)
        }}
        onCancel={() => setDuplicateAsk({ open: false, message: '' })}
      />
      <AlertSheet
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        onClose={() => setAlertState({ open: false, title: '' })}
      />
    </MobileContainer>
  )
}

export default function InputPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-cp-muted">불러오는 중...</div>}>
      <InputPageInner />
    </Suspense>
  )
}
