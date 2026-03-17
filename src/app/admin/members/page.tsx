'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

type Member = {
  id: string
  auth_id: string
  name: string
  email: string
  role: string
  status: string
  points?: number
  created_at: string
  last_login_at?: string | null
}

type DetailTab = 'summary' | 'orders' | 'points' | 'logs'

export default function AdminMembersPage() {
  const supabase = createClient()
  const sp = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [selected, setSelected] = useState<Member | null>(null)
  const [tab, setTab] = useState<DetailTab>('summary')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailOrders, setDetailOrders] = useState<any[]>([])
  const [detailPoints, setDetailPoints] = useState<any[]>([])
  const [detailLogs, setDetailLogs] = useState<any[]>([])
  const [pointModal, setPointModal] = useState(false)
  const [pointAmount, setPointAmount] = useState('')
  const [pointReason, setPointReason] = useState('관리자 수동 지급')
  const [pointSaving, setPointSaving] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('users')
        .select('id,auth_id,name,email,role,status,points,created_at,last_login_at')
        .order('created_at', { ascending: false })
        .limit(200)
      setMembers((data || []) as any)
      setLoading(false)
    }
    run()
  }, [supabase])

  useEffect(() => {
    const urlQ = (sp.get('q') || '').trim()
    const urlRole = (sp.get('role') || '').trim()
    if (urlQ) setQ(urlQ)
    if (urlRole) {
      // keep search input, role filter applied in computed list
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const role = (sp.get('role') || '').trim().toLowerCase()
    if (!s) return members
    const base = members.filter(m =>
      (m.name || '').toLowerCase().includes(s) ||
      (m.email || '').toLowerCase().includes(s) ||
      (m.role || '').toLowerCase().includes(s)
    )
    return role ? base.filter(m => (m.role || '').toLowerCase() === role) : base
  }, [members, q])

  const suspend = async (m: Member) => {
    if (!confirm(`${m.name} (${m.email}) 계정을 정지할까요?`)) return
    const { error } = await supabase.from('users').update({ status: 'suspended' }).eq('id', m.id)
    if (error) {
      alert(error.message)
      return
    }
    setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, status: 'suspended' } : x)))
    if (selected?.id === m.id) setSelected({ ...selected, status: 'suspended' })
  }

  const activate = async (m: Member) => {
    const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', m.id)
    if (error) {
      alert(error.message)
      return
    }
    setMembers(prev => prev.map(x => (x.id === m.id ? { ...x, status: 'active' } : x)))
    if (selected?.id === m.id) setSelected({ ...selected, status: 'active' })
  }

  useEffect(() => {
    const run = async () => {
      if (!selected) return
      setDetailLoading(true)
      setDetailOrders([])
      setDetailPoints([])
      setDetailLogs([])
      try {
        const [o, p, l] = await Promise.all([
          supabase
            .from('orders')
            .select('id,order_no,status,final_amount,ordered_at')
            .eq('customer_id', selected.id)
            .order('ordered_at', { ascending: false })
            .limit(30),
          supabase
            .from('point_history')
            .select('id,type,amount,balance,description,created_at')
            .eq('user_id', selected.id)
            .order('created_at', { ascending: false })
            .limit(30),
          supabase
            .from('login_logs')
            .select('*')
            .eq('user_id', selected.id)
            .order('created_at', { ascending: false })
            .limit(30),
        ])
        setDetailOrders(o.data || [])
        setDetailPoints(p.data || [])
        setDetailLogs(l.data || [])
      } finally {
        setDetailLoading(false)
      }
    }
    run()
  }, [selected, supabase])

  const close = () => {
    setSelected(null)
    setTab('summary')
    setDetailOrders([])
    setDetailPoints([])
    setDetailLogs([])
    setPointModal(false)
    setPointAmount('')
    setPointReason('관리자 수동 지급')
  }

  const openPointModal = () => {
    setPointModal(true)
    setPointAmount('')
    setPointReason('관리자 수동 지급')
  }

  const grantPoints = async () => {
    if (!selected) return
    const amt = Number(pointAmount)
    if (!amt || !Number.isFinite(amt)) {
      alert('지급 포인트를 입력해주세요.')
      return
    }
    setPointSaving(true)
    try {
      // 현재 포인트 조회 후 업데이트
      const { data: u, error: uerr } = await supabase.from('users').select('points').eq('id', selected.id).single()
      if (uerr) throw uerr
      const nextBalance = Number(u?.points || 0) + amt

      const now = new Date().toISOString()
      const [h, upd] = await Promise.all([
        supabase.from('point_history').insert({
          user_id: selected.id,
          type: 'admin',
          amount: amt,
          balance: nextBalance,
          description: pointReason,
          created_at: now,
        }),
        supabase.from('users').update({ points: nextBalance }).eq('id', selected.id),
      ])
      if (h.error) throw h.error
      if (upd.error) throw upd.error

      setMembers(prev => prev.map(m => (m.id === selected.id ? { ...m, points: nextBalance } : m)))
      setSelected(prev => (prev ? { ...prev, points: nextBalance } : prev))
      setDetailPoints(prev => [
        { id: `local_${now}`, type: 'admin', amount: amt, balance: nextBalance, description: pointReason, created_at: now },
        ...prev,
      ])
      setPointModal(false)
      setPointAmount('')
    } catch (e: any) {
      alert(e?.message || '포인트 지급 중 오류가 발생했습니다.')
    } finally {
      setPointSaving(false)
    }
  }

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>전체 회원</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>검색/상세/정지</div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>총 {members.length}명</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="이름/이메일/역할 검색"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 16,
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#fff',
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>검색 결과가 없습니다.</div>
        ) : (
          filtered.map(m => (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                padding: '12px 14px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.name} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>({m.role})</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: "'JetBrains Mono', monospace", marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.email}
                </div>
              </div>
              <div style={{ fontSize: 10, padding: '4px 8px', borderRadius: 999, background: m.status === 'suspended' ? 'rgba(217,79,79,0.12)' : 'rgba(76,173,126,0.12)', border: '1px solid rgba(255,255,255,0.10)', color: m.status === 'suspended' ? '#d94f4f' : '#4cad7e', fontWeight: 900 }}>
                {m.status}
              </div>
            </button>
          ))
        )}
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 560, margin: '0 auto', background: '#141414', borderRadius: '24px 24px 0 0', padding: '18px 18px 26px', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)', margin: '0 auto 14px' }} />
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{selected.name}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.65)', fontFamily: "'JetBrains Mono', monospace" }}>{selected.email}</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {([
                { id: 'summary', label: '요약' },
                { id: 'orders', label: '주문' },
                { id: 'points', label: '포인트' },
                { id: 'logs', label: '로그' },
              ] as const).map(x => (
                <button
                  key={x.id}
                  onClick={() => setTab(x.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: tab === x.id ? 'rgba(201,168,76,0.16)' : 'rgba(255,255,255,0.06)',
                    color: tab === x.id ? '#c9a84c' : 'rgba(255,255,255,0.72)',
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                  }}
                >
                  {x.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              {detailLoading && (
                <div style={{ padding: 12, borderRadius: 16, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  상세 데이터 불러오는 중...
                </div>
              )}

              {tab === 'summary' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '12px 12px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>ROLE</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: '#fff' }}>{selected.role}</div>
                  </div>
                  <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '12px 12px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>POINTS</div>
                    <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 900, color: '#c9a84c' }}>{(selected.points || 0).toLocaleString()}P</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '12px 12px' }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>STATUS</div>
                    <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: '#fff' }}>{selected.status}</div>
                  </div>
                </div>
              )}

              {tab === 'orders' && (
                <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 900, color: '#fff' }}>최근 주문 (최대 30)</div>
                  {detailOrders.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>주문 내역이 없습니다.</div>
                  ) : (
                    detailOrders.map(o => (
                      <div key={o.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.65)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <span>{o.order_no}</span>
                          <span>{o.status}</span>
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : ''}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: '#c9a84c' }}>₩{(o.final_amount || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'points' && (
                <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 900, color: '#fff' }}>포인트 내역 (최대 30)</div>
                  {detailPoints.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>포인트 내역이 없습니다.</div>
                  ) : (
                    detailPoints.map(p => (
                      <div key={p.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{p.description || p.type}</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: p.amount >= 0 ? '#4cad7e' : '#d94f4f' }}>
                            {p.amount >= 0 ? '+' : ''}
                            {p.amount}
                          </div>
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <span>{p.created_at ? new Date(p.created_at).toLocaleString('ko-KR') : ''}</span>
                          <span>balance {p.balance}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === 'logs' && (
                <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 900, color: '#fff' }}>로그인 로그 (최대 30)</div>
                  {detailLogs.length === 0 ? (
                    <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>로그가 없습니다.</div>
                  ) : (
                    detailLogs.map(l => (
                      <div key={l.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.email}</div>
                        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <span>{l.ip_address}</span>
                          <span>{l.created_at ? new Date(l.created_at).toLocaleString('ko-KR') : ''}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <button
                onClick={openPointModal}
                style={{ flex: 1, padding: '12px 14px', borderRadius: 16, background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.30)', color: '#c9a84c', fontWeight: 900, cursor: 'pointer' }}
              >
                ✨ 포인트 지급
              </button>
              {selected.status === 'suspended' ? (
                <button
                  onClick={() => activate(selected)}
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 16, background: 'rgba(76,173,126,0.14)', border: '1px solid rgba(76,173,126,0.30)', color: '#4cad7e', fontWeight: 900, cursor: 'pointer' }}
                >
                  활성화
                </button>
              ) : (
                <button
                  onClick={() => suspend(selected)}
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 16, background: 'rgba(217,79,79,0.12)', border: '1px solid rgba(217,79,79,0.30)', color: '#d94f4f', fontWeight: 900, cursor: 'pointer' }}
                >
                  정지
                </button>
              )}
              <button
                onClick={close}
                style={{ flex: 1, padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', fontWeight: 900, cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && pointModal && (
        <div
          onClick={() => setPointModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#0f1218', border: '1px solid rgba(255,255,255,0.13)', borderTop: '2px solid #c9a84c', borderRadius: 14, padding: 26, minWidth: 360, maxWidth: 520, width: '92%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#eef1f6' }}>✨ 포인트 지급</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{selected.email}</div>
              </div>
              <button onClick={() => setPointModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 19, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>지급 포인트 (P)</div>
              <input
                value={pointAmount}
                onChange={e => setPointAmount(e.target.value)}
                placeholder="예) 1000"
                type="number"
                style={{ width: '100%', background: '#161b24', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, color: '#eef1f6', fontSize: 12, padding: '8px 11px', outline: 'none', fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>지급 사유</div>
              <select
                value={pointReason}
                onChange={e => setPointReason(e.target.value)}
                style={{ width: '100%', background: '#161b24', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, color: '#eef1f6', fontSize: 12, padding: '8px 11px', outline: 'none' }}
              >
                <option>관리자 수동 지급</option>
                <option>이벤트 보상</option>
                <option>오류 보상</option>
                <option>구매 적립 수동</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button className="btn btn-gy" onClick={() => setPointModal(false)}>취소</button>
              <button className="btn btn-gd" onClick={grantPoints} disabled={pointSaving} style={{ opacity: pointSaving ? 0.7 : 1 }}>
                {pointSaving ? '지급 중...' : '✨ 지급'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

