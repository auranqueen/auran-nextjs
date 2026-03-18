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
  description: '내 피부를 가장 잘 아는 AI 뷰티 플랫폼',
  metadataBase: new URL('https://auran.kr'),
  openGraph: {
    title: 'AURAN · AI 피부 분석 플랫폼',
    description: '내 피부를 가장 잘 아는 AI 뷰티 플랫폼',
    url: 'https://auran.kr',
    siteName: 'AURAN',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AURAN · AI 피부 분석 플랫폼' }],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AURAN · AI 피부 분석 플랫폼',
    description: '내 피부를 가장 잘 아는 AI 뷰티 플랫폼',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/icon-192.png',
  },
  manifest: '/manifest.json',
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
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link
          href="https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Noto+Serif+KR:wght@400;700&family=Cinzel:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
