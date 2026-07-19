'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LegalFooter } from '@/components/LegalFooter'
import { getGuestId } from '@/lib/auth/guest'
import { LandingHeroCarousel } from './LandingHeroCarousel'

function AbstractCurve() {
  return (
    <svg
      viewBox="0 0 400 120"
      className="absolute inset-x-0 top-[42%] w-full opacity-[0.06] pointer-events-none select-none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 80 C40 40, 80 95, 120 55 C160 15, 200 90, 240 50 C280 10, 320 75, 360 35 C380 20, 400 60, 400 60"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
      >
        <animate
          attributeName="d"
          values="M0 80 C40 40,80 95,120 55 C160 15,200 90,240 50 C280 10,320 75,360 35 C380 20,400 60,400 60;M0 70 C40 50,80 85,120 65 C160 25,200 80,240 40 C280 20,320 85,360 45 C380 30,400 50,400 50;M0 80 C40 40,80 95,120 55 C160 15,200 90,240 50 C280 10,320 75,360 35 C380 20,400 60,400 60"
          dur="8s"
          repeatCount="indefinite"
        />
      </path>
      <circle r="4" fill="white" opacity="0.6">
        <animateMotion
          dur="8s"
          repeatCount="indefinite"
          path="M0 80 C40 40,80 95,120 55 C160 15,200 90,240 50 C280 10,320 75,360 35 C380 20,400 60,400 60"
        />
      </circle>
    </svg>
  )
}

export default function LandingClient() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    router.prefetch('/app/input')
  }, [router])

  const handleKakaoLogin = useCallback(() => {
    const gid = getGuestId()
    const params = new URLSearchParams()
    if (gid) params.set('gid', gid)
    const qs = params.toString()
    window.location.href = qs ? `/api/auth/kakao/start?${qs}` : '/api/auth/kakao/start'
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex flex-col relative overflow-hidden">
      <AbstractCurve />

      {/*
        모바일: 로고 위 / 팁 flex-1 중앙 / 버튼 아래 (기존 리듬)
        md+: 세 영역을 한 클러스터로 묶어 화면 중앙 + 좁은 gap
      */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10 md:justify-center md:py-10">
        <div className="flex flex-col flex-1 md:flex-none items-center min-h-0 md:gap-5 w-full">
          <header className="pt-6 pb-2 md:pt-0 md:pb-0 flex justify-center shrink-0">
            <Image
              src="/svc_logo_with_slogan_vertical.png"
              alt="차트8자 — 사주팔자, 차트로 읽다."
              width={110}
              height={126}
              className="drop-shadow-lg"
              priority
            />
          </header>

          <main className="flex-1 md:flex-none flex flex-col justify-center min-h-0 py-4 md:py-0 w-full">
            <div className="w-full max-w-[360px] mx-auto px-0">
              <LandingHeroCarousel />
            </div>
          </main>

          <div className="w-full px-6 pt-3 pb-3 md:pt-0 md:pb-0 shrink-0">
            <div
              className={`max-w-[312px] mx-auto space-y-2.5 transition-opacity duration-200 ${
                mounted ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <button
                type="button"
                onClick={handleKakaoLogin}
                className="w-full py-4 rounded-2xl text-base font-bold bg-[#FEE500] text-[#3C1E1E] shadow-lg hover:brightness-95 active:scale-[0.98] transition-all"
              >
                카카오로 모두 보기
              </button>
              <Link
                href="/app/input"
                prefetch
                className="block w-full py-3.5 rounded-2xl text-sm font-bold text-white bg-slate-500/55 border border-slate-300/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-slate-400/55 hover:border-slate-200/50 active:scale-[0.98] transition-all text-center"
              >
                차트만 먼저 보기
              </Link>
              <p className="text-white/50 text-[11px] leading-relaxed text-center">
                카카오로 보면 모든 기능이 열려요
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-[400px] w-full mx-auto">
        <LegalFooter variant="dark" />
      </div>
    </div>
  )
}
