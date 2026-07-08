'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const PURPLE = '#7B5EA7'
const SIDEBAR_BG = '#120a18'
const BORDER = 'rgba(255,255,255,0.08)'

const MENU_ITEMS = [
  { label: '홈', href: '/dashboard/owner' },
  { label: '오렌상담톡', href: '/dashboard/owner/chat/redirect' },
  { label: '예약 관리', href: '/dashboard/owner/bookings' },
  { label: '고객 관리', href: '/dashboard/owner/customers' },
  { label: '시술차트', href: '/dashboard/owner/charts-v2' },
  { label: '스토어', href: '/dashboard/owner/store' },
  { label: '매출 리포트', href: '/dashboard/owner/revenue' },
  { label: '발주', href: '/dashboard/owner/brand-orders' },
  { label: '소식', href: '/dashboard/owner/brand-community' },
  { label: '샘플', href: '/dashboard/owner/brand-samples' },
  { label: '라이브', href: '/dashboard/owner/brand-live' },
  { label: '반품', href: '/dashboard/owner/brand-returns' },
  { label: '구독 관리', href: '/dashboard/owner/subscription' },
]

export default function OwnerSidebarShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPC, setIsPC] = useState(false)

  useEffect(() => {
    const handleResize = () => setIsPC(window.innerWidth >= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (pathname?.startsWith('/dashboard/owner/chat')) {
    return <>{children}</>
  }

  if (!isPC) {
    return (
      <>
        <div style={{ paddingBottom: 'calc(66px + env(safe-area-inset-bottom, 0px))' }}>
          {children}
        </div>
        <DashboardBottomNav role="owner" />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: SIDEBAR_BG,
          borderRight: `1px solid ${BORDER}`,
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: PURPLE, letterSpacing: '0.12em', marginBottom: 12, padding: '0 10px' }}>
          AURAN PRO
        </div>
        {MENU_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'))
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => router.push(item.href)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: active ? 'rgba(123,94,167,0.22)' : 'transparent',
                borderLeft: active ? `2px solid ${PURPLE}` : '2px solid transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              {item.label}
            </button>
          )
        })}
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
