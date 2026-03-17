'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Point = { ym: string; revenue: number; orders: number }

function ymKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminRevenuePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState<Point[]>([])

  const maxRevenue = useMemo(() => Math.max(1, ...points.map(p => p.revenue)), [points])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const { data } = await supabase
        .from('orders')
        .select('final_amount,ordered_at,status')
        .gte('ordered_at', start.toISOString())
        .not('status', 'in', '("취소","환불")')

      const map = new Map<string, Point>()
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        map.set(ymKey(d), { ym: ymKey(d), revenue: 0, orders: 0 })
      }
      ;(data || []).forEach((o: any) => {
        const d = new Date(o.ordered_at)
        const k = ymKey(new Date(d.getFullYear(), d.getMonth(), 1))
        const p = map.get(k)
        if (!p) return
        p.revenue += o.final_amount || 0
        p.orders += 1
      })
      setPoints(Array.from(map.values()))
      setLoading(false)
    }
    run()
  }, [supabase])

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>매출 분석</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>최근 6개월 월별 매출</div>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
      ) : (
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '14px 14px' }}>
          {points.map(p => {
            const w = Math.round((p.revenue / maxRevenue) * 100)
            return (
              <div key={p.ym} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: '#fff' }}>{p.ym}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: '#c9a84c' }}>₩{p.revenue.toLocaleString()}</div>
                </div>
                <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${w}%`, height: '100%', background: '#c9a84c' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>주문 {p.orders}건</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

