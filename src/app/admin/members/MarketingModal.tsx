'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type Member = { id: string; name: string; email: string; customer_grade?: string | null; points?: number }
type MembershipRow = { user_id: string; status: string; shipments_remaining: number; next_shipment_date: string | null; membership_plans: { name: string } | null; users: { name: string; email: string } | null }
type ProfileRow = { auth_id: string; total_purchase_amount: number; grade: string | null; users?: { id: string; name: string; email: string } | null }
type ProductStat = { name: string; qty: number; sales: number }
type Tab = 'membership' | 'grade' | 'amount' | 'product' | 'notify'

const GRADES = ['PETAL','BLOOM','VELVET','LUMIÈRE','REINE','NOIR','CÉLESTE']
const C = { bg: '#0a0c0f', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', purple: '#7B5EA7', gold: '#C9A96E', text: '#e8e0f5', muted: 'rgba(255,255,255,0.45)' }

export default function MarketingModal({ open, onClose, members }: { open: boolean; onClose: () => void; members: Member[] }) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('membership')
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [productStats, setProductStats] = useState<ProductStat[]>([])
  const [gradeFilter, setGradeFilter] = useState('BLOOM')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyBody, setNotifyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      const [{ data: mem }, { data: prof }, { data: items }] = await Promise.all([
        supabase.from('user_memberships')
          .select('user_id, status, shipments_remaining, next_shipment_date, membership_plans(name), users!user_memberships_user_id_fkey(name, email)')
          .eq('status', 'active'),
        supabase.from('profiles')
          .select('auth_id, total_purchase_amount, grade')
          .order('total_purchase_amount', { ascending: false })
          .limit(100),
        supabase.from('order_items')
          .select('product_name, quantity, subtotal')
          .limit(2000),
      ])
      setMemberships((mem as any) || [])
      // profiles와 users 조인
      const profWithUsers = await Promise.all(((prof || []) as any[]).map(async (p: any) => {
        const { data: u } = await supabase.from('users').select('id, name, email').eq('auth_id', p.auth_id).maybeSingle()
        return { ...p, users: u }
      }))
      setProfiles(profWithUsers as any)
      // 인기제품 집계
      const map = new Map<string, ProductStat>()
      for (const item of (items || []) as any[]) {
        const n = item.product_name || '알 수 없음'
        const prev = map.get(n) || { name: n, qty: 0, sales: 0 }
        map.set(n, { name: n, qty: prev.qty + (item.quantity || 1), sales: prev.sales + (item.subtotal || 0) })
      }
      setProductStats(Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 20))
      setLoading(false)
    }
    load()
  }, [open])

  const gradeMembers = useMemo(() => members.filter(m => m.customer_grade === gradeFilter), [members, gradeFilter])

  const sendNotify = async () => {
    if (!notifyTitle || !notifyBody || selected.size === 0) { setSendMsg('제목·내용·수신자를 입력해주세요'); return }
    setSending(true); setSendMsg('')
    const rows = Array.from(selected).map(uid => ({ user_id: uid, type: 'promo', title: notifyTitle, body: notifyBody, is_read: false }))
    const { error } = await supabase.from('notifications').insert(rows as any)
    setSending(false)
    if (error) { setSendMsg('오류: ' + error.message) } else { setSendMsg(`${rows.length}명에게 발송됐어요 ✓`); setSelected(new Set()); setNotifyTitle(''); setNotifyBody('') }
  }

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectAll = (ids: string[]) => setSelected(new Set(ids))

  if (!open) return null

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 11, cursor: 'pointer',
    background: active ? C.purple : C.card, color: active ? '#fff' : C.muted, fontFamily: 'inherit',
  })

  const row = (id: string, label: string, sub: string): React.ReactNode => (
    <div key={id} onClick={() => toggleSelect(id)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `0.5px solid ${C.border}`, cursor: 'pointer' }}>
      <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected.has(id) ? C.purple : C.muted}`, background: selected.has(id) ? C.purple : 'transparent', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, color: C.text }}>{label || '(이름없음)'}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
      </div>
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 600, background: '#111', borderRadius: 16, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px 12px', borderBottom: `0.5px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 14, color: C.gold }}>📊 마케팅 인텔리전스</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => window.print()} style={{ padding: '6px 14px', background: C.card, border: `0.5px solid ${C.border}`, color: C.muted, borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>🖨️ 출력</button>
            <button onClick={onClose} style={{ padding: '7px 16px', background: '#333', border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>✕ 닫기</button>
          </div>
        </div>
        {/* 탭 */}
        <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderBottom: `0.5px solid ${C.border}`, flexShrink: 0, overflowX: 'auto' }}>
          {(['membership','grade','amount','product','notify'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={pill(tab === t)}>
              {t === 'membership' ? '멤버십' : t === 'grade' ? '등급별' : t === 'amount' ? '누적금액' : t === 'product' ? '인기제품' : '알림발송'}
            </button>
          ))}
        </div>
        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {loading ? <div style={{ textAlign: 'center', color: C.muted, padding: 40 }}>불러오는 중...</div> : (
            <>
              {/* 멤버십 탭 */}
              {tab === 'membership' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>활성 멤버십 {memberships.length}명</div>
                    <button onClick={() => selectAll(memberships.map(m => m.user_id))} style={{ fontSize: 11, color: C.purple, background: 'none', border: 'none', cursor: 'pointer' }}>전체선택</button>
                  </div>
                  {memberships.map(m => row(m.user_id, (m.users as any)?.name, `${(m.membership_plans as any)?.name} · 남은 ${m.shipments_remaining}회 · 다음 ${m.next_shipment_date || '-'}`))}
                </div>
              )}
              {/* 등급별 탭 */}
              {tab === 'grade' && (
                <div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {GRADES.map(g => <button key={g} onClick={() => setGradeFilter(g)} style={pill(gradeFilter === g)}>{g}</button>)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>{gradeFilter} · {gradeMembers.length}명</div>
                    <button onClick={() => selectAll(gradeMembers.map(m => m.id))} style={{ fontSize: 11, color: C.purple, background: 'none', border: 'none', cursor: 'pointer' }}>전체선택</button>
                  </div>
                  {gradeMembers.length === 0 ? <div style={{ color: C.muted, fontSize: 12 }}>해당 등급 고객이 없어요</div> : gradeMembers.map(m => row(m.id, m.name, `${m.email}`))}
                </div>
              )}
              {/* 누적금액 탭 */}
              {tab === 'amount' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: C.muted }}>누적금액 TOP {profiles.length}</div>
                    <button onClick={() => selectAll(profiles.map(p => (p as any).users?.id).filter(Boolean))} style={{ fontSize: 11, color: C.purple, background: 'none', border: 'none', cursor: 'pointer' }}>전체선택</button>
                  </div>
                  {profiles.map((p, i) => {
                    const u = (p as any).users
                    if (!u) return null
                    return (
                      <div key={i} onClick={() => toggleSelect(u.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `0.5px solid ${C.border}`, cursor: 'pointer' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${selected.has(u.id) ? C.purple : C.muted}`, background: selected.has(u.id) ? C.purple : 'transparent', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, color: C.text }}>{u.name || '(이름없음)'} · <span style={{ color: C.gold }}>{p.grade || 'PETAL'}</span></div>
                          <div style={{ fontSize: 11, color: C.muted }}>{u.email}</div>
                        </div>
                        <div style={{ fontSize: 13, color: C.gold }}>₩{(p.total_purchase_amount || 0).toLocaleString()}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* 인기제품 탭 */}
              {tab === 'product' && (
                <div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>판매수량 TOP 20</div>
                  {productStats.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `0.5px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 12, color: C.text }}>{i + 1}. {p.name}</div>
                        <div style={{ fontSize: 11, color: C.muted }}>₩{p.sales.toLocaleString()}</div>
                      </div>
                      <div style={{ fontSize: 14, color: C.gold }}>{p.qty}개</div>
                    </div>
                  ))}
                </div>
              )}
              {/* 알림발송 탭 */}
              {tab === 'notify' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, color: selected.size > 0 ? C.gold : C.muted }}>선택된 수신자 {selected.size}명</div>
                  <input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} placeholder="알림 제목"
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#1a1a1a', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit' }}/>
                  <textarea value={notifyBody} onChange={e => setNotifyBody(e.target.value)} placeholder="알림 내용" rows={4}
                    style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#1a1a1a', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}/>
                  {sendMsg && <div style={{ fontSize: 12, color: sendMsg.includes('✓') ? '#5B8A6B' : '#A33' }}>{sendMsg}</div>}
                  <button onClick={sendNotify} disabled={sending}
                    style={{ padding: 13, background: sending ? '#444' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: sending ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {sending ? '발송 중...' : `${selected.size}명에게 알림 발송`}
                  </button>
                  <div style={{ fontSize: 11, color: C.muted }}>※ 다른 탭에서 고객을 선택한 뒤 이 탭에서 발송하세요</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
