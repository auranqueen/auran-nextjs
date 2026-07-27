'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
const COURIERS = ['CJ', '한진', '로젠', '우체국', '롯데']
type OrderRow = {
  id: string
  owner_id: string
  tier_package_id: string
  amount: number
  approved_at: string | null
  shipped_at: string | null
  tracking_carrier: string | null
  tracking_number: string | null
}
type Enriched = OrderRow & { ownerName: string; tierName: string; itemCount: number }
type Props = {
  companyId: string | null
  onToast: (t: string) => void
}
export default function BrandTierOrderFulfillmentList({ companyId, onToast }: Props) {
  const supabase = createClient()
  const [orders, setOrders] = useState<Enriched[]>([])
  const [loading, setLoading] = useState(false)
  const [inputs, setInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data: orderRows } = await supabase
        .from('brand_tier_orders')
        .select('id, owner_id, tier_package_id, amount, approved_at, shipped_at, tracking_carrier, tracking_number')
        .eq('company_id', companyId)
        .not('approved_at', 'is', null)
        .is('shipped_at', null)
        .order('approved_at', { ascending: true })
      const rows = (orderRows || []) as OrderRow[]
      if (rows.length === 0) {
        setOrders([])
        return
      }
      const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id)))
      const tierIds = Array.from(new Set(rows.map((r) => r.tier_package_id)))
      const orderIds = rows.map((r) => r.id)
      const [{ data: profiles }, { data: tiers }, { data: items }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, owner_store_name').in('id', ownerIds),
        supabase.from('brand_tier_packages').select('id, tier_name').in('id', tierIds),
        supabase.from('brand_tier_order_items').select('order_id').in('order_id', orderIds),
      ])
      const profileMap: Record<string, string> = {}
      for (const p of (profiles || []) as any[]) {
        profileMap[String(p.id)] = String(p.owner_store_name || p.full_name || '원장님')
      }
      const tierNameMap: Record<string, string> = {}
      for (const t of (tiers || []) as any[]) {
        tierNameMap[String(t.id)] = String(t.tier_name)
      }
      const countMap: Record<string, number> = {}
      for (const it of (items || []) as any[]) {
        const oid = String(it.order_id)
        countMap[oid] = (countMap[oid] || 0) + 1
      }
      setOrders(
        rows.map((r) => ({
          ...r,
          ownerName: profileMap[String(r.owner_id)] || '원장님',
          tierName: tierNameMap[String(r.tier_package_id)] || '',
          itemCount: countMap[r.id] || 0,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [companyId, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const submit = async (order: Enriched) => {
    if (!companyId) return
    const input = inputs[order.id]
    if (!input?.courier || !input?.no?.trim()) {
      onToast('택배사와 운송장번호를 입력해 주세요')
      return
    }
    setSubmittingId(order.id)
    try {
      const res = await fetch('/api/brand/tier-orders/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ company_id: companyId, order_id: order.id, courier: input.courier, tracking_no: input.no.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        onToast('발송처리 실패')
        return
      }
      await fetch('/api/delivery/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ courier: input.courier, trackingNumber: input.no.trim(), orderId: order.id }),
      }).catch(() => {})
      onToast('발송 처리됐어요')
      await load()
    } finally {
      setSubmittingId(null)
    }
  }
  if (loading) {
    return <div style={{ fontSize: 12, color: 'var(--text3, #888)' }}>불러오는 중…</div>
  }
  if (orders.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text3, #888)', padding: '12px 0' }}>발송대기 중인 등급구매 건이 없어요</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {orders.map((o) => {
        const input = inputs[o.id] || { courier: '', no: '' }
        return (
          <div key={o.id} style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(123,94,167,0.3)', background: 'rgba(123,94,167,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{o.ownerName}</div>
            <div style={{ fontSize: 12, color: 'var(--text3, #888)', marginBottom: 10 }}>
              {o.tierName} · 담은금액 {Math.trunc(o.amount).toLocaleString()}원 · 품목 {o.itemCount}종
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {COURIERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInputs((prev) => ({ ...prev, [o.id]: { ...input, courier: c } }))}
                  style={{
                    fontSize: 12,
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: `1px solid ${input.courier === c ? PURPLE : 'rgba(255,255,255,0.15)'}`,
                    background: input.courier === c ? PURPLE : 'transparent',
                    color: input.courier === c ? '#fff' : 'var(--text3, #888)',
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="운송장 번호 입력"
                value={input.no}
                onChange={(e) => setInputs((prev) => ({ ...prev, [o.id]: { ...input, no: e.target.value } }))}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13 }}
              />
              <button
                type="button"
                disabled={submittingId === o.id}
                onClick={() => void submit(o)}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: submittingId === o.id ? 'wait' : 'pointer', opacity: submittingId === o.id ? 0.7 : 1 }}
              >
                {submittingId === o.id ? '처리 중…' : '발송완료'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
