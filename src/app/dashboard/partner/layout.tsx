import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AURAN PARTNERS · For Partners',
  description: '파트너를 위한 AURAN 대시보드',
  openGraph: {
    title: 'AURAN PARTNERS · For Partners',
    description: '파트너를 위한 AURAN',
    url: 'https://partners.auran.kr',
    images: [{ url: '/og-partners.png', width: 1200, height: 630, alt: 'AURAN PARTNERS' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-partners.png'],
  },
}

export default function PartnerDashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
