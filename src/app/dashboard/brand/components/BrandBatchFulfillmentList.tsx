'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const COURIERS = ['CJ대한통운', '한진', '로젠', '우체국', '롯데'] as const
const BRAND_PALETTE = ['#7B5EA7', '#2188ff', '#3db864', '#E8A0BF', '#C9A96E', '#EF9F27', '#e85555']

type FilterTab = 'approved' | 'shipped'

type OrderItem = { name: string; qty: number; bonus?: number; product_id?: string; promo?: string }

type BatchOrderLine = {
  id: string
  brand_id: string
  brand_name: string
  items: OrderItem[]
  promo_applied: string | null
  status: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
}

type ChecklistItem = {
  id: string
  batch_id: string
  label: string
  checked: boolean
  checked_at: string | null
  checked_by: string | null
}

type BatchCard = {
  id: string
  order_no: string
  owner_name: string | null
  salon_name: string | null
  status: string
  created_at: string
  approved_at: string | null
  profile_id: string | null
  owner_note: string | null
  orders: BatchOrderLine[]
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
}

interface Props {
  brandIds: string[]
  filter: FilterTab
  todayClosed: boolean
  onToast: (msg: string) => void
  onShipped?: () => void
  onPendingCount?: (count: number) => void
}

function brandColor(brandId: string): string {
  let h = 0
  for (let i = 0; i < brandId.length; i++) h = (h + brandId.charCodeAt(i) * (i + 1)) % BRAND_PALETTE.length
  return BRAND_PALETTE[h]
}

