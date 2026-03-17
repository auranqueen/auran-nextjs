'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type OrderRow = {
  id: string
  order_no: string
  status: string
  total_amount: number
  earn_points?: number | null
  points_awarded?: boolean | null
  tracking_no?: string | null
  courier?: string | null
  ordered_at?: string | null
  customer_id?: string | null
}

export default function AdminShippingPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [shipInput, setShipInput] = useState<Record<string, { courier: string; tracking: string }>>({})
  const [modalId, setModalId] = useState<string | null>(null)
  const [modalCourier, setModalCourier] = useState('CJ대한통운')
  const [modalTracking, setModalTracking] = useState('')
  const [modalMsg, setModalMsg] = useState('')
  const [modalSaving, setModalSaving] = useState(false)

  const pending = useMemo(() => rows.filter(r => r.status === '주문확인' || r.status === '발송준비'), [rows])
  const current = useMemo(() => rows.find(r => r.id === modalId) || null, [modalId, rows])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('orders')
        .select('id,order_no,status,total_amount,earn_points,points_awarded,tracking_no,courier,ordered_at,customer_id')
        .in('status', ['주문확인', '발송준비', '배송중'])
        .order('ordered_at', { ascending: true })
        .limit(200)
      setRows((data || []) as any)
      setLoading(false)
    }
    run()
  }, [supabase])

  const openShipModal = (o: OrderRow) => {
    setModalId(o.id)
    const courier = shipInput[o.id]?.courier || o.courier || 'CJ대한통운'
    const tracking = shipInput[o.id]?.tracking || o.tracking_no || ''
    setModalCourier(courier)
    setModalTracking(tracking)
    const name = ''
    setModalMsg(
      `[AURAN] 주문이 발송됐습니다.\n` +
      `운송장번호: ${tracking ? tracking : '(입력 후 자동 반영)'}\n` +
      `주문번호: ${o.order_no}\n\n` +
      `배송조회: https://auran.kr/track/\n` +
      `문의: support@auran.kr`
    )
  }

  const tryNotifyCustomer = async (customerId: string | null | undefined, title: string, body: string) => {
    if (!customerId) return
    // notifications 테이블이 있으면 기록 (없으면 무시)
    const res = await supabase.from('notifications').insert({
      user_id: customerId,
      type: 'shipping',
      title,
      body,
      icon: '🚚',
      is_read: false,
      created_at: new Date().toISOString(),
    })
    if (res.error) {
      // ignore (table or RLS might block)
    }
  }

  const shipFromModal = async () => {
    if (!modalId || !current) return
    if (!modalTracking.trim()) {
      alert('운송장 번호를 입력해주세요')
      return
    }
    setModalSaving(true)
    const courier = modalCourier
    const tracking = modalTracking.trim()
    const now = new Date().toISOString()
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: '배송중', tracking_no: tracking, courier, shipped_at: now })
        .eq('id', modalId)
      if (error) {
        alert(error.message)
        return
      }
      await tryNotifyCustomer(current.customer_id, '🚚 발송 안내', modalMsg.replace('(입력 후 자동 반영)', tracking))
      setRows(prev => prev.map(r => (r.id === modalId ? { ...r, status: '배송중', tracking_no: tracking, courier } : r)))
      setShipInput(prev => ({ ...prev, [modalId]: { courier, tracking } }))
      setModalId(null)
    } finally {
      setModalSaving(false)
    }
  }

  const markDelivered = async (id: string) => {
    const { error } = await supabase.from('orders').update({ status: '배송완료', delivered_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div>
      {pending.length > 0 ? (
        <div className="alert alert-warn">⚠️ 발송 처리 필요: <b>{pending.length}건</b> — 운송장 입력 후 발송 처리를 진행하세요.</div>
      ) : null}

      <div className="card">
        <div className="card-hdr">
          <div>
            <div className="card-title">🚚 배송 관리</div>
            <div className="card-sub">발송처리(배송중) / 배송완료 처리</div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>주문번호</th>
                <th>상태</th>
                <th>금액</th>
                <th>운송장</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.id}>
                  <td className="mono">{o.order_no}</td>
                  <td><span className={`b ${o.status === '배송중' ? 'b-pu' : 'b-gd'}`}>{o.status}</span></td>
                  <td className="mono">₩{Number(o.total_amount || 0).toLocaleString()}</td>
                  <td>
                    {o.status === '배송중' ? (
                      <div className="mono">{o.courier || '-'} · {o.tracking_no || '-'}</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select
                          value={shipInput[o.id]?.courier || 'CJ대한통운'}
                          onChange={e => setShipInput(p => ({ ...p, [o.id]: { courier: e.target.value, tracking: p[o.id]?.tracking || '' } }))}
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 11, padding: '7px 8px', outline: 'none' }}
                        >
                          {['CJ대한통운', '우체국택배', '한진택배', '롯데택배', '로젠택배'].map(c => <option key={c}>{c}</option>)}
                        </select>
                        <input
                          value={shipInput[o.id]?.tracking || ''}
                          onChange={e => setShipInput(p => ({ ...p, [o.id]: { tracking: e.target.value, courier: p[o.id]?.courier || 'CJ대한통운' } }))}
                          placeholder="운송장 번호"
                          style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 11, padding: '7px 10px', outline: 'none', fontFamily: "'JetBrains Mono', monospace", width: 160 }}
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 7 }}>
                      {o.status === '배송중' ? (
                        <button className="btn btn-gd" onClick={() => markDelivered(o.id)}>✅ 배송완료</button>
                      ) : (
                        <button className="btn btn-gr" onClick={() => openShipModal(o)}>🚚 발송</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ color: 'var(--text3)' }}>표시할 주문이 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>

      {modalId && current && (
        <div onClick={() => setModalId(null)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderTop: '2px solid var(--gold)', borderRadius: 14, padding: 26, minWidth: 460, maxWidth: 600, width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>🚚 발송 처리</div>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 3 }} className="mono">{current.order_no}</div>
              </div>
              <button onClick={() => setModalId(null)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 19, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>택배사</div>
                <select value={modalCourier} onChange={e => setModalCourier(e.target.value)} style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '8px 11px', outline: 'none' }}>
                  {['CJ대한통운', '우체국택배', '한진택배', '롯데택배', '로젠택배'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>운송장 번호</div>
                <input value={modalTracking} onChange={e => setModalTracking(e.target.value)} placeholder="운송장 번호" style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 12, padding: '8px 11px', outline: 'none', fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>고객 알림 문구 (직접 수정 가능)</div>
              <textarea
                value={modalMsg}
                onChange={e => setModalMsg(e.target.value)}
                rows={6}
                style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 11, padding: '10px 11px', outline: 'none', lineHeight: 1.7, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-gy" onClick={() => setModalId(null)}>취소</button>
              <button
                className="btn btn-gy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(modalMsg)
                  } catch {}
                }}
              >
                💬 문구 복사
              </button>
              <button className="btn btn-gr" onClick={shipFromModal} disabled={modalSaving} style={{ opacity: modalSaving ? 0.7 : 1 }}>
                {modalSaving ? '처리 중...' : '🚚 발송 완료 + 알림 기록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

