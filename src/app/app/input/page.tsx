'use client'

import { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { MobileContainer } from '@/components/MobileContainer'

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

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    const gid = localStorage.getItem('saju_guest_id')
    if (gid) h['x-guest-id'] = gid
  }
  return h
}

const LOADING_MESSAGES = [
  '100년의 흐름을 분석하고 있어요...',
  '당신만의 리듬을 찾고 있어요...',
  '인생의 챕터를 나누고 있어요...',
  '운명의 차트가 곧 완성돼요...',
]

function InputPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [form, setForm] = useState<FormData>(defaultForm)
  const [dateDisplay, setDateDisplay] = useState('')
  const [timeDisplay, setTimeDisplay] = useState('')
  const [dateError, setDateError] = useState('')
  const [timeError, setTimeError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [prefilling, setPrefilling] = useState(!!editId)
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (loadingInterval.current) clearInterval(loadingInterval.current) }
  }, [])

  useEffect(() => {
    if (!editId) return
    setPrefilling(true)
    const headers: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      const gid = localStorage.getItem('saju_guest_id')
      if (gid) headers['x-guest-id'] = gid
    }
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
    if (digits.length === 8) {
      const parsed = parseDateStr(formatted)
      if (parsed) { setForm(p => ({ ...p, birthDate: parsed })); setDateError('') }
      else { setDateError('올바르지 않은 날짜입니다'); setForm(p => ({ ...p, birthDate: '' })) }
    } else {
      setDateError(''); setForm(p => ({ ...p, birthDate: '' }))
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

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsLoading(true)
    setLoadingStep(0)
    loadingInterval.current = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 1800)

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
            const goExisting = confirm(err.message + '\n\n기존 결과를 보시겠습니까?')
            if (goExisting && err.existingId) router.push('/app/saju/' + err.existingId)
            return
          }
          throw new Error(err.error || '분석 실패')
        }
        const { id } = await res.json()
        if (loadingInterval.current) clearInterval(loadingInterval.current)
        router.push(`/app/saju/${id}`)
      }
    } catch (error) {
      if (loadingInterval.current) clearInterval(loadingInterval.current)
      setIsLoading(false)
      alert(error instanceof Error ? error.message : '오류가 발생했습니다')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex flex-col items-center justify-center px-6">
        <div className="relative mb-12">
          <div className="w-32 h-32 rounded-full border-4 border-purple-400/30 border-t-purple-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Image src="/svc_logo.png" alt="차트8자" width={56} height={51} className="animate-pulse drop-shadow-lg" />
          </div>
        </div>
        <p className="text-white/90 text-lg font-medium text-center min-h-[56px] flex items-center">
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

  if (prefilling) {
    return (
      <MobileContainer>
        <div className="flex items-center justify-center min-h-screen text-gray-400">불러오는 중...</div>
      </MobileContainer>
    )
  }

  return (
    <MobileContainer>
      <div className="px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="text-gray-400 text-sm hover:text-gray-600">&larr; 뒤로</button>
          <Image src="/svc_logo.png" alt="차트8자" width={32} height={29} />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{editId ? '사주 정보 수정' : '사주 정보 입력'}</h1>
          <p className="text-sm text-gray-500">{editId ? '수정할 내용을 변경한 뒤 저장해주세요' : '생년월일을 입력하면 인생 운세 차트를 그려드려요'}</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">이름</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition" placeholder="홍길동" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">성별</label>
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map(g => (
                <button key={g} onClick={() => setForm({ ...form, gender: g })}
                  className={`py-3 rounded-xl text-base font-medium transition-all ${
                    form.gender === g
                      ? (g === 'male' ? 'bg-blue-500 text-white shadow-md shadow-blue-200' : 'bg-pink-500 text-white shadow-md shadow-pink-200')
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {g === 'male' ? '남성' : '여성'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">생년월일</label>
              <div className="flex items-center gap-2">
                {form.isLunar && (
                  <div className="flex bg-amber-50 rounded-full p-0.5 border border-amber-200">
                    <button onClick={() => setForm(p => ({ ...p, isLeapMonth: false }))}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-all ${
                        !form.isLeapMonth ? 'bg-white text-amber-700 shadow-sm' : 'text-amber-400'
                      }`}>평달</button>
                    <button onClick={() => setForm(p => ({ ...p, isLeapMonth: true }))}
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-all ${
                        form.isLeapMonth ? 'bg-white text-amber-700 shadow-sm' : 'text-amber-400'
                      }`}>윤달</button>
                  </div>
                )}
                <div className="flex bg-gray-100 rounded-full p-0.5">
                  <button onClick={() => setForm(p => ({ ...p, isLunar: false, isLeapMonth: false }))}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                      !form.isLunar ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'
                    }`}>양력</button>
                  <button onClick={() => setForm(p => ({ ...p, isLunar: true }))}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                      form.isLunar ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-400'
                    }`}>음력</button>
                </div>
              </div>
            </div>
            <input type="text" inputMode="numeric" value={dateDisplay} onChange={e => handleDateChange(e.target.value)}
              className={`w-full border rounded-xl px-4 py-3 text-lg tracking-wider focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition ${dateError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              placeholder="예: 19990812" maxLength={10} />
            {dateError && <p className="text-red-500 text-xs mt-1">{dateError}</p>}
            {dateDisplay && !dateError && form.birthDate && (
              <p className="text-emerald-600 text-xs mt-1">
                {form.birthDate.replace(/-/g, '.')} ({form.isLunar ? (form.isLeapMonth ? '음력 윤달' : '음력') : '양력'})
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700">태어난 시간</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-600">시간 모름</span>
                <div onClick={() => setForm(p => ({ ...p, timeUnknown: !p.timeUnknown }))}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.timeUnknown ? 'bg-purple-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.timeUnknown ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {form.timeUnknown ? (
              <div className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg tracking-wider text-gray-400 bg-gray-50">--:--</div>
            ) : (
              <>
                <input type="text" inputMode="numeric" value={timeDisplay} onChange={e => handleTimeChange(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-3 text-lg tracking-wider focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition ${timeError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                  placeholder="예: 0530" maxLength={5} />
                {timeError && <p className="text-red-500 text-xs mt-1">{timeError}</p>}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              직업 <span className="font-normal text-gray-400">(선택)</span>
            </label>
            <input
              type="text"
              value={form.job}
              onChange={e => setForm({ ...form, job: e.target.value.slice(0, 30) })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition"
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
                      ? 'bg-purple-100 border-purple-300 text-purple-700 font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300'
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
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-200 hover:shadow-xl active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}>
          {editId ? '수정 완료' : '내 운세 차트 보기'}
        </button>
      </div>
    </MobileContainer>
  )
}

export default function InputPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400">불러오는 중...</div>}>
      <InputPageInner />
    </Suspense>
  )
}
