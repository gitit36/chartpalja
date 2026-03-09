import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
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
    <html lang="ko">
      <body>
        {children}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          integrity="sha384-DKYJZ8NLiK8MN4/C5P2ezmFnNNIXu520BJ0woLgSJmwk/RqQ1gwWKOhMzFJ0wPo"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
