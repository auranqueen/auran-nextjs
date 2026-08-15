'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GREEN = 'rgba(61,184,100,0.9)'
const COURIERS = ['CJ대한통운', '한진', '로젠', '우체국', '롯데'] as const

type FilterTab = 'approved' | 'shipped'
type KitItem = { product_id?: string; name?: string; qty?: number }

type PouchInvoice = {
  id: string
  owner_id: string
  billing_month: string
  pouch_tier: number | null
  pouch_status: string | null
  pouch_kit_snapshot: KitItem[] | null
  pouch_tracking_no: string | null
  pouch_courier: string | null
  pouch_shipped_at: string | null
  owner_name: string
  salon_name: string
}

type Props = {
  companyId: string | null
  filter: FilterTab
  onToast: (msg: string) => void
  onShipped?: () => void
}

const TIER_COLOR: Record<number, string> = {
  200: 'rgba(100,181,246,0.85)',
  300: GOLD,
  500: 'rgba(229,115,115,0.9)',
}

function parseSnapshot(raw: unknown): KitItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => {
    const r = x as KitItem
    return {
      product_id: r.product_id ? String(r.product_id) : undefined,
      name: String(r.name || ''),
      qty: Math.trunc(Number(r.qty) || 0),
    }
  }).filter((x) => (x.qty || 0) > 0)
}

