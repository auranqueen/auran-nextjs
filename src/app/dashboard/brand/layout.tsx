import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AURAN BRAND HUB',
  description: '브랜드사를 위한 AURAN 허브',
  openGraph: {
    title: 'AURAN BRAND HUB',
    description: '브랜드사를 위한 AURAN',
    url: 'https://brand.auran.kr',
    images: [{ url: '/og-brand.png', width: 1200, height: 630, alt: 'AURAN BRAND HUB' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-brand.png'],
  },
}

export default function BrandDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
