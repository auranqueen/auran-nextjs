import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const GOLD = '#c9a84c'

const MENU = [
  {
    section: '대시보드',
    items: [
      { label: '통합 현황', href: '/admin' },
      { label: '실시간 모니터', href: '/admin/live', badge: 'LIVE' },
    ],
  },
  {
    section: '회원 관리',
    items: [
      { label: '전체 회원', href: '/admin/members' },
      { label: '원장님 관리', href: '/admin/owners' },
      { label: '크리에이터', href: '/admin/creators' },
    ],
  },
  {
    section: '매출·정산',
    items: [
      { label: '매출 분석', href: '/admin/revenue' },
      { label: '정산 일괄 처리', href: '/admin/settlement' },
    ],
  },
  {
    section: '마케팅',
    items: [
      { label: '이벤트·공구 생성', href: '/admin/marketing/events' },
      { label: '공지·푸시 발송', href: '/admin/marketing/push' },
      { label: '제품 관리', href: '/admin/marketing/products' },
    ],
  },
  {
    section: '설정',
    items: [
      { label: '포인트 설정', href: '/admin/settings/points' },
      { label: '수수료·추천 설정', href: '/admin/settings/commission' },
      { label: '이상 감지·알림', href: '/admin/settings/anomaly' },
      { label: '생일 선물 관리', href: '/admin/settings/birthday-gifts' },
    ],
  },
] as const

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?role=admin')
  const { data: profile } = await supabase.from('users').select('role,name').eq('auth_id', user.id).single()
  if (!profile || profile.role !== 'admin') redirect('/login?role=admin')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            background: 'rgba(9,11,14,0.96)',
            borderRight: '1px solid var(--border)',
            padding: '16px 14px',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 800, letterSpacing: '.12em', color: '#e8c870' }}>
              AURAN
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text3)', letterSpacing: '.12em' }}>
              ADMIN CONSOLE
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {profile.name || 'admin'}
            </div>
          </div>

          {MENU.map(sec => (
            <div key={sec.section} style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)', letterSpacing: '.14em', margin: '10px 8px' }}>
                {sec.section}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {sec.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '10px 10px',
                      borderRadius: 12,
                      textDecoration: 'none',
                      color: 'rgba(255,255,255,0.82)',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</span>
                    {'badge' in item && item.badge ? (
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: `${GOLD}22`, border: `1px solid ${GOLD}55`, color: GOLD, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800 }}>
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}

