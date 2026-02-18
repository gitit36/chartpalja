'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MobileContainer } from '@/components/MobileContainer'

const SAJU_DRAFT_KEY = 'saju_input_draft'

export type SajuDraft = {
  name: string
  birthDate: string
  birthTime: string
  timeUnknown: boolean
  gender: 'male' | 'female'
  isLunar: boolean
  city: string
  useSolarTime: boolean
  earlyZiTime: boolean
  utcOffset: number
}

const defaultDraft: SajuDraft = {
  name: '',
  birthDate: '',
  birthTime: '',
  timeUnknown: false,
  gender: 'male',
  isLunar: false,
  city: 'Seoul',
  useSolarTime: true,
  earlyZiTime: true,
  utcOffset: 9,
}

function isValidDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function isValidTime(h: number, m: number): boolean {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return digits.slice(0, 4) + '.' + digits.slice(4)
  return digits.slice(0, 4) + '.' + digits.slice(4, 6) + '.' + digits.slice(6)
}

function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return digits.slice(0, 2) + ':' + digits.slice(2)
}

function parseDateStr(formatted: string): string | null {
  const parts = formatted.replace(/\./g, '-').split('-')
  if (parts.length !== 3) return null
  const [y, m, d] = parts.map(Number)
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

const LOADING_MESSAGES = [
  '하늘의 별자리를 읽고 있어요...',
  '사주팔자의 기운을 분석하는 중...',
  '당신만의 운명 지도를 그리고 있어요...',
  '오행의 흐름을 계산하고 있어요...',
  '대운의 파도를 읽어내는 중...',
  '인생 그래프가 곧 완성돼요!',
]

export default function InputPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<SajuDraft>(defaultDraft)
  const [dateDisplay, setDateDisplay] = useState('')
  const [timeDisplay, setTimeDisplay] = useState('')
  const [dateError, setDateError] = useState('')
  const [timeError, setTimeError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current)
    }
  }, [])

  const handleDateChange = useCallback((value: string) => {
    const formatted = formatDateInput(value)
    setDateDisplay(formatted)
    const digits = value.replace(/\D/g, '')
    if (digits.length === 8) {
      const parsed = parseDateStr(formatted)
      if (parsed) {
        setFormData(prev => ({ ...prev, birthDate: parsed }))
        setDateError('')
      } else {
        setDateError('올바르지 않은 날짜입니다')
        setFormData(prev => ({ ...prev, birthDate: '' }))
      }
    } else {
      setDateError('')
      setFormData(prev => ({ ...prev, birthDate: '' }))
    }
  }, [])

  const handleTimeChange = useCallback((value: string) => {
    const formatted = formatTimeInput(value)
    setTimeDisplay(formatted)
    const digits = value.replace(/\D/g, '')
    if (digits.length === 4) {
      const parsed = parseTimeStr(formatted)
      if (parsed) {
        setFormData(prev => ({ ...prev, birthTime: parsed }))
        setTimeError('')
      } else {
        setTimeError('올바르지 않은 시간입니다')
        setFormData(prev => ({ ...prev, birthTime: '' }))
      }
    } else {
      setTimeError('')
      setFormData(prev => ({ ...prev, birthTime: '' }))
    }
  }, [])

  const canSubmit = formData.birthDate && (formData.timeUnknown || formData.birthTime)

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsLoading(true)
    setLoadingStep(0)
    loadingInterval.current = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 1800)

    try {
      const birthYear = parseInt(formData.birthDate.slice(0, 4), 10)
      const inputRedacted = {
        birthYear,
        gender: formData.gender,
        city: formData.city,
        useSolarTime: formData.useSolarTime,
        earlyZiTime: formData.earlyZiTime,
        utcOffset: formData.utcOffset,
        timeUnknown: formData.timeUnknown,
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(SAJU_DRAFT_KEY, JSON.stringify(formData))
        if (formData.name) window.sessionStorage.setItem('saju_user_name', formData.name)
      }

      const createRes = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputRedacted }),
      })
      if (!createRes.ok) throw new Error('세션 생성 실패')
      const { sessionId } = await createRes.json()

      const sajuRes = await fetch(`/api/sessions/${sessionId}/saju`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthDate: formData.birthDate,
          birthTime: formData.timeUnknown ? '12:00' : formData.birthTime,
          timeUnknown: formData.timeUnknown,
          gender: formData.gender,
          city: formData.city,
          useSolarTime: formData.useSolarTime,
          earlyZiTime: formData.earlyZiTime,
          utcOffset: formData.utcOffset,
        }),
      })

      if (!sajuRes.ok) {
        const err = await sajuRes.json().catch(() => ({}))
        throw new Error(err.error || '분석 실패')
      }

      window.sessionStorage.removeItem(SAJU_DRAFT_KEY)
      if (loadingInterval.current) clearInterval(loadingInterval.current)
      router.push(`/app/session/${sessionId}/summary`)
    } catch (error) {
      if (loadingInterval.current) clearInterval(loadingInterval.current)
      setIsLoading(false)
      const msg = error instanceof Error ? error.message : '오류가 발생했습니다'
      alert(msg)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex flex-col items-center justify-center px-6">
        <div className="relative mb-10">
          <div className="w-24 h-24 rounded-full border-4 border-purple-400/30 border-t-purple-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-3xl animate-pulse">&#x2728;</div>
          </div>
        </div>
        <p className="text-white/90 text-lg font-medium text-center animate-pulse min-h-[56px] flex items-center">
          {LOADING_MESSAGES[loadingStep]}
        </p>
        <div className="flex gap-1.5 mt-6">
          {LOADING_MESSAGES.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i <= loadingStep ? 'bg-purple-400' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <MobileContainer>
      <div className="py-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">내 사주 분석</h1>
          <p className="text-sm text-gray-500">생년월일을 입력하면 인생 운세 차트를 그려드려요</p>
        </div>

        <div className="space-y-5">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">이름 (선택)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition"
              placeholder="홍길동"
            />
          </div>

          {/* 성별 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">성별</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormData({ ...formData, gender: 'male' })}
                className={`py-3 rounded-xl text-base font-medium transition-all ${
                  formData.gender === 'male'
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                남성
              </button>
              <button
                onClick={() => setFormData({ ...formData, gender: 'female' })}
                className={`py-3 rounded-xl text-base font-medium transition-all ${
                  formData.gender === 'female'
                    ? 'bg-pink-500 text-white shadow-md shadow-pink-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                여성
              </button>
            </div>
          </div>

          {/* 생년월일 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">생년월일</label>
              <button
                onClick={() => setFormData(prev => ({ ...prev, isLunar: !prev.isLunar }))}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                  formData.isLunar
                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                    : 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                }`}
              >
                {formData.isLunar ? '음력 선택됨' : '양력 선택됨'}
              </button>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={dateDisplay}
              onChange={(e) => handleDateChange(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-lg tracking-wider focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition ${
                dateError ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
              placeholder="예: 19970306"
              maxLength={10}
            />
            {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
            {dateDisplay && !dateError && formData.birthDate && (
              <p className="text-emerald-600 text-xs mt-1">{formData.birthDate.replace(/-/g, '.')} ({formData.isLunar ? '음력' : '양력'})</p>
            )}
          </div>

          {/* 태어난 시간 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">태어난 시간</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setFormData(prev => ({ ...prev, timeUnknown: !prev.timeUnknown }))}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                    formData.timeUnknown ? 'bg-purple-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    formData.timeUnknown ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </div>
                <span className="text-xs text-gray-600">시간 모름</span>
              </label>
            </div>
            {formData.timeUnknown ? (
              <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg tracking-wider text-gray-400 bg-gray-50">
                --:--
              </div>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  value={timeDisplay}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-lg tracking-wider focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition ${
                    timeError ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="예: 0325"
                  maxLength={5}
                />
                {timeError && <p className="text-red-500 text-xs mt-1">{timeError}</p>}
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6 mb-4 text-center">
          입력된 정보는 분석에만 사용되며 서버에 저장되지 않습니다.
        </p>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${
            canSubmit
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl hover:from-purple-700 hover:to-indigo-700 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          내 운세 차트 보기
        </button>
      </div>
    </MobileContainer>
  )
}
