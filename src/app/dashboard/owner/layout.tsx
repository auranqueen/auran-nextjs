import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AURAN PRO · For Professionals',
  description: '원장님을 위한 AURAN 프로 대시보드',
  openGraph: {
    title: 'AURAN PRO · For Professionals',
    description: '원장님을 위한 AURAN 프로',
    url: 'https://pro.auran.kr',
    images: [{ url: '/og-pro.png', width: 1200, height: 630, alt: 'AURAN PRO' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-pro.png'],
  },
}

export default function OwnerDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