function formatOrderItemLine(it: OrderItem): string {
  const bonus = Math.trunc(Number(it.bonus) || 0)
  return `${it.name} ${it.qty}ea${bonus > 0 ? ` (+${bonus} 증정)` : ''}`
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

export default function BrandBatchFulfillmentList({
  brandIds,
  filter,
  todayClosed,
  onToast,
  onShipped,
  onPendingCount,
}: Props) {
  const supabase = createClient()
  const [batches, setBatches] = useState<BatchCard[]>([])
  const [checklists, setChecklists] = useState<Record<string, ChecklistItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Record<string, Set<string>>>({})
  const scopeKey = brandIds.slice().sort().join('|')
  const onPendingCountRef = useRef(onPendingCount)
  onPendingCountRef.current = onPendingCount

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const ids = scopeKey ? scopeKey.split('|').filter(Boolean) : []
    if (ids.length === 0) {
      setBatches([])
      setChecklists({})
      setLoading(false)
      onPendingCountRef.current?.(0)
      return
    }
    if (!opts?.silent) setLoading(true)

    const { data: orderSeed } = await supabase
      .from('brand_orders')
      .select('batch_id')
      .in('brand_id', ids)
      .not('batch_id', 'is', null)
      .limit(500)

    const batchIds = Array.from(
      new Set(
        ((orderSeed || []) as Array<{ batch_id: string | null }>)
          .map((r) => r.batch_id)
          .filter((id): id is string => !!id),
      ),
    )
    if (batchIds.length === 0) {
      setBatches([])
      setChecklists({})
      setLoading(false)
      onPendingCountRef.current?.(0)
      return
    }

    const pending = filter === 'approved'
    let batchQ = supabase
      .from('brand_order_batches')
      .select('id, order_no, owner_name, salon_name, status, created_at, approved_at, profile_id, owner_note')
      .in('id', batchIds)
      .order('created_at', { ascending: false })
      .limit(80)

    batchQ = pending
      ? batchQ.eq('status', '승인완료')
      : batchQ.in('status', ['배송중', '배송완료'])

    const { data: batchRows } = await batchQ
    const batchList = (batchRows || []) as Array<{
      id: string
      order_no: string
      owner_name: string | null
      salon_name: string | null
      status: string
      created_at: string
      approved_at: string | null
      profile_id: string | null
      owner_note: string | null
    }>

    if (batchList.length === 0) {
      setBatches([])
      setChecklists({})
      setLoading(false)
      onPendingCountRef.current?.(0)
      return
    }

    const idList = batchList.map((b) => b.id)
    const [{ data: orderRows }, { data: checkRows }] = await Promise.all([
      supabase
        .from('brand_orders')
        .select('id, batch_id, brand_id, items, promo_applied, status, courier, tracking_no, shipped_at, brands(name)')
        .in('batch_id', idList),
      supabase
        .from('brand_order_batch_checklist_items')
        .select('id, batch_id, label, checked, checked_at, checked_by')
        .in('batch_id', idList)
        .order('created_at', { ascending: true }),
    ])

    const byBatch = new Map<string, BatchOrderLine[]>()
    const shipMeta: Record<string, { courier: string | null; tracking_no: string | null; shipped_at: string | null }> = {}

    for (const raw of (orderRows || []) as Array<Record<string, unknown>>) {
      const batchId = String(raw.batch_id || '')
      if (!batchId) continue
      const brandRel = Array.isArray(raw.brands) ? raw.brands[0] : raw.brands
      const brandObj = (brandRel || {}) as { name?: string | null }
      const line: BatchOrderLine = {
        id: String(raw.id),
        brand_id: String(raw.brand_id),
        brand_name: brandObj.name || '브랜드',
        items: Array.isArray(raw.items) ? (raw.items as OrderItem[]) : [],
        promo_applied: (raw.promo_applied as string | null) || null,
        status: String(raw.status || ''),
        courier: (raw.courier as string | null) || null,
        tracking_no: (raw.tracking_no as string | null) || null,
        shipped_at: (raw.shipped_at as string | null) || null,
      }
      if (!byBatch.has(batchId)) byBatch.set(batchId, [])
      byBatch.get(batchId)!.push(line)
      if (!shipMeta[batchId] && raw.tracking_no) {
        shipMeta[batchId] = {
          courier: (raw.courier as string | null) || null,
          tracking_no: (raw.tracking_no as string | null) || null,
          shipped_at: (raw.shipped_at as string | null) || null,
        }
      }
    }

    const checkMap: Record<string, ChecklistItem[]> = {}
    for (const row of (checkRows || []) as ChecklistItem[]) {
      if (!checkMap[row.batch_id]) checkMap[row.batch_id] = []
      checkMap[row.batch_id].push(row)
    }

    setChecklists(checkMap)
    setBatches(
      batchList.map((b) => ({
        ...b,
        orders: byBatch.get(b.id) || [],
        courier: shipMeta[b.id]?.courier || null,
        tracking_no: shipMeta[b.id]?.tracking_no || null,
        shipped_at: shipMeta[b.id]?.shipped_at || null,
      })),
    )
    setLoading(false)
    onPendingCountRef.current?.(pending ? batchList.length : 0)
  }, [scopeKey, filter, supabase])

  useEffect(() => {
    void load()
    const id = setInterval(() => { void load({ silent: true }) }, 10000)
    return () => clearInterval(id)
  }, [load])

  const toggleChecklistItem = async (item: ChecklistItem) => {
    if (todayClosed) {
      onToast('오늘 마감 후에는 체크리스트를 수정할 수 없습니다')
      return
    }
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
      onToast('체크 저장 실패: ' + error.message)
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

  const decrementStockForOrder = async (order: BatchOrderLine) => {
    const { data: alreadyLogged } = await supabase
      .from('brand_stock_logs')
      .select('id')
      .eq('brand_id', order.brand_id)
      .eq('ref_type', 'order')
      .eq('ref_id', order.id)
      .limit(1)
    if (alreadyLogged && alreadyLogged.length > 0) return
    for (const item of order.items) {
      const invQuery = supabase
        .from('brand_inventory')
        .select('id, total_stock, safety_stock')
        .eq('brand_id', order.brand_id)
      const { data: invRow } = item.product_id
        ? await invQuery.eq('product_id', item.product_id).maybeSingle()
        : await invQuery.eq('product_name', item.name).maybeSingle()
      if (!invRow) {
        console.warn(`[재고차감 실패] 매칭 안 됨: ${item.name} (order ${order.id})`)
        await supabase.from('brand_stock_logs').insert({
          brand_id: order.brand_id,
          inventory_id: null,
          type: 'adjust',
          qty: item.qty + (item.bonus || 0),
          before_qty: 0,
          after_qty: 0,
          ref_type: 'order',
          ref_id: order.id,
          staff_name: '발주 자동 출고',
          memo: `재고매칭 실패로 미차감: ${item.name} (product_id: ${item.product_id || '없음'})`,
        })
        continue
      }
      const bonusQty = item.bonus || 0
      const outQty = item.qty + bonusQty
      await supabase.rpc('decrement_inventory_stock', { p_inventory_id: invRow.id, p_qty: outQty })
      const midStock = Math.max(0, invRow.total_stock - item.qty)
      const logRows: Record<string, unknown>[] = [{
        brand_id: order.brand_id,
        inventory_id: invRow.id,
        type: 'out',
        qty: item.qty,
        before_qty: invRow.total_stock,
        after_qty: midStock,
        ref_type: 'order',
        ref_id: order.id,
        staff_name: '발주 자동 출고',
        memo: `배치 발송 출고(판매): ${item.name} ${item.qty}개`,
        is_gift: false,
      }]
      if (bonusQty > 0) {
        logRows.push({
          brand_id: order.brand_id,
          inventory_id: invRow.id,
          type: 'out',
          qty: bonusQty,
          before_qty: midStock,
          after_qty: Math.max(0, midStock - bonusQty),
          ref_type: 'order',
          ref_id: order.id,
          staff_name: '발주 자동 출고',
          memo: `배치 발송 출고(증정): ${item.name} ${bonusQty}개`,
          is_gift: true,
        })
      }
      await supabase.from('brand_stock_logs').insert(logRows)
    }
  }

  const toggleOrderSelect = (batchId: string, orderId: string) => {
    setSelectedOrderIds((prev) => {
      const current = new Set(prev[batchId] ?? [])
      if (current.has(orderId)) current.delete(orderId)
      else current.add(orderId)
      return { ...prev, [batchId]: current }
    })
  }

  const shipBatch = async (batch: BatchCard) => {
    const input = trackingInputs[batch.id]
    if (!input?.courier || !input?.no.trim()) {
      onToast('택배사와 운송장 번호를 입력해주세요')
      return
    }
    if (batch.orders.length === 0) {
      onToast('배치에 연결된 발주가 없습니다')
      return
    }
    const unshippedOrders = batch.orders.filter((o) => !o.tracking_no)
    if (unshippedOrders.length === 0) {
      onToast('이미 전부 발송된 주문이에요')
      return
    }
    const selected = selectedOrderIds[batch.id]
    // purpose: 이미 보낸 건 항상 제외 — if selected, only selected that are still unshipped
    const targetOrderIds = selected && selected.size > 0
      ? Array.from(selected).filter((id) => unshippedOrders.some((o) => o.id === id))
      : unshippedOrders.map((o) => o.id)
    if (targetOrderIds.length === 0) {
      onToast('발송할 주문을 선택해주세요')
      return
    }
    setBusyId(batch.id)
    const now = new Date().toISOString()
    const trackingNo = input.no.trim()

    const { error: ordersErr } = await supabase
      .from('brand_orders')
      .update({
        status: 'shipping',
        courier: input.courier,
        tracking_no: trackingNo,
        shipped_at: now,
        updated_at: now,
      })
      .in('id', targetOrderIds)

    if (ordersErr) {
      setBusyId(null)
      onToast('발송 실패: ' + ordersErr.message)
      return
    }

    const { error: batchErr } = await supabase
      .from('brand_order_batches')
      .update({ status: '배송중' })
      .eq('id', batch.id)
    if (batchErr) {
      // 주문은 이미 shipping — 배치 상태만 실패해도 계속
      onToast('주문은 발송됨 · 배치상태 갱신 실패: ' + batchErr.message)
    }

    for (const ord of batch.orders.filter((o) => targetOrderIds.includes(o.id))) {
      await decrementStockForOrder(ord)
    }

    const firstTarget = batch.orders.find((o) => targetOrderIds.includes(o.id))
    const firstBrandId = firstTarget?.brand_id
    if (firstBrandId) {
      await supabase.from('brand_messages').insert({
        brand_id: firstBrandId,
        message_type: 'auto_order',
        target_type: batch.profile_id ? 'selected' : 'all',
        target_owner_id: batch.profile_id || null,
        title: `발주 ${batch.order_no} 배송 시작`,
        body: `주문하신 제품이 발송됐어요. 택배사: ${input.courier} · 운송장: ${trackingNo}`,
        send_count: 1,
      })
    }

    setTrackingInputs((prev) => {
      const n = { ...prev }
      delete n[batch.id]
      return n
    })
    setSelectedOrderIds((prev) => ({ ...prev, [batch.id]: new Set() }))
    setBusyId(null)

    try {
      const sub = await subscribeDelivery(input.courier, trackingNo, firstTarget?.id || targetOrderIds[0])
      onToast(sub.ok
        ? `배치 ${batch.order_no} 발송 완료 · 추적 구독됨`
        : `발송 저장됨 · 추적구독 실패: ${sub.error}`)
    } catch {
      onToast('발송 저장됨 · 추적구독 네트워크 오류')
    }
    onShipped?.()
    void load()
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>불러오는 중...</div>
  }
  if (batches.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12 }}>
        {filter === 'approved' ? '발송 대기 배치가 없어요' : '발송 이력 배치가 없어요'}
      </div>
    )
  }

  return (
    <>
      {batches.map((batch, i) => {
        const open = !!trackingInputs[batch.id]
        return (
          <div
            key={batch.id}
            style={{ padding: '12px 0', borderBottom: i < batches.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                    background: 'rgba(201,169,110,0.15)', color: GOLD,
                  }}>A</span>
                  <span style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>{batch.order_no}</span>
                  <span style={{ fontSize: 12, color: TEXT }}>{batch.owner_name || '원장님'}</span>
                </div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {batch.salon_name || '-'} · {new Date(batch.created_at).toLocaleDateString('ko-KR')}
                  {batch.approved_at ? ` · 승인 ${new Date(batch.approved_at).toLocaleDateString('ko-KR')}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => window.open(`/dashboard/brand/print/order-batch/${batch.id}`, '_blank')}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    border: '0.5px solid rgba(201,169,110,0.45)', background: 'rgba(201,169,110,0.12)',
                    color: GOLD, cursor: 'pointer',
                  }}
                >
                  명세서 인쇄
                </button>
                {filter === 'shipped' ? (
                  <span style={{ fontSize: 11, color: 'rgba(41,182,246,0.8)' }}>{batch.status}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTrackingInputs((prev) => (
                      prev[batch.id]
                        ? (() => { const n = { ...prev }; delete n[batch.id]; return n })()
                        : { ...prev, [batch.id]: { courier: '', no: '' } }
                    ))}
                    style={{
                      fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none',
                      background: PURPLE, color: '#fff', cursor: 'pointer',
                    }}
                  >
                    {open ? '접기' : '발송처리'}
                  </button>
                )}
              </div>
            </div>

            {batch.orders.map((ord) => {
              const color = brandColor(ord.brand_id)
              const shipped = !!ord.tracking_no
              const selected = selectedOrderIds[batch.id]?.has(ord.id) ?? false
              return (
                <div
                  key={ord.id}
                  style={{
                    marginBottom: 8, padding: 8, borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}
                >
                  {shipped ? (
                    <span style={{ width: 16, flexShrink: 0 }} />
                  ) : (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOrderSelect(batch.id, ord.id)}
                      style={{ marginTop: 2, flexShrink: 0, cursor: 'pointer' }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, padding: '1px 7px', borderRadius: 10, display: 'inline-block',
                        background: `${color}22`, color, border: `0.5px solid ${color}55`,
                      }}>
                        {ord.brand_name}
                      </span>
                      {shipped && (
                        <span style={{ fontSize: 11, color: '#3db864' }}>
                          발송완료 · {ord.courier} · {ord.tracking_no}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>
                      {ord.items.map((it) => formatOrderItemLine(it)).join(' · ')}
                      {ord.promo_applied && <span style={{ marginLeft: 6, color: GOLD }}>{ord.promo_applied} 적용</span>}
                    </div>
                  </div>
                </div>
              )
            })}

            {batch.owner_note?.trim() ? (
              <div
                style={{
                  marginBottom: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(123,94,167,0.12)',
                  border: '0.5px solid rgba(123,94,167,0.35)',
                }}
              >
                <div style={{ fontSize: 11, color: '#c4a7e7', marginBottom: 4 }}>원장님 요청사항</div>
                <div style={{ fontSize: 12, color: TEXT, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {batch.owner_note.trim()}
                </div>
              </div>
            ) : null}

            {(checklists[batch.id]?.length || 0) > 0 && (
              <div style={{
                marginBottom: 8, padding: 8, borderRadius: 8,
                background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>물류 체크리스트</div>
                {todayClosed && (
                  <div style={{ fontSize: 10, color: GOLD, marginBottom: 4 }}>마감 완료 — 체크 수정 불가</div>
                )}
                {(checklists[batch.id] || []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    disabled={todayClosed}
                    onClick={() => void toggleChecklistItem(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                      padding: '6px 4px', border: 'none', background: 'transparent',
                      cursor: todayClosed ? 'not-allowed' : 'pointer', opacity: todayClosed ? 0.7 : 1,
                      color: c.checked ? SUB : TEXT, fontSize: 12,
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `1.5px solid ${c.checked ? PURPLE : 'rgba(255,255,255,0.25)'}`,
                      background: c.checked ? PURPLE : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#fff',
                    }}>
                      {c.checked ? '✓' : ''}
                    </span>
                    <span style={{ textDecoration: c.checked ? 'line-through' : 'none' }}>{c.label}</span>
                  </button>
                ))}
              </div>
            )}

            {filter === 'shipped' && batch.tracking_no && (
              <div style={{ fontSize: 11, color: 'rgba(41,182,246,0.8)' }}>
                📦 {batch.courier} · {batch.tracking_no}
                {batch.shipped_at && (
                  <span style={{ color: SUB, marginLeft: 6 }}>
                    {new Date(batch.shipped_at).toLocaleDateString('ko-KR')} 발송
                  </span>
                )}
              </div>
            )}

            {filter === 'approved' && open && (() => {
              const unshippedCount = batch.orders.filter((o) => !o.tracking_no).length
              const selSize = selectedOrderIds[batch.id]?.size ?? 0
              return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
                  {selSize > 0
                    ? `${selSize}건 선택됨 · 선택건만 발송`
                    : `잔여 ${unshippedCount}건 · 체크 안 하면 잔여분 전체 일괄 발송`}
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  {COURIERS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTrackingInputs((prev) => ({
                        ...prev,
                        [batch.id]: { courier: c, no: prev[batch.id]?.no || '' },
                      }))}
                      style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                        border: `0.5px solid ${trackingInputs[batch.id]?.courier === c ? PURPLE : 'rgba(255,255,255,0.1)'}`,
                        background: trackingInputs[batch.id]?.courier === c ? 'rgba(123,94,167,0.2)' : 'transparent',
                        color: trackingInputs[batch.id]?.courier === c ? '#c4a7e7' : SUB,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={trackingInputs[batch.id]?.no || ''}
                    onChange={(e) => setTrackingInputs((prev) => ({
                      ...prev,
                      [batch.id]: { courier: prev[batch.id]?.courier || '', no: e.target.value },
                    }))}
                    placeholder="운송장 번호 입력"
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.04)',
                      border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7,
                      padding: '7px 10px', fontSize: 12, color: TEXT, outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    disabled={busyId === batch.id}
                    onClick={() => void shipBatch(batch)}
                    style={{
                      padding: '7px 14px', borderRadius: 7, border: 'none', background: PURPLE,
                      color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {busyId === batch.id
                      ? '처리중…'
                      : (selSize > 0 ? `선택 ${selSize}건 발송완료` : `잔여 ${unshippedCount}건 발송완료`)}
                  </button>
                </div>
              </div>
              )
            })()}
          </div>
        )
      })}
    </>
  )
}