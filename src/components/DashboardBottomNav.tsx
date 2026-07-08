'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'

type Role = 'customer' | 'partner' | 'salon' | 'owner' | 'brand'

const NAV: Record<Role, { icon: string; label: string; href: string }[]> = {
  customer: [
    { icon: '🏠', label: '홈', href: '/' },
    { icon: '🛍️', label: '샵', href: '/products' },
    { icon: '🔬', label: 'AI', href: '/skin-analysis' },
    { icon: '💬', label: '커뮤니티', href: '/community' },
    { icon: '🌙', label: 'MyWorld', href: '/myworld' },
  ],
  partner: [
    { icon: '🏠', label: '홈', href: '/dashboard/partner' },
    { icon: '🔗', label: '추천링크', href: '/dashboard/partner/referral' },
    { icon: '💰', label: '수익', href: '/dashboard/partner/commission' },
    { icon: '🎥', label: '라이브', href: '/dashboard/partner/live' },
    { icon: '👤', label: '마이', href: '/mypage' },
  ],
  salon: [
    { icon: '🏠', label: '홈', href: '/dashboard/salon' },
    { icon: '📅', label: '예약', href: '/dashboard/salon/reservations' },
    { icon: '🏪', label: '스토어', href: '/dashboard/salon/store' },
    { icon: '📈', label: '매출', href: '/dashboard/salon/revenue' },
    { icon: '👤', label: '마이', href: '/mypage' },
  ],
  owner: [
    { icon: '🏠', label: '홈', href: '/dashboard/owner' },
    { icon: '📅', label: '예약', href: '/dashboard/owner/bookings' },
    { icon: '📋', label: '시술차트', href: '/dashboard/owner/charts-v2' },
    { icon: '🏪', label: '스토어', href: '/dashboard/owner/store' },
    { icon: '👤', label: '마이', href: '/mypage' },
  ],
  brand: [
    { icon: '🏠', label: '홈', href: '/dashboard/brand' },
    { icon: '📦', label: '납품', href: '/dashboard/brand/supply' },
    { icon: '📊', label: '분석', href: '/dashboard/brand/analytics' },
    { icon: '👤', label: '마이', href: '/mypage' },
  ],
}

export default function DashboardBottomNav({ role }: { role: Role }) {
  const router = useRouter()
  const pathname = usePathname()
  const items = NAV[role]
  const { count: cartBadge } = useCart()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        background: 'rgba(10,12,15,0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        padding: '8px max(10px, env(safe-area-inset-left, 0px)) calc(8px + env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-right, 0px))',
        zIndex: 30,
      }}
    >
      {items.map(t => {
        const active = pathname === t.href || (t.href !== '/' && pathname?.startsWith(t.href + '/'))
        return (
          <button
            key={t.label}
            onClick={() => router.push(t.href)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              color: active ? 'var(--text)' : 'var(--text3)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, position: 'relative' }}>
              {t.icon}
              {t.href === '/cart' && cartBadge > 0 ? (
                <span style={{ position: 'absolute', right: -8, top: -6, minWidth: 14, height: 14, borderRadius: 999, background: '#d94f4f', color: '#fff', fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', fontWeight: 800 }}>
                  {cartBadge > 99 ? '99+' : cartBadge}
                </span>
              ) : null}
            </span>
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 400 }}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

