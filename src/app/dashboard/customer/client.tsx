'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'
import NoticeBell from '@/components/NoticeBell'
import { SecurityNoticeTrigger } from '@/components/SecurityNoticePopup'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const MENU = [
  { icon: '🧬', label: 'AI 피부 분석', desc: '내 피부 타입 확인', color: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.3)', tc: 'var(--gold)', href: '/skin-analysis' },
  { icon: '💊', label: '제품 추천', desc: '맞춤 제품 보기', color: 'rgba(74,141,192,0.1)', border: 'rgba(74,141,192,0.3)', tc: '#4a8dc0', href: '/products' },
  { icon: '📅', label: '살롱 예약', desc: '가까운 클리닉 찾기', color: 'rgba(191,95,144,0.1)', border: 'rgba(191,95,144,0.3)', tc: '#bf5f90', href: '/booking' },
  { icon: '📦', label: '구매 내역', desc: '주문·배송 확인', color: 'rgba(76,173,126,0.1)', border: 'rgba(76,173,126,0.3)', tc: '#4cad7e', href: '/orders' },
  { icon: '💳', label: '내 지갑', desc: `포인트·충전 관리`, color: 'rgba(149,104,212,0.1)', border: 'rgba(149,104,212,0.3)', tc: '#9568d4', href: '/wallet' },
  { icon: '📓', label: '피부 일지', desc: '매일 기록하고 적립', color: 'rgba(240,160,80,0.1)', border: 'rgba(240,160,80,0.3)', tc: '#f0a050', href: '/diary' },
]

interface Props {
  profile: any
  notifications: any[]
  recentOrders: any[]
  pointHistory: any[]
  featuredProducts?: any[]
}

export default function CustomerDashboardClient({ profile, notifications, recentOrders, pointHistory, featuredProducts = [] }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    localStorage.removeItem(POSITION_STORAGE_KEY)
    router.push('/')
  }

  const statusColors: Record<string, string> = {
    '주문확인': '#4a8dc0', '발송준비': '#c9a84c', '배송중': '#9568d4', '배송완료': '#4cad7e'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>

      {/* 헤더 */}
      <div style={{ background: 'linear-gradient(160deg,#0a0c0f,#111318)', borderBottom: '1px solid var(--border)', padding: '18px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(201,168,76,0.5)', letterSpacing: '0.2em', marginBottom: 4 }}>MY DASHBOARD</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: '#fff' }}>
              안녕하세요, <span style={{ color: '#c9a84c' }}>{profile.name}</span>님
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SecurityNoticeTrigger />
            <NoticeBell />
            <button onClick={logout} style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>로그아웃</button>
          </div>
        </div>

        {/* 지갑 요약 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 12, padding: '11px 13px' }}>
            <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.6)', marginBottom: 4 }}>보유 포인트</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#c9a84c' }}>{(profile.points || 0).toLocaleString()}P</div>
          </div>
          <div style={{ background: 'rgba(76,173,126,0.1)', border: '1px solid rgba(76,173,126,0.25)', borderRadius: 12, padding: '11px 13px' }}>
            <div style={{ fontSize: 9, color: 'rgba(76,173,126,0.6)', marginBottom: 4 }}>충전 잔액</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: '#4cad7e' }}>₩{(profile.charge_balance || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>

        {/* 피부 타입 */}
        {profile.skin_type ? (
          <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 13, padding: '13px 15px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>내 피부 타입</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>🧬 {profile.skin_type}</div>
            </div>
            <button onClick={() => router.push('/skin-analysis')} style={{ fontSize: 11, color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 8, padding: '6px 12px' }}>재분석</button>
          </div>
        ) : (
          <button onClick={() => router.push('/skin-analysis')} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05))', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 13, color: 'var(--gold)', fontSize: 14, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            🧬 AI 피부 분석 무료 체험 → 500P 적립
          </button>
        )}

        {/* 제품 추천 전시 */}
        {featuredProducts.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>💊 제품 추천</div>
              <button onClick={() => router.push('/products')} style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>전체 보기 →</button>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' as any }}>
              {featuredProducts.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/products/${p.id}`)}
                  style={{
                    flexShrink: 0,
                    width: 110,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {p.thumb_img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb_img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 28, opacity: 0.4 }}>🧴</span>
                    )}
                  </div>
                  <div style={{ padding: '8px 8px 10px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.brands?.name || ''}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>₩{(Number(p.retail_price) || 0).toLocaleString()}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메뉴 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 20 }}>
          {MENU.map(m => (
            <button key={m.label} onClick={() => router.push(m.href)} style={{ background: m.color, border: `1px solid ${m.border}`, borderRadius: 13, padding: '14px 13px', textAlign: 'left', transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              <div style={{ fontSize: 22, marginBottom: 7 }}>{m.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.tc, marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* 최근 주문 */}
        {recentOrders.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📦 최근 주문</div>
              <button onClick={() => router.push('/orders')} style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none' }}>전체 보기 →</button>
            </div>
            {recentOrders.map(order => (
              <div key={order.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 13px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text3)', marginBottom: 3 }}>{order.order_no}</div>
                  <div style={{ fontSize: 12, color: 'var(--text)' }}>{order.order_items?.[0]?.product_name || '주문 상품'}{order.order_items?.length > 1 ? ` 외 ${order.order_items.length - 1}종` : ''}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>₩{order.final_amount?.toLocaleString()}</div>
                </div>
                <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 18, fontWeight: 600, background: `${statusColors[order.status] || 'var(--text3)'}22`, color: statusColors[order.status] || 'var(--text3)', border: `1px solid ${statusColors[order.status] || 'var(--text3)'}44` }}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 포인트 내역 */}
        {pointHistory.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>✨ 포인트 내역</div>
            {pointHistory.map(ph => (
              <div key={ph.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>{ph.icon || '✨'}</span>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text)' }}>{ph.description}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(ph.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: ph.type === 'earn' ? 'var(--gold)' : '#e08080' }}>
                    {ph.type === 'earn' ? '+' : ''}{ph.amount.toLocaleString()}P
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>잔액 {ph.balance.toLocaleString()}P</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 알림 */}
        {notifications.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>🔔 새 알림</div>
            {notifications.map(n => (
              <div key={n.id} style={{ background: 'rgba(74,141,192,0.06)', border: '1px solid rgba(74,141,192,0.18)', borderRadius: 11, padding: '11px 13px', marginBottom: 7, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18 }}>{n.icon || '🔔'}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{n.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DashboardBottomNav role="customer" />
    </div>
  )
}
