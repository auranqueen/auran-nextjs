'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'dashboard' | 'shipping' | 'brands' | 'members' | 'settlement' | 'refund' | 'logs'

interface Props {
  profile: any; stats: any; pendingOrders: any[]; pendingBrands: any[]
  pendingProducts: any[]; pendingRefunds: any[]; pendingSettlements: any[]
  recentLogs: any[]; members: any[]
}

const SC = { '주문확인': '#4a8dc0', '발송준비': '#c9a84c', '배송중': '#9568d4', '배송완료': '#4cad7e' }
const RC = { customer: '#c9a84c', partner: '#4a8dc0', owner: '#bf5f90', brand: '#4cad7e', admin: '#9568d4' }

export default function AdminClient({ profile, stats, pendingOrders, pendingBrands, pendingProducts, pendingRefunds, pendingSettlements, recentLogs, members }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('dashboard')
  const [shipInput, setShipInput] = useState<Record<string, { courier: string; tracking: string }>>({})
  const [toast, setToast] = useState('')

  async function logout() { await supabase.auth.signOut(); router.push('/') }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  async function shipOrder(orderId: string) {
    const { courier, tracking } = shipInput[orderId] || {}
    if (!tracking) { alert('운송장 번호를 입력해주세요'); return }
    const { error } = await supabase.from('orders').update({ status: '배송중', tracking_no: tracking, courier, shipped_at: new Date().toISOString() }).eq('id', orderId)
    if (!error) { showToast(`✅ 발송 처리 완료 · 고객 알림 발송됨`); router.refresh() }
  }

  async function completeDelivery(orderId: string) {
    const { error } = await supabase.from('orders').update({ status: '배송완료', delivered_at: new Date().toISOString() }).eq('id', orderId)
    if (!error) { showToast('✅ 배송 완료 · 포인트 자동 적립됨'); router.refresh() }
  }

  async function approveBrand(brandId: string) {
    const { error } = await supabase.from('brands').update({ status: 'active', approved_at: new Date().toISOString() }).eq('id', brandId)
    if (!error) { showToast('✅ 브랜드 입점 승인됨'); router.refresh() }
  }

  async function approveProduct(productId: string) {
    const { error } = await supabase.from('products').update({ status: 'active', approved_at: new Date().toISOString() }).eq('id', productId)
    if (!error) { showToast('✅ 제품 플랫폼 등록됨'); router.refresh() }
  }

  async function approveSettlement(settId: string) {
    const { error } = await supabase.from('settlements').update({ status: '정산완료', approved_by: profile.id, approved_at: new Date().toISOString(), paid_at: new Date().toISOString() }).eq('id', settId)
    if (!error) { showToast('✅ 정산 완료 처리됨'); router.refresh() }
  }

  async function approveRefund(refundId: string) {
    const { error } = await supabase.from('refunds').update({ status: '완료', approved_by: profile.id, approved_at: new Date().toISOString() }).eq('id', refundId)
    if (!error) { showToast('✅ 환불 완료 처리됨'); router.refresh() }
  }

  const badge = (text: string, color: string) => (
    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 18, fontWeight: 700, background: `${color}22`, color, border: `1px solid ${color}44`, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>{text}</span>
  )

  // ── 공통 카드 스타일
  const card = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 14 } as const
  const hdr = { padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' } as const
  const btnG = { fontSize: 10, padding: '5px 11px', borderRadius: 7, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.38)', color: '#4cad7e', cursor: 'pointer', fontWeight: 600 } as const
  const btnR = { fontSize: 10, padding: '5px 11px', borderRadius: 7, background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.28)', color: '#d94f4f', cursor: 'pointer', fontWeight: 600 } as const

  const TABS: { id: Tab; icon: string; label: string; count?: number }[] = [
    { id: 'dashboard', icon: '📊', label: '대시보드' },
    { id: 'shipping', icon: '🚚', label: '배송', count: stats.pendingShip },
    { id: 'brands', icon: '🏭', label: '브랜드', count: stats.pendingBrands + stats.pendingProducts },
    { id: 'members', icon: '👥', label: '회원' },
    { id: 'settlement', icon: '💰', label: '정산', count: stats.pendingSettlements },
    { id: 'refund', icon: '↩️', label: '환불', count: stats.pendingRefunds },
    { id: 'logs', icon: '📋', label: '로그' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 560, margin: '0 auto', paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ background: 'rgba(9,11,14,0.96)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--border)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: '#e8c870', letterSpacing: '.12em' }}>AURAN</div>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '.1em' }}>ADMIN CONSOLE</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{profile.name}</span>
          <button onClick={logout} style={{ fontSize: 11, color: 'var(--text3)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 10px' }}>로그아웃</button>
        </div>
      </div>

      {/* 탭 바 */}
      <div style={{ display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', padding: '0 4px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flexShrink: 0, padding: '11px 14px', fontSize: 11, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? 'var(--gold)' : 'var(--text3)', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', cursor: 'pointer' }}>
            {t.icon} {t.label}
            {t.count ? <span style={{ background: '#d94f4f', color: '#fff', fontSize: 8, borderRadius: 9, padding: '1px 5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* ── 대시보드 탭 */}
        {tab === 'dashboard' && (
          <div>
            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
              {[
                { l: '이달 매출', v: `₩${(stats.monthlyRevenue / 10000).toFixed(0)}만`, c: 'var(--gold)', icon: '💰' },
                { l: '전체 주문', v: `${stats.totalOrders}건`, c: '#4a8dc0', icon: '📦' },
                { l: '전체 회원', v: `${stats.totalUsers}명`, c: '#4cad7e', icon: '👥' },
                { l: '발송 대기', v: `${stats.pendingShip}건`, c: stats.pendingShip > 0 ? '#d94f4f' : '#4cad7e', icon: '🚚' },
              ].map(s => (
                <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 15px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>{s.l}</span>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* 역할별 회원 */}
            <div style={card}>
              <div style={hdr}><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>👥 역할별 회원</span></div>
              <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{ r: '고객', k: 'customer', c: '#c9a84c' }, { r: '파트너스', k: 'partner', c: '#4a8dc0' }, { r: '원장님', k: 'owner', c: '#bf5f90' }, { r: '브랜드사', k: 'brand', c: '#4cad7e' }].map(i => (
                  <div key={i.k} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{i.r}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: i.c }}>{stats.roleCounts[i.k] || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 처리 필요 */}
            {(stats.pendingShip + stats.pendingBrands + stats.pendingProducts + stats.pendingRefunds + stats.pendingSettlements) > 0 && (
              <div style={card}>
                <div style={hdr}><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🔔 처리 필요</span></div>
                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    { label: '발송 대기', count: stats.pendingShip, tabId: 'shipping', color: '#4a8dc0', icon: '🚚' },
                    { label: '브랜드 승인', count: stats.pendingBrands, tabId: 'brands', color: '#4cad7e', icon: '🏭' },
                    { label: '제품 승인', count: stats.pendingProducts, tabId: 'brands', color: 'var(--gold)', icon: '📦' },
                    { label: '환불 요청', count: stats.pendingRefunds, tabId: 'refund', color: '#d94f4f', icon: '↩️' },
                    { label: '정산 대기', count: stats.pendingSettlements, tabId: 'settlement', color: '#bf5f90', icon: '💰' },
                  ].filter(i => i.count > 0).map(i => (
                    <button key={i.label} onClick={() => setTab(i.tabId as Tab)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: `${i.color}10`, border: `1px solid ${i.color}28`, borderRadius: 9, cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 16 }}>{i.icon}</span>
                      <span style={{ flex: 1, fontSize: 12, color: i.color, fontWeight: 600 }}>{i.label} {i.count}건</span>
                      <span style={{ fontSize: 14, color: 'var(--text3)' }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 회원 */}
            <div style={card}>
              <div style={hdr}><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🆕 최근 가입</span><button onClick={() => setTab('members')} style={{ fontSize: 10, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}>전체 →</button></div>
              {members.slice(0, 5).map(m => (
                <div key={m.id} style={row}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{m.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {badge(m.role, (RC as any)[m.role] || 'var(--text3)')}
                    <span style={{ fontSize: 9, color: 'var(--text3)' }}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 배송 탭 */}
        {tab === 'shipping' && (
          <div>
            <div style={{ ...card }}>
              <div style={hdr}><div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🚚 배송 관리</div><div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>발송완료 → 고객 알림 · 배송완료 → 포인트 자동 적립</div></div></div>
              {pendingOrders.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>처리 대기 주문이 없습니다</div>
              ) : pendingOrders.map(order => (
                <div key={order.id} style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text3)' }}>{order.order_no}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>₩{order.total_amount?.toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      {badge(order.status, (SC as any)[order.status] || 'var(--text3)')}
                      <span style={{ fontSize: 10, color: order.points_awarded ? '#4cad7e' : 'var(--gold)', fontFamily: "'JetBrains Mono', monospace" }}>+{order.earn_points}P</span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr auto', gap: 6, marginBottom: 7 }}>
                    <select
                      value={shipInput[order.id]?.courier || 'CJ대한통운'}
                      onChange={e => setShipInput(p => ({ ...p, [order.id]: { ...p[order.id], courier: e.target.value, tracking: p[order.id]?.tracking || '' } }))}
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 11, padding: '8px 8px', outline: 'none' }}>
                      {['CJ대한통운', '우체국택배', '한진택배', '롯데택배', '쿠팡로켓'].map(c => <option key={c}>{c}</option>)}
                    </select>
                    <input
                      value={shipInput[order.id]?.tracking || ''}
                      onChange={e => setShipInput(p => ({ ...p, [order.id]: { ...p[order.id], tracking: e.target.value, courier: p[order.id]?.courier || 'CJ대한통운' } }))}
                      placeholder="운송장 번호" maxLength={20}
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 11, padding: '8px 10px', outline: 'none', fontFamily: "'JetBrains Mono', monospace' " }}
                    />
                    <button onClick={() => shipOrder(order.id)} style={btnG}>발송</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 브랜드 탭 */}
        {tab === 'brands' && (
          <div>
            {pendingBrands.length > 0 && (
              <div style={card}>
                <div style={hdr}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>🏭 입점 신청 대기 <span style={{ color: 'var(--gold)' }}>{pendingBrands.length}</span></div></div>
                {pendingBrands.map(b => (
                  <div key={b.id} style={{ ...row, gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{new Date(b.created_at).toLocaleDateString('ko-KR')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approveBrand(b.id)} style={btnG}>승인</button>
                      <button style={btnR}>반려</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pendingProducts.length > 0 && (
              <div style={card}>
                <div style={hdr}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📦 제품 승인 대기 <span style={{ color: 'var(--gold)' }}>{pendingProducts.length}</span></div></div>
                {pendingProducts.map(p => (
                  <div key={p.id} style={{ ...row }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>₩{p.retail_price?.toLocaleString()} · {new Date(p.created_at).toLocaleDateString('ko-KR')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => approveProduct(p.id)} style={btnG}>승인</button>
                      <button style={btnR}>반려</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 회원 탭 */}
        {tab === 'members' && (
          <div style={card}>
            <div style={hdr}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>👥 회원 목록 ({members.length}명)</div></div>
            {members.map(m => (
              <div key={m.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
                    {badge(m.role, (RC as any)[m.role] || 'var(--text3)')}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--gold)' }}>{(m.points || 0).toLocaleString()}P</div>
                  <div style={{ fontSize: 9, color: 'var(--text3)' }}>{new Date(m.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 정산 탭 */}
        {tab === 'settlement' && (
          <div style={card}>
            <div style={hdr}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>💰 정산 대기</div></div>
            {pendingSettlements.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>정산 대기 건이 없습니다</div>
            ) : pendingSettlements.map(s => (
              <div key={s.id} style={row}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{s.target_name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>{badge(s.target_role, (RC as any)[s.target_role] || 'var(--text3)')}</div>
                </div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>₩{s.amount?.toLocaleString()}</span>
                  <button onClick={() => approveSettlement(s.id)} style={btnG}>정산</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 환불 탭 */}
        {tab === 'refund' && (
          <div style={card}>
            <div style={hdr}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>↩️ 환불 요청</div></div>
            {pendingRefunds.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>환불 요청이 없습니다</div>
            ) : pendingRefunds.map(r => (
              <div key={r.id} style={row}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text3)' }}>주문 ID: {r.order_id?.slice(0, 8)}...</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 3 }}>₩{r.amount?.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => approveRefund(r.id)} style={btnG}>승인</button>
                  <button style={btnR}>거절</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 로그 탭 */}
        {tab === 'logs' && (
          <div style={card}>
            <div style={hdr}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>📋 접속 로그</div></div>
            {recentLogs.map(l => (
              <div key={l.id} style={row}>
                <div>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{l.email}</span>
                    {badge(l.status === 'success' ? '성공' : '실패', l.status === 'success' ? '#4cad7e' : '#d94f4f')}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{l.ip_address} · {new Date(l.created_at).toLocaleString('ko-KR')}</div>
                </div>
                {badge(l.role || '-', (RC as any)[l.role] || 'var(--text3)')}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border2)', borderLeft: '3px solid var(--green)', borderRadius: 10, padding: '11px 18px', fontSize: 12, color: 'var(--text)', boxShadow: '0 8px 28px rgba(0,0,0,0.5)', zIndex: 50, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* 하단 탭바 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 560, background: 'rgba(9,11,14,0.96)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border)', display: 'flex', padding: '8px 0 16px' }}>
        {TABS.slice(0, 5).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: tab === t.id ? 'var(--gold)' : 'var(--text3)', cursor: 'pointer', position: 'relative' }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span style={{ fontSize: 9 }}>{t.label}</span>
            {t.count ? <span style={{ position: 'absolute', top: 0, right: '20%', width: 14, height: 14, background: '#d94f4f', borderRadius: '50%', fontSize: 8, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{t.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
