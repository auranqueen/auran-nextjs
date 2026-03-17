'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminLivePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 6000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const [o, l] = await Promise.all([
        supabase.from('orders').select('id,order_no,status,final_amount,ordered_at').order('ordered_at', { ascending: false }).limit(12),
        supabase.from('login_logs').select('*').order('created_at', { ascending: false }).limit(12),
      ])
      setOrders(o.data || [])
      setLogs(l.data || [])
      setLoading(false)
    }
    run()
  }, [supabase, tick])

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
            실시간 모니터 <span style={{ marginLeft: 8, fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.35)', color: '#c9a84c', fontFamily: "'JetBrains Mono', monospace" }}>LIVE</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>6초마다 자동 새로고침</div>
        </div>
        <button
          onClick={() => setTick(x => x + 1)}
          style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.75)', fontWeight: 900, cursor: 'pointer' }}
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 900, color: '#fff' }}>📦 최근 주문</div>
            {orders.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>데이터 없음</div>
            ) : orders.map(o => (
              <div key={o.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.65)', fontFamily: "'JetBrains Mono', monospace" }}>
                  <span>{o.order_no}</span>
                  <span>{o.status}</span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>{o.ordered_at ? new Date(o.ordered_at).toLocaleString('ko-KR') : ''}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: '#c9a84c' }}>₩{(o.final_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 900, color: '#fff' }}>🔐 최근 로그인</div>
            {logs.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>데이터 없음</div>
            ) : logs.map(l => (
              <div key={l.id} style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.email}</div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
                  <span>{l.ip_address}</span>
                  <span>{l.created_at ? new Date(l.created_at).toLocaleString('ko-KR') : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

