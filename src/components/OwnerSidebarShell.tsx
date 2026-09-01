'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { useIsTrackA } from '@/hooks/useIsTrackA'
import { useOwnerStorePeriod } from '@/hooks/useOwnerStorePeriod'
import { createClient } from '@/lib/supabase/client'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'

const PURPLE = '#7B5EA7'
const SIDEBAR_BG = '#FBFAFE'
const BORDER = '#ECE7DE'

const MENU_ITEMS = [
  { label: '홈', href: '/dashboard/owner' },
  { label: '예약 관리', href: '/dashboard/owner/bookings' },
  { label: '고객 관리', href: '/dashboard/owner/customers' },
  { label: '매출 리포트', href: '/dashboard/owner/sales-report' },
  { label: '발주관리', href: '/dashboard/owner/brand-orders' },
  { label: '제품판매관리', href: '/dashboard/owner/brand-retail-orders' },
  { label: '오렌포스팅관리', href: '/dashboard/owner/brand-store-decoration' },
  { label: '소식', href: '/dashboard/owner/brand-community' },
  { label: '프로그램', href: '/dashboard/owner/programs' },
  { label: '샘플', href: '/dashboard/owner/brand-samples' },
  { label: '라이브', href: '/dashboard/owner/brand-live' },
  { label: '브랜드 상담', href: '/dashboard/owner/brand-chat' },
  { label: '구독 관리', href: '/dashboard/owner/subscription' },
]

function periodBadge(phase: 'trial' | 'active' | 'expired', daysLeft: number) {
  if (phase === 'trial') {
    return {
      text: `무료체험 D-${daysLeft}`,
      color: '#7B5EA7',
      bg: '#F5F1FA',
      border: '#E1D8F0',
    }
  }
  if (phase === 'active') {
    return {
      text: `이용기간 D-${daysLeft}`,
      color: '#2d8a56',
      bg: '#e8f8ef',
      border: 'rgba(76,173,126,0.35)',
    }
  }
  return {
    text: '구독 필요',
    color: '#A85B38',
    bg: '#FBF0EC',
    border: 'rgba(168,91,56,0.35)',
  }
}

export default function OwnerSidebarShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPC, setIsPC] = useState(false)
  const [newsDot, setNewsDot] = useState(false)
  const { isTrackA, ready } = useIsTrackA()
  // 레이어1(스토어유지비) 기준 D-day — store_trial_started_at ?? created_at 반영
  const { phase, daysLeft, ready: periodReady } = useOwnerStorePeriod({ layer: 'store' })

  const menuItems = useMemo(
    () =>
      MENU_ITEMS.filter((item) => {
        if (item.href === '/dashboard/owner/brand-orders' || item.href === '/dashboard/owner/brand-retail-orders' || item.href === '/dashboard/owner/brand-store-decoration') {
          return ready && isTrackA
        }
        if (item.href === '/dashboard/owner/brand-samples' || item.href === '/dashboard/owner/brand-live') {
          return ready && !isTrackA
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const brandIds = await getOwnerLinkedBrandIds(supabase, user.id, { includePending: true })
      if (brandIds.length === 0) {
        if (!cancelled) setNewsDot(false)
        return
      }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('brand_posts')
        .select('id', { count: 'exact', head: true })
        .in('brand_id', brandIds)
        .gte('created_at', since)
      if (!cancelled) setNewsDot((count ?? 0) > 0)
    })()
    return () => { cancelled = true }
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
    <div data-theme="light" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
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
          const active = pathname === item.href || (item.href !== '/' && item.href !== '/dashboard/owner' && pathname?.startsWith(item.href + '/'))
          const isSubMenu = item.href === '/dashboard/owner/subscription'
          const isNews = item.href === '/dashboard/owner/brand-community'
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
                background: active ? 'rgba(123,94,167,0.12)' : 'transparent',
                borderLeft: active ? `2px solid ${PURPLE}` : '2px solid transparent',
                color: active ? '#3A3540' : '#8A7E72',
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {item.label}
                  {isNews && newsDot ? (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#e85555',
                        flexShrink: 0,
                      }}
                      aria-hidden
                    />
                  ) : null}
                </span>
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
