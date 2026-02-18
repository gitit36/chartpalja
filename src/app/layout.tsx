import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '사주 분석',
  description: '사주 분석 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
