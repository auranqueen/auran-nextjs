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
}

export default function AdminShippingPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<OrderRow[]>([])
  const [shipInput, setShipInput] = useState<Record<string, { courier: string; tracking: string }>>({})

  const pending = useMemo(() => rows.filter(r => r.status === '주문확인' || r.status === '발송준비'), [rows])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('orders')
        .select('id,order_no,status,total_amount,earn_points,points_awarded,tracking_no,courier,ordered_at')
        .in('status', ['주문확인', '발송준비', '배송중'])
        .order('ordered_at', { ascending: true })
        .limit(200)
      setRows((data || []) as any)
      setLoading(false)
    }
    run()
  }, [supabase])

  const ship = async (id: string) => {
    const { courier, tracking } = shipInput[id] || { courier: 'CJ대한통운', tracking: '' }
    if (!tracking) {
      alert('운송장 번호를 입력해주세요')
      return
    }
    const { error } = await supabase
      .from('orders')
      .update({ status: '배송중', tracking_no: tracking, courier, shipped_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    setRows(prev => prev.map(r => (r.id === id ? { ...r, status: '배송중', tracking_no: tracking, courier } : r)))
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
                        <button className="btn btn-gr" onClick={() => ship(o.id)}>🚚 발송</button>
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
    </div>
  )
}

