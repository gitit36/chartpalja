import type { Metadata } from 'next'
import Script from 'next/script'
import { Suspense } from 'react'
import { PathTracker } from '@/components/PathTracker'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.chartpalja.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '차트팔자 — 내 인생의 리듬',
  description: '100년의 흐름을 하나의 차트로. 사주 기반 인생 운세 시각화 서비스.',
  openGraph: {
    title: '차트팔자 — 내 인생의 리듬',
    description: '100년의 흐름을 하나의 차트로',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <Suspense fallback={null}>
          <PathTracker />
        </Suspense>
        {children}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
