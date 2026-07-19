'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { useIsTrackA } from '@/hooks/useIsTrackA'
import { useOwnerStorePeriod } from '@/hooks/useOwnerStorePeriod'

const PURPLE = '#7B5EA7'
const SIDEBAR_BG = '#120a18'
const BORDER = 'rgba(255,255,255,0.08)'

const MENU_ITEMS = [
  { label: '홈', href: '/dashboard/owner' },
  { label: '오렌상담톡', href: '/dashboard/owner/chat/redirect' },
  { label: '예약 관리', href: '/dashboard/owner/bookings' },
  { label: '고객 관리', href: '/dashboard/owner/customers' },
  { label: '시술차트', href: '/dashboard/owner/charts-v2' },
  // TODO: 전용 매출리포트 페이지 제작 후 경로 교체
  { label: '매출 리포트', href: '/dashboard/owner' },
  { label: '발주', href: '/dashboard/owner/brand-orders' },
  { label: '제품 주문', href: '/dashboard/owner/brand-retail-orders' },
  { label: '소식', href: '/dashboard/owner/brand-community' },
  { label: '샘플', href: '/dashboard/owner/brand-samples' },
  { label: '라이브', href: '/dashboard/owner/brand-live' },
  { label: '반품', href: '/dashboard/owner/brand-returns' },
  { label: '구독 관리', href: '/dashboard/owner/subscription' },
]

function periodBadge(phase: 'trial' | 'active' | 'expired', daysLeft: number) {
  if (phase === 'trial') {
    return {
      text: `무료체험 D-${daysLeft}`,
      color: '#c4a7e7',
      bg: 'rgba(123,94,167,0.2)',
      border: 'rgba(123,94,167,0.45)',
    }
  }
  if (phase === 'active') {
    return {
      text: `이용기간 D-${daysLeft}`,
      color: '#8fd4a8',
      bg: 'rgba(76,173,126,0.18)',
      border: 'rgba(76,173,126,0.4)',
    }
  }
  return {
    text: '구독 필요',
    color: '#f0a0a0',
    bg: 'rgba(190,70,70,0.18)',
    border: 'rgba(190,70,70,0.4)',
  }
}

export default function OwnerSidebarShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPC, setIsPC] = useState(false)
  const { isTrackA, ready } = useIsTrackA()
  // 레이어1(스토어유지비) 기준 D-day — store_trial_started_at ?? created_at 반영
  const { phase, daysLeft, ready: periodReady } = useOwnerStorePeriod({ layer: 'store' })

  const menuItems = useMemo(
    () =>
      MENU_ITEMS.filter((item) => {
        if (item.href === '/dashboard/owner/brand-orders' || item.href === '/dashboard/owner/brand-retail-orders') {
          return ready && isTrackA
        }
        return true
      }),
    [isTrackA, ready],
  )

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
        {menuItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href + '/'))
          const isSubMenu = item.href === '/dashboard/owner/subscription'
          const badge = isSubMenu && periodReady ? periodBadge(phase, daysLeft) : null
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span>{item.label}</span>
                {badge ? (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 999,
                      color: badge.color,
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {badge.text}
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
