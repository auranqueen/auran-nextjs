'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'

type RoleCounts = { customer: number; partner: number; owner: number; brand: number }

type Props = {
  adminName: string
  roleCounts: RoleCounts
  pendingShipCount?: number
  children: React.ReactNode
}

const GOLD = '#c9a84c'

const SIDEBAR_W = 228

const MENU = [
  { section: 'OVERVIEW', items: [{ label: '통합 현황', href: '/admin', icon: '📊' }, { label: '실시간 모니터', href: '/admin/live', icon: '📡' }] },
  {
    section: 'ROLE MANAGEMENT',
    items: [
      { label: '고객', href: '/admin/members?role=customer', icon: '💧', color: '#c9a84c', sub: '분석·주문·포인트', countKey: 'customer' as const },
      { label: '파트너스', href: '/admin/members?role=partner', icon: '💼', color: '#4a8dc0', sub: '커미션·링크·정산', countKey: 'partner' as const },
      { label: '원장님', href: '/admin/owners', icon: '🏥', color: '#bf5f90', sub: '구독·예약·스토어', countKey: 'owner' as const },
      { label: '브랜드사', href: '/admin/marketing/products', icon: '🏭', color: '#4cad7e', sub: '납품·공지·정산', countKey: 'brand' as const },
      { label: '승인 요청', href: '/admin/approvals', icon: '✅', color: '#c9a84c', sub: '파트너·원장·브랜드 승인' },
    ],
  },
  {
    section: 'ORDER',
    items: [
      { label: '배송 관리', href: '/admin/shipping', icon: '🚚', badgeKey: 'ship' as const },
      { label: '주문 내역', href: '/admin/orders', icon: '📦' },
      { label: '정산 일괄 처리', href: '/admin/settlement', icon: '💰' },
      { label: '매출 분석', href: '/admin/revenue', icon: '📈' },
    ],
  },
  {
    section: 'SETTINGS+',
    items: [
      { label: '추천 매핑', href: '/admin/mapping', icon: '🧩' },
      { label: '충전 플랜', href: '/admin/charge', icon: '💳' },
      { label: '초대 링크', href: '/admin/invite', icon: '🔗' },
    ],
  },
  {
    section: 'MARKETING',
    items: [
      { label: '이벤트·공구 생성', href: '/admin/marketing/events', icon: '🎉' },
      { label: '공지·푸시 발송', href: '/admin/marketing/push', icon: '📢' },
      { label: '제품 관리', href: '/admin/marketing/products', icon: '🧴' },
    ],
  },
  {
    section: 'SETTINGS',
    items: [
      { label: '포인트 설정', href: '/admin/settings/points', icon: '✨' },
      { label: '수수료·추천 설정', href: '/admin/settings/commission', icon: '💰' },
      { label: '이상 감지·알림', href: '/admin/settings/anomaly', icon: '🚨' },
      { label: 'AURAN 설정', href: '/admin/settings/admin-settings', icon: '🧩' },
      { label: '타임세일 관리', href: '/admin/settings/flash-sale', icon: '⏱️' },
      { label: '로그인 기록', href: '/admin/logs', icon: '📋' },
      { label: '개인정보 접근 로그', href: '/admin/privacy', icon: '🔒' },
    ],
  },
] as const

const pageTitleByPath = (path: string) => {
  if (path === '/admin') return '통합 현황'
  if (path.startsWith('/admin/live')) return '실시간 모니터'
  if (path.startsWith('/admin/approvals')) return '승인 요청'
  if (path.startsWith('/admin/shipping')) return '배송 관리'
  if (path.startsWith('/admin/orders')) return '주문 내역'
  if (path.startsWith('/admin/members')) return '회원 관리'
  if (path.startsWith('/admin/owners')) return '원장님 관리'
  if (path.startsWith('/admin/creators')) return '크리에이터'
  if (path.startsWith('/admin/revenue')) return '매출 분석'
  if (path.startsWith('/admin/settlement')) return '정산 일괄 처리'
  if (path.startsWith('/admin/mapping')) return '추천 매핑'
  if (path.startsWith('/admin/charge')) return '충전 플랜'
  if (path.startsWith('/admin/invite')) return '초대 링크'
  if (path.startsWith('/admin/settings/points')) return '포인트 설정'
  if (path.startsWith('/admin/settings/commission')) return '수수료·추천 설정'
  if (path.startsWith('/admin/settings/anomaly')) return '이상 감지·알림'
  if (path.startsWith('/admin/settings/admin-settings')) return 'AURAN 설정'
  if (path.startsWith('/admin/settings/flash-sale')) return '타임세일 관리'
  if (path.startsWith('/admin/logs')) return '로그인 기록'
  if (path.startsWith('/admin/privacy')) return '개인정보 접근 로그'
  return 'Admin Console'
}

