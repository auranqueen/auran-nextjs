import type { Metadata, Viewport } from 'next'
import { Nanum_Myeongjo } from 'next/font/google'
import './globals.css'

const nanumMyeongjo = Nanum_Myeongjo({
  weight: ['400', '700', '800'],
  subsets: ['latin'],
  variable: '--font-nanum',
})

export const metadata: Metadata = {
  title: 'AURAN · AI 피부 분석 플랫폼',
  description: 'AI 피부 분석부터 맞춤 제품 추천, 클리닉 예약까지',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={nanumMyeongjo.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Noto+Serif+KR:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
