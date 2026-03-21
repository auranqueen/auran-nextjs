'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'

type Role = 'customer' | 'partner' | 'salon' | 'brand'

const NAV: Record<Role, { icon: string; label: string; href: string }[]> = {
  customer: [
    { icon: '🏠', label: '홈', href: '/dashboard/customer' },
    { icon: '💳', label: '지갑', href: '/wallet' },
    { icon: '🛒', label: '장바구니', href: '/cart' },
    { icon: '💬', label: '커뮤니티', href: '/dashboard/customer/community' },
    { icon: '🧴', label: '제품', href: '/products' },
    { icon: '📅', label: '예약', href: '/booking' },
    { icon: '🌍', label: '마이월드', href: '/myworld' },
    { icon: '👑', label: '나', href: '/my' },
  ],
  partner: [
    { icon: '🏠', label: '홈', href: '/dashboard/partner' },
    { icon: '🔗', label: '추천링크', href: '/dashboard/partner/referral' },
    { icon: '💰', label: '수익', href: '/dashboard/partner/commission' },
    { icon: '🎥', label: '라이브', href: '/dashboard/partner/live' },
    { icon: '👤', label: '마이', href: '/my' },
  ],
  salon: [
    { icon: '🏠', label: '홈', href: '/dashboard/salon' },
    { icon: '📅', label: '예약', href: '/dashboard/salon/reservations' },
    { icon: '🏪', label: '스토어', href: '/dashboard/salon/store' },
    { icon: '📈', label: '매출', href: '/dashboard/salon/revenue' },
    { icon: '👤', label: '마이', href: '/my' },
  ],
  brand: [
    { icon: '🏠', label: '홈', href: '/dashboard/brand' },
    { icon: '📦', label: '납품', href: '/dashboard/brand/supply' },
    { icon: '📊', label: '분석', href: '/dashboard/brand/analytics' },
    { icon: '👤', label: '마이', href: '/my' },
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
        padding: '10px 0 20px',
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

