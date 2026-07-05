'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const PURPLE = '#7B5EA7'
const SIDEBAR_BG = '#120a18'
const BORDER = 'rgba(255,255,255,0.08)'

const MENU_ITEMS = [
  { label: '홈', href: '/dashboard/owner' },
  { label: '예약 관리', href: '/dashboard/owner/bookings' },
  { label: '고객 관리', href: '/dashboard/owner/customers' },
  { label: '스토어', href: '/dashboard/owner/store' },
  { label: '매출 리포트', href: '/dashboard/owner/revenue' },
  { label: '구독 관리', href: '/dashboard/owner/subscription' },
  { label: '시술차트', href: '/dashboard/owner/charts-v2' },
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
    return <>{children}</>
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