export default function BrandPouchFulfillmentList({ companyId, filter, onToast, onShipped }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<PouchInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [repBrandId, setRepBrandId] = useState<string | null>(null)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([])
      setRepBrandId(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const pouchStatus = filter === 'approved' ? 'approved' : 'shipped'
    const [{ data: invData }, { data: brandRow }] = await Promise.all([
      supabase
        .from('brand_billing_invoices')
        .select('id, owner_id, billing_month, pouch_tier, pouch_status, pouch_kit_snapshot, pouch_tracking_no, pouch_courier, pouch_shipped_at')
        .eq('company_id', companyId)
        .eq('pouch_status', pouchStatus)
        .not('pouch_tier', 'is', null)
        .order('billing_month', { ascending: false }),
      supabase.from('brands').select('id').eq('company_id', companyId).limit(1).maybeSingle(),
    ])
    setRepBrandId(brandRow?.id ? String(brandRow.id) : null)

    const list = (invData || []) as Array<{
      id: string
      owner_id: string
      billing_month: string
      pouch_tier: number | null
      pouch_status: string | null
      pouch_kit_snapshot: unknown
      pouch_tracking_no: string | null
      pouch_courier: string | null
      pouch_shipped_at: string | null
    }>
    const ownerIds = Array.from(new Set(list.map((r) => r.owner_id).filter(Boolean)))
    const nameMap: Record<string, { name: string; salon: string }> = {}
    if (ownerIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, owner_store_name')
        .in('id', ownerIds)
      for (const p of profiles || []) {
        const id = String((p as { id: string }).id)
        nameMap[id] = {
          name: String((p as { full_name?: string | null }).full_name || '원장님'),
          salon: String((p as { owner_store_name?: string | null }).owner_store_name || '-'),
        }
      }
    }
    setRows(list.map((r) => ({
      id: r.id,
      owner_id: r.owner_id,
      billing_month: r.billing_month,
      pouch_tier: r.pouch_tier,
      pouch_status: r.pouch_status,
      pouch_kit_snapshot: parseSnapshot(r.pouch_kit_snapshot),
      pouch_tracking_no: r.pouch_tracking_no,
      pouch_courier: r.pouch_courier,
      pouch_shipped_at: r.pouch_shipped_at,
      owner_name: nameMap[r.owner_id]?.name || '원장님',
      salon_name: nameMap[r.owner_id]?.salon || '-',
    })))
    setLoading(false)
  }, [companyId, filter, supabase])

  useEffect(() => { void load() }, [load])

  const decrementStockForPouchItem = async (
    brandId: string,
    invoiceId: string,
    item: KitItem,
  ) => {
    const qty = Math.trunc(Number(item.qty) || 0)
    if (qty <= 0) return
    const name = String(item.name || '')
    const productId = item.product_id ? String(item.product_id) : ''

    let invBrandId = brandId
    if (productId) {
      const { data: prod } = await supabase
        .from('brand_products')
        .select('brand_id')
        .eq('id', productId)
        .maybeSingle()
      if (prod?.brand_id) invBrandId = String(prod.brand_id)
    }

    const { data: alreadyLogged } = await supabase
      .from('brand_stock_logs')
      .select('id')
      .eq('brand_id', invBrandId)
      .eq('ref_type', 'pouch')
      .eq('ref_id', invoiceId)
      .eq('memo', `등급파우치 출고: ${name} ${qty}개`)
      .limit(1)
    if (alreadyLogged && alreadyLogged.length > 0) return

    const invQuery = supabase
      .from('brand_inventory')
      .select('id, total_stock, safety_stock')
      .eq('brand_id', invBrandId)
    const { data: invRow } = productId
      ? await invQuery.eq('product_id', productId).maybeSingle()
      : await invQuery.eq('product_name', name).maybeSingle()

    if (!invRow) {
      console.warn(`[재고차감 실패] 매칭 안 됨: ${name} (pouch ${invoiceId})`)
      await supabase.from('brand_stock_logs').insert({
        brand_id: invBrandId,
        inventory_id: null,
        type: 'adjust',
        qty,
        before_qty: 0,
        after_qty: 0,
        ref_type: 'pouch',
        ref_id: invoiceId,
        staff_name: '등급파우치 출고',
        memo: `재고매칭 실패로 미차감: ${name} (product_id: ${productId || '없음'})`,
      })
      return
    }

    await supabase.rpc('decrement_inventory_stock', { p_inventory_id: invRow.id, p_qty: qty })
    await supabase.from('brand_stock_logs').insert({
      brand_id: invBrandId,
      inventory_id: invRow.id,
      type: 'out',
      qty,
      before_qty: invRow.total_stock,
      after_qty: Math.max(0, invRow.total_stock - qty),
      ref_type: 'pouch',
      ref_id: invoiceId,
      staff_name: '등급파우치 출고',
      memo: `등급파우치 출고: ${name} ${qty}개`,
      is_gift: true,
    })
  }

  const shipPouch = async (inv: PouchInvoice) => {
    const input = trackingInputs[inv.id]
    if (!input?.courier || !input?.no.trim()) {
      onToast('택배사와 운송장 번호를 입력해주세요')
      return
    }
    const kit = inv.pouch_kit_snapshot || []
    if (!kit.length) {
      onToast('파우치 구성 스냅샷이 없어요')
      return
    }
    if (!repBrandId) {
      onToast('브랜드 정보를 찾을 수 없어요')
      return
    }

    setBusyId(inv.id)
    const trackingNo = input.no.trim()
    const now = new Date().toISOString()

    // 1) 재고차감 + 로그
    for (const item of kit) {
      await decrementStockForPouchItem(repBrandId, inv.id, item)
    }

    // 2) 청구서 발송상태 업데이트 (중복발송 방지)
    const { data: updated, error: updErr } = await supabase
      .from('brand_billing_invoices')
      .update({
        pouch_status: 'shipped',
        pouch_tracking_no: trackingNo,
        pouch_courier: input.courier,
        pouch_shipped_at: now,
      })
      .eq('id', inv.id)
      .eq('pouch_status', 'approved')
      .select('id')
      .maybeSingle()

    if (updErr || !updated?.id) {
      setBusyId(null)
      onToast(updErr ? `발송 실패: ${updErr.message}` : '이미 발송 처리됐거나 승인 상태가 아니에요')
      return
    }

    // 3) 원장 개인 알림
    const kitSummary = kit.map((k) => `${k.name || ''}×${k.qty || 0}`).join(', ')
    await supabase.from('brand_messages').insert({
      brand_id: repBrandId,
      message_type: 'pouch_dispatch',
      target_type: 'selected',
      target_owner_id: inv.owner_id,
      title: '등급파우치 발송 안내',
      body: `등급파우치(${inv.pouch_tier}만)가 발송됐어요. 택배사: ${input.courier} · 운송장: ${trackingNo}${kitSummary ? ` · 구성: ${kitSummary}` : ''}`,
      send_count: 1,
    })

    setTrackingInputs((prev) => {
      const n = { ...prev }
      delete n[inv.id]
      return n
    })
    setBusyId(null)
    onToast('등급파우치 발송 완료!')
    onShipped?.()
    await load()
  }

  if (!companyId) {
    return <div style={{ fontSize: 12, color: SUB, padding: '8px 0' }}>company_id가 없어요</div>
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
  }

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>
        {filter === 'approved' ? '등급파우치 발송 대기 없음' : '등급파우치 발송 이력 없음'}
      </div>
    )
  }

  return (
    <div>
      {rows.map((inv, i) => {
        const open = !!trackingInputs[inv.id]
        const tier = inv.pouch_tier
        const kit = inv.pouch_kit_snapshot || []
        return (
          <div
            key={inv.id}
            style={{ padding: '12px 0', borderBottom: i < rows.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 4,
                    background: 'rgba(201,169,110,0.18)', color: GOLD,
                  }}>파우치</span>
                  <span style={{ fontSize: 13, color: TEXT }}>{inv.owner_name}</span>
                  {tier != null && (
                    <span style={{
                      fontSize: 10, padding: '1px 7px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.06)',
                      color: TIER_COLOR[tier] || GOLD,
                    }}>{tier}만</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>{inv.salon_name}</div>
              </div>
              {filter === 'approved' ? (
                <button
                  type="button"
                  onClick={() => setTrackingInputs((prev) => (
                    open ? (() => { const n = { ...prev }; delete n[inv.id]; return n })()
                      : { ...prev, [inv.id]: prev[inv.id] || { courier: COURIERS[0], no: '' } }
                  ))}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: `0.5px solid ${PURPLE}`, background: open ? 'rgba(123,94,167,0.25)' : 'transparent',
                    color: '#c4a7e7',
                  }}
                >
                  {open ? '접기' : '발송처리'}
                </button>
              ) : (
                <div style={{ fontSize: 11, color: GREEN, textAlign: 'right' }}>
                  발송완료
                  {inv.pouch_shipped_at && (
                    <div style={{ color: SUB, marginTop: 2 }}>
                      {new Date(inv.pouch_shipped_at).toLocaleDateString('ko-KR')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
              {kit.length === 0 ? '구성 없음' : kit.map((k) => `${k.name} ×${k.qty}`).join(' · ')}
            </div>

            {filter === 'shipped' && (
              <div style={{ fontSize: 11, color: SUB }}>
                {inv.pouch_courier || '-'} · {inv.pouch_tracking_no || '-'}
              </div>
            )}

            {filter === 'approved' && open && (
              <div style={{ ...CARD, marginTop: 8, marginBottom: 0, padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <select
                    value={trackingInputs[inv.id]?.courier || COURIERS[0]}
                    onChange={(e) => setTrackingInputs((prev) => ({
                      ...prev,
                      [inv.id]: { courier: e.target.value, no: prev[inv.id]?.no || '' },
                    }))}
                    style={{ background: '#12101a', color: TEXT, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                  >
                    {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    value={trackingInputs[inv.id]?.no || ''}
                    onChange={(e) => setTrackingInputs((prev) => ({
                      ...prev,
                      [inv.id]: { courier: prev[inv.id]?.courier || COURIERS[0], no: e.target.value },
                    }))}
                    placeholder="운송장 번호"
                    style={{ flex: 1, minWidth: 140, background: '#12101a', color: TEXT, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                  />
                </div>
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => void shipPouch(inv)}
                  style={{
                    fontSize: 12, padding: '7px 14px', borderRadius: 6, border: 'none',
                    background: PURPLE, color: '#fff',
                    cursor: busyId === inv.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busyId === inv.id ? '처리중…' : '발송완료'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