export default function AdminChrome({ adminName, roleCounts, pendingShipCount = 0, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [q, setQ] = useState('')

  const title = useMemo(() => pageTitleByPath(pathname), [pathname])

  const goSearch = () => {
    const s = q.trim()
    if (!s) return
    router.push(`/admin/members?q=${encodeURIComponent(s)}`)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', overflow: 'hidden' }}>
      {/* SIDEBAR */}
      <aside
        style={{
          width: SIDEBAR_W,
          flexShrink: 0,
          height: '100vh',
          overflowY: 'auto',
          background: 'var(--bg2)',
          borderRight: '1px solid var(--border)',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: 'var(--gold2)', letterSpacing: '.15em' }}>AURAN</div>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.1em', marginTop: 2 }}>ADMIN CONSOLE · PC</div>
        </div>

        <nav style={{ padding: '10px 0', flex: 1 }}>
          {MENU.map(sec => (
            <div key={sec.section}>
              <div style={{ padding: '7px 16px 3px', fontSize: 8, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.14em', marginTop: 6 }}>
                {sec.section}
              </div>

              {sec.section === 'ROLE MANAGEMENT' ? (
                <div style={{ padding: '8px 12px' }}>
                  {sec.items.map(it => {
                    const active = pathname.startsWith(it.href.split('?')[0])
                    const count = 'countKey' in it ? (roleCounts[it.countKey] ?? 0) : 0
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 9,
                          border: `1px solid ${active ? 'var(--border2)' : 'transparent'}`,
                          background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
                          marginBottom: 3,
                          color: it.color,
                        }}
                      >
                        <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{it.icon}</span>
                        <div style={{ textAlign: 'left' as const, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{it.label}</div>
                          {'sub' in it ? (
                            <div style={{ fontSize: 9, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</div>
                          ) : null}
                        </div>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: 8,
                            padding: '2px 8px',
                            borderRadius: 18,
                            border: '1px solid rgba(255,255,255,0.10)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'var(--text3)',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            minWidth: 16,
                            textAlign: 'center',
                          }}
                        >
                          {count}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div>
                  {sec.items.map(it => {
                    const active = pathname === it.href || pathname.startsWith(it.href + '/')
                    const badge =
                      'badgeKey' in it && it.badgeKey === 'ship' && pendingShipCount > 0 ? (
                        <span
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'var(--red)',
                            color: '#fff',
                            fontSize: 8,
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            borderRadius: 9,
                            padding: '1px 5px',
                            minWidth: 16,
                            textAlign: 'center',
                          }}
                        >
                          {pendingShipCount}
                        </span>
                      ) : null
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '8px 16px 8px 18px',
                          fontSize: 12.5,
                          color: active ? GOLD : 'var(--text2)',
                          background: active ? 'rgba(201,168,76,.08)' : 'transparent',
                          borderLeft: `2px solid ${active ? GOLD : 'transparent'}`,
                          position: 'relative',
                        }}
                      >
                        <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{it.icon}</span>
                        {it.label}
                        {badge}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
              ⚙️
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{adminName || 'AURAN Admin'}</div>
              <div style={{ fontSize: 8, color: GOLD, fontFamily: "'JetBrains Mono', monospace" }}>SUPER ADMIN</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: 7,
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              color: 'var(--text3)',
              fontSize: 10.5,
            }}
          >
            🚪 로그아웃
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ marginLeft: SIDEBAR_W, flex: 1, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* TOPBAR */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: 54,
            background: 'rgba(9,11,14,.94)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 26px',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{title}</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 11px',
              width: 240,
            }}
          >
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>🔍</span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') goSearch()
              }}
              placeholder="주문번호·회원명·제품명 검색..."
              style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 11.5, outline: 'none', width: '100%' }}
            />
          </div>
          <button
            onClick={() => router.push('/admin')}
            title="새로고침"
            style={{
              width: 32,
              height: 32,
              borderRadius: 7,
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🔄
          </button>
        </div>

        <div style={{ padding: '22px 26px 40px' }}>{children}</div>
      </div>
    </div>
  )
}

