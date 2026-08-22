'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
const GREEN = 'rgba(61,184,100,0.9)'
const SUB = 'var(--text3, #888)'
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
type OrderItem = { product_id: string; item_name: string; qty: number; brand_id: string }
type Enriched = OrderRow & { ownerName: string; tierName: string; items: OrderItem[] }
type Props = {
  companyId: string | null
  filter: 'approved' | 'shipped'
  onToast: (t: string) => void
}
export default function BrandTierOrderFulfillmentList({ companyId, filter, onToast }: Props) {
  const supabase = createClient()
  const [orders, setOrders] = useState<Enriched[]>([])
  const [loading, setLoading] = useState(false)
  const [inputs, setInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      let q = supabase
        .from('brand_tier_orders')
        .select('id, owner_id, tier_package_id, amount, approved_at, shipped_at, tracking_carrier, tracking_number')
        .eq('company_id', companyId)
        .not('approved_at', 'is', null)
      if (filter === 'approved') {
        q = q.is('shipped_at', null).order('approved_at', { ascending: true })
      } else {
        q = q.not('shipped_at', 'is', null).order('shipped_at', { ascending: false })
      }
      const { data: orderRows } = await q
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
        supabase.from('brand_tier_order_items').select('order_id, product_id, item_name, qty').in('order_id', orderIds),
      ])
      const profileMap: Record<string, string> = {}
      for (const p of (profiles || []) as any[]) {
        profileMap[String(p.id)] = String(p.owner_store_name || p.full_name || '원장님')
      }
      const tierNameMap: Record<string, string> = {}
      for (const t of (tiers || []) as any[]) {
        tierNameMap[String(t.id)] = String(t.tier_name)
      }
      const productIds = Array.from(new Set((items || []).map((it: any) => String(it.product_id)).filter(Boolean)))
      const { data: productRows } = productIds.length
        ? await supabase.from('brand_products').select('id, brand_id').in('id', productIds)
        : { data: [] }
      const productBrandMap: Record<string, string> = {}
      for (const p of (productRows || []) as any[]) {
        productBrandMap[String(p.id)] = String(p.brand_id)
      }
      const itemsByOrder: Record<string, OrderItem[]> = {}
      for (const it of (items || []) as any[]) {
        const oid = String(it.order_id)
        if (!itemsByOrder[oid]) itemsByOrder[oid] = []
        itemsByOrder[oid].push({
          product_id: String(it.product_id),
          item_name: String(it.item_name),
          qty: Math.trunc(Number(it.qty) || 0),
          brand_id: productBrandMap[String(it.product_id)] || '',
        })
      }
      setOrders(
        rows.map((r) => ({
          ...r,
          ownerName: profileMap[String(r.owner_id)] || '원장님',
          tierName: tierNameMap[String(r.tier_package_id)] || '',
          items: itemsByOrder[r.id] || [],
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [companyId, filter, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const decrementInventoryForOrder = async (order: Enriched) => {
    for (const item of order.items) {
      if (!item.qty || item.qty <= 0) continue
      const outMemo = `등급구매 발송: ${item.item_name} ${item.qty}개`
      const { data: alreadyLogged } = await supabase
        .from('brand_stock_logs')
        .select('id')
        .eq('ref_type', 'tier_order')
        .eq('ref_id', order.id)
        .eq('memo', outMemo)
        .limit(1)
      if (alreadyLogged && alreadyLogged.length > 0) continue
      let invRow: { id: string; total_stock: number } | null = null
      const byProduct = await supabase
        .from('brand_inventory')
        .select('id, total_stock')
        .eq('product_id', item.product_id)
        .maybeSingle()
      if (byProduct.data) {
        invRow = byProduct.data as { id: string; total_stock: number }
      } else {
        const byName = await supabase
          .from('brand_inventory')
          .select('id, total_stock')
          .eq('product_name', item.item_name)
          .maybeSingle()
        if (byName.data) invRow = byName.data as { id: string; total_stock: number }
      }
      if (!invRow) continue
      await supabase.rpc('decrement_inventory_stock', { p_inventory_id: invRow.id, p_qty: item.qty })
      await supabase.from('brand_stock_logs').insert({
        brand_id: item.brand_id || null,
        inventory_id: invRow.id,
        type: 'out',
        qty: item.qty,
        before_qty: invRow.total_stock,
        after_qty: Math.max(0, invRow.total_stock - item.qty),
        ref_type: 'tier_order',
        ref_id: order.id,
        staff_name: '등급구매 자동출고',
        memo: outMemo,
      })
    }
  }
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
      await decrementInventoryForOrder(order)
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
    return <div style={{ fontSize: 12, color: SUB }}>불러오는 중…</div>
  }
  if (orders.length === 0) {
    return (
      <div style={{ fontSize: 12, color: SUB, padding: '12px 0' }}>
        {filter === 'shipped' ? '발송이력이 없어요' : '발송대기 중인 등급구매 건이 없어요'}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {orders.map((o) => {
        const input = inputs[o.id] || { courier: '', no: '' }
        return (
          <div key={o.id} style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(123,94,167,0.3)', background: 'rgba(123,94,167,0.05)' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{o.ownerName}</div>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>
              {o.tierName} · 담은금액 {Math.trunc(o.amount).toLocaleString()}원 · 품목 {o.items.length}종
            </div>
            {filter === 'shipped' ? (
              <div style={{ fontSize: 11, color: GREEN }}>
                발송완료 · {o.tracking_carrier || '-'} · {o.tracking_number || '-'}
                {o.shipped_at ? (
                  <div style={{ color: SUB, marginTop: 2 }}>
                    {new Date(o.shipped_at).toLocaleDateString('ko-KR')}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
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
                        color: input.courier === c ? '#fff' : SUB,
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
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
