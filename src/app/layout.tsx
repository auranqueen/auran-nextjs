import type { Metadata, Viewport } from 'next'
import { AppProviders } from '@/components/providers/AppProviders'
import './globals.css'

export const metadata: Metadata = {
  title: 'AURAN · 같은 화장품인데 어떤 날은 잘 받고 어떤 날은 왜 안 받지?',
  description: '맑원장이 호르몬 주기에 맞게 직접 고른 제품과 루틴. 내 피부가 달라지는 이유, 여기 있어요.',
  metadataBase: new URL('https://auran.kr'),
  openGraph: {
    title: 'AURAN · 같은 화장품인데 어떤 날은 잘 받고 어떤 날은 왜 안 받지?',
    description: '맑원장이 호르몬 주기에 맞게 직접 고른 제품과 루틴. 내 피부가 달라지는 이유, 여기 있어요.',
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
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "!function(){try{var k='auran_theme',t=localStorage.getItem(k);if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}}();",
          }}
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0c0f' }}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
