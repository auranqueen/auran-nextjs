'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
export default function AdminBrandProductFeeCard() {
  const [total, setTotal] = useState(0)
  const [count, setCount] = useState(0)
  useEffect(() => {
    const supabase = createClient()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    supabase
      .from('brand_product_orders')
      .select('platform_fee')
      .not('status', 'in', '("결제대기","취소")')
      .gte('ordered_at', monthStart)
      .then(({ data }) => {
        const rows = data || []
        setTotal(rows.reduce((s, r: any) => s + Number(r.platform_fee || 0), 0))
        setCount(rows.length)
      })
  }, [])
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>브랜드 제품 거래수수료 (이번달)</div>
      <div className="mono" style={{ color: 'var(--text)', fontSize: 12 }}>{count.toLocaleString()}건</div>
      <div className="mono" style={{ color: 'var(--gold)', fontSize: 14, fontWeight: 700 }}>₩{total.toLocaleString()}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>트랙A 전용, 오렌몰 매출과 별도 집계</div>
    </div>
  )
}
