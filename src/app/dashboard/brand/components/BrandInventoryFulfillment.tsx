'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const COURIERS = ['CJ대한통운', '한진', '로젠', '우체국', '롯데'] as const

type FilterTab = 'approved' | 'shipped'
type Track = 'A' | 'B'

interface OrderRow {
  id: string
  track: Track
  owner_name: string | null
  salon_name: string | null
  grade: string | null
  status: string
  items: Array<{ name: string; qty: number; bonus?: number; product_id?: string }>
  promo_applied: string | null
  created_at: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
  batch_id?: string | null
}

type ChecklistItem = {
  id: string
  batch_id: string
  label: string
  checked: boolean
  checked_at: string | null
  checked_by: string | null
}

interface Props {
  brandId: string | null
  brandName: string
}

function formatOrderItemLine(it: { name: string; qty: number; bonus?: number }): string {
  const bonus = Math.trunc(Number(it.bonus) || 0)
  return `${it.name} ${it.qty}ea${bonus > 0 ? ` (+${bonus} 증정)` : ''}`
}

function trackBadge(track: Track) {
  return (
    <span style={{
      fontSize: 9, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
      background: track === 'A' ? 'rgba(201,169,110,0.15)' : 'rgba(123,94,167,0.18)',
      color: track === 'A' ? GOLD : '#c4a8f0',
    }}>
      {track}
    </span>
  )
}

async function subscribeDelivery(courier: string, trackingNumber: string, orderId: string) {
  const subRes = await fetch('/api/delivery/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courier, trackingNumber, orderId }),
  })
  const subJson = await subRes.json().catch(() => ({})) as { ok?: boolean; error?: string }
  return { ok: subRes.ok && !!subJson.ok, error: subJson.error || String(subRes.status) }
}

