'use client'

import { useCallback } from 'react'
import Image from 'next/image'

function AbstractCurve() {
  return (
    <svg viewBox="0 0 400 120" className="absolute inset-x-0 top-1/3 w-full opacity-[0.07] pointer-events-none select-none" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 80 C40 40, 80 95, 120 55 C160 15, 200 90, 240 50 C280 10, 320 75, 360 35 C380 20, 400 60, 400 60"
        fill="none" stroke="white" strokeWidth="2.5"
      >
        <animate attributeName="d"
          values="M0 80 C40 40,80 95,120 55 C160 15,200 90,240 50 C280 10,320 75,360 35 C380 20,400 60,400 60;M0 70 C40 50,80 85,120 65 C160 25,200 80,240 40 C280 20,320 85,360 45 C380 30,400 50,400 50;M0 80 C40 40,80 95,120 55 C160 15,200 90,240 50 C280 10,320 75,360 35 C380 20,400 60,400 60"
          dur="8s" repeatCount="indefinite" />
      </path>
      <circle r="4" fill="white" opacity="0.6">
        <animateMotion dur="8s" repeatCount="indefinite"
          path="M0 80 C40 40,80 95,120 55 C160 15,200 90,240 50 C280 10,320 75,360 35 C380 20,400 60,400 60" />
      </circle>
    </svg>
  )
}

export default function LandingPage() {
  const handleKakaoLogin = useCallback(() => {
    window.location.href = '/api/auth/kakao/start'
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <AbstractCurve />

      <div className="max-w-[400px] w-full text-center relative z-10">
        <div className="mb-10">
          <Image
            src="/svc_logo_with_slogan_vertical.png"
            alt="차트8자 — 사주팔자, 차트로 읽다."
            width={180}
            height={206}
            className="mx-auto drop-shadow-lg"
            priority
          />
        </div>

        <p className="text-white/50 text-xs mb-10 tracking-wide">
          100년의 흐름을 하나의 차트로
        </p>

        <div className="space-y-3">
          <button
            onClick={handleKakaoLogin}
            className="w-full py-4 rounded-2xl text-base font-bold bg-[#FEE500] text-[#3C1E1E] shadow-lg hover:brightness-95 active:scale-[0.98] transition-all"
          >
            카카오로 시작하기
          </button>
        </div>

        <p className="text-white/30 text-[11px] mt-10">
          본 서비스는 참고용 분석 도구이며, 의료·법률·투자 자문이 아닙니다.
        </p>
      </div>
    </div>
  )
}