export default function BrandInventoryFulfillment({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<FilterTab>('approved')
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({})
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }

  const fetchOrders = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const aPending = filter === 'approved'
    const [{ data: aRows }, { data: bRows }] = await Promise.all([
      supabase
        .from('brand_orders')
        .select('id, owner_name, salon_name, grade, status, items, promo_applied, created_at, courier, tracking_no, shipped_at, batch_id')
        .eq('brand_id', brandId)
        .in('status', aPending ? ['approved'] : ['shipping', 'done'])
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('hq_stock_orders')
        .select('id, owner_name, salon_name, status, items, created_at, courier, tracking_no')
        .eq('brand_id', brandId)
        .in('status', aPending ? ['결제완료'] : ['배송완료', '구매확정'])
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    const listA: OrderRow[] = ((aRows || []) as Array<Omit<OrderRow, 'track'>>).map((o) => ({
      ...o,
      track: 'A' as const,
      batch_id: o.batch_id || null,
    }))
    const listB: OrderRow[] = ((bRows || []) as Array<Record<string, unknown>>).map((o) => ({
      id: String(o.id),
      track: 'B' as const,
      owner_name: (o.owner_name as string | null) || null,
      salon_name: (o.salon_name as string | null) || null,
      grade: null,
      status: String(o.status || ''),
      items: Array.isArray(o.items) ? o.items as OrderRow['items'] : [],
      promo_applied: null,
      created_at: String(o.created_at || ''),
      courier: (o.courier as string | null) || null,
      tracking_no: (o.tracking_no as string | null) || null,
      shipped_at: null,
      batch_id: null,
    }))
    const merged = [...listA, ...listB].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    setOrders(merged)

    const batchIds = Array.from(
      new Set(listA.map((o) => o.batch_id).filter((id): id is string => !!id)),
    )
    if (batchIds.length === 0) {
      setChecklists({})
    } else {
      const { data: checkRows } = await supabase
        .from('brand_order_batch_checklist_items')
        .select('id, batch_id, label, checked, checked_at, checked_by')
        .in('batch_id', batchIds)
        .order('created_at', { ascending: true })
      const map: Record<string, ChecklistItem[]> = {}
      for (const row of (checkRows || []) as ChecklistItem[]) {
        if (!map[row.batch_id]) map[row.batch_id] = []
        map[row.batch_id].push(row)
      }
      setChecklists(map)
    }
    setLoading(false)
  }, [brandId, filter, supabase])

  useEffect(() => { void fetchOrders() }, [fetchOrders])

  const toggleChecklistItem = async (item: ChecklistItem) => {
    const nextChecked = !item.checked
    const staffId =
      (typeof window !== 'undefined' ? sessionStorage.getItem('brand_staff_id') : null) || null
    const patch = {
      checked: nextChecked,
      checked_at: nextChecked ? new Date().toISOString() : null,
      checked_by: nextChecked ? staffId : null,
    }
    const { error } = await supabase
      .from('brand_order_batch_checklist_items')
      .update(patch)
      .eq('id', item.id)
    if (error) {
      showToast('체크 저장 실패: ' + error.message)
      return
    }
    setChecklists((prev) => {
      const list = prev[item.batch_id] || []
      return {
        ...prev,
        [item.batch_id]: list.map((c) =>
          c.id === item.id
            ? { ...c, checked: nextChecked, checked_at: patch.checked_at, checked_by: patch.checked_by }
            : c,
        ),
      }
    })
  }

  const decrementStockForOrder = async (order: OrderRow) => {
    if (!brandId) return
    const { data: alreadyLogged } = await supabase
      .from('brand_stock_logs')
      .select('id')
      .eq('brand_id', brandId)
      .eq('ref_type', 'order')
      .eq('ref_id', order.id)
      .maybeSingle()
    if (alreadyLogged) return
    const items = Array.isArray(order.items) ? order.items : []
    for (const item of items) {
      const invQuery = supabase.from('brand_inventory').select('id, total_stock, safety_stock').eq('brand_id', brandId)
      const { data: invRow } = item.product_id
        ? await invQuery.eq('product_id', item.product_id).maybeSingle()
        : await invQuery.eq('product_name', item.name).maybeSingle()
      if (!invRow) continue
      await supabase.rpc('decrement_inventory_stock', { p_inventory_id: invRow.id, p_qty: item.qty })
      await supabase.from('brand_stock_logs').insert({
        brand_id: brandId,
        inventory_id: invRow.id,
        type: 'out',
        qty: item.qty,
        before_qty: invRow.total_stock,
        after_qty: Math.max(0, invRow.total_stock - item.qty),
        ref_type: 'order',
        ref_id: order.id,
        staff_name: '발주 자동 출고',
        memo: `발주 출고(${order.track}): ${item.name} ${item.qty}개`,
      })
    }
  }

  const shipOrder = async (order: OrderRow) => {
    const input = trackingInputs[order.id]
    if (!input?.courier || !input?.no.trim()) {
      showToast('택배사와 운송장 번호를 입력해주세요')
      return
    }
    if (!brandId) return
    setBusyId(order.id)
    const now = new Date().toISOString()
    const trackingNo = input.no.trim()

    if (order.track === 'A') {
      const { error } = await supabase
        .from('brand_orders')
        .update({
          status: 'shipping',
          courier: input.courier,
          tracking_no: trackingNo,
          shipped_at: now,
          updated_at: now,
        })
        .eq('id', order.id)
      if (error) {
        setBusyId(null)
        showToast('처리 실패: ' + error.message)
        return
      }
      await supabase.from('brand_messages').insert({
        brand_id: brandId,
        message_type: 'auto_order',
        target_type: 'all',
        title: `${brandName} 발주 배송 시작`,
        body: `주문하신 제품이 발송됐어요. 택배사: ${input.courier} · 운송장: ${trackingNo}`,
        send_count: 1,
      })
      await decrementStockForOrder(order)
    } else {
      // 트랙B: 결제완료 → 배송완료 + 운송장 저장 (tracking_no/courier 컬럼 사용)
      const { error } = await supabase
        .from('hq_stock_orders')
        .update({
          status: '배송완료',
          courier: input.courier,
          tracking_no: trackingNo,
          updated_at: now,
        })
        .eq('id', order.id)
      if (error) {
        setBusyId(null)
        showToast('처리 실패: ' + error.message)
        return
      }
      await decrementStockForOrder(order)
    }

    setTrackingInputs((prev) => { const n = { ...prev }; delete n[order.id]; return n })
    setBusyId(null)

    // A/B 동일: DeliveryAPI 웹훅 구독
    try {
      const sub = await subscribeDelivery(input.courier, trackingNo, order.id)
      showToast(sub.ok
        ? '배송 처리 완료! 추적 구독 등록됨'
        : `발송 저장됨 · 추적구독 실패: ${sub.error}`)
    } catch {
      showToast('발송 저장됨 · 추적구독 네트워크 오류')
    }
    void fetchOrders()
  }

  if (!brandId) {
    return <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>브랜드 선택 중…</div>
  }

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: SUB }}>📦 발송 처리 (트랙A 승인 · 트랙B 결제완료)</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { key: 'approved' as const, label: '발송 대기' },
              { key: 'shipped' as const, label: '발송 이력' },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                style={{
                  fontSize: 11, padding: '2px 10px', borderRadius: 20, cursor: 'pointer',
                  border: `0.5px solid ${filter === t.key ? PURPLE : 'rgba(255,255,255,0.1)'}`,
                  background: filter === t.key ? 'rgba(123,94,167,0.2)' : 'transparent',
                  color: filter === t.key ? '#c4a7e7' : SUB,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>
            {filter === 'approved' ? '발송 대기 발주가 없어요' : '발송 이력이 없어요'}
          </div>
        ) : (
          orders.map((o, i) => {
            const items = Array.isArray(o.items) ? o.items : []
            const open = !!trackingInputs[o.id]
            const statusLabel = o.track === 'A'
              ? (o.status === 'done' ? '완료' : o.status === 'shipping' ? '배송중' : o.status)
              : o.status
            return (
              <div key={`${o.track}-${o.id}`} style={{ padding: '12px 0', borderBottom: i < orders.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      {trackBadge(o.track)}
                      <span style={{ fontSize: 13, color: TEXT }}>{o.owner_name || '원장님'}</span>
                      {o.grade && (
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', border: '0.5px solid rgba(123,94,167,0.3)' }}>{o.grade}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>{o.salon_name || '-'} · {new Date(o.created_at).toLocaleDateString('ko-KR')}</div>
                  </div>
                  {filter === 'shipped' ? (
                    <span style={{ fontSize: 11, color: 'rgba(41,182,246,0.8)', flexShrink: 0 }}>{statusLabel}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTrackingInputs((prev) => (
                        prev[o.id] ? (() => { const n = { ...prev }; delete n[o.id]; return n })() : { ...prev, [o.id]: { courier: '', no: '' } }
                      ))}
                      style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer', flexShrink: 0 }}
                    >
                      {open ? '접기' : '발송처리'}
                    </button>
                  )}
                </div>
                {items.length > 0 && (
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
                    {items.map((it) => formatOrderItemLine(it)).join(' · ')}
                    {o.promo_applied && <span style={{ marginLeft: 6, color: GOLD }}>{o.promo_applied} 적용</span>}
                  </div>
                )}
                {o.track === 'A' && o.batch_id && (checklists[o.batch_id]?.length || 0) > 0 && (
                  <div style={{ marginBottom: 8, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>물류 체크리스트</div>
                    {(checklists[o.batch_id] || []).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => void toggleChecklistItem(c)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 4px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: c.checked ? SUB : TEXT,
                          fontSize: 12,
                        }}
                      >
                        <span style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          flexShrink: 0,
                          border: `1.5px solid ${c.checked ? PURPLE : 'rgba(255,255,255,0.25)'}`,
                          background: c.checked ? PURPLE : 'transparent',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          color: '#fff',
                        }}>
                          {c.checked ? '✓' : ''}
                        </span>
                        <span style={{ textDecoration: c.checked ? 'line-through' : 'none' }}>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {filter === 'shipped' && o.tracking_no && (
                  <div style={{ fontSize: 11, color: 'rgba(41,182,246,0.8)' }}>
                    📦 {o.courier} · {o.tracking_no}
                    {o.shipped_at && <span style={{ color: SUB, marginLeft: 6 }}>{new Date(o.shipped_at).toLocaleDateString('ko-KR')} 발송</span>}
                  </div>
                )}
                {filter === 'approved' && open && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>운송장 입력 → 저장 시 재고 차감·추적 구독</div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      {COURIERS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTrackingInputs((prev) => ({ ...prev, [o.id]: { courier: c, no: prev[o.id]?.no || '' } }))}
                          style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            border: `0.5px solid ${trackingInputs[o.id]?.courier === c ? PURPLE : 'rgba(255,255,255,0.1)'}`,
                            background: trackingInputs[o.id]?.courier === c ? 'rgba(123,94,167,0.2)' : 'transparent',
                            color: trackingInputs[o.id]?.courier === c ? '#c4a7e7' : SUB,
                          }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={trackingInputs[o.id]?.no || ''}
                        onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [o.id]: { courier: prev[o.id]?.courier || '', no: e.target.value } }))}
                        placeholder="운송장 번호 입력"
                        style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none' }}
                      />
                      <button
                        type="button"
                        disabled={busyId === o.id}
                        onClick={() => void shipOrder(o)}
                        style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: PURPLE, color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                      >
                        {busyId === o.id ? '처리중…' : '발송완료'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
      <div style={{ fontSize: 11, color: SUB, padding: '0 2px' }}>
        💡 A는 승인 후, B는 결제완료 후 발송 가능. 발송 시 운송장 저장 + 추적 구독이 동일하게 등록됩니다.
      </div>
    </div>
  )
}
