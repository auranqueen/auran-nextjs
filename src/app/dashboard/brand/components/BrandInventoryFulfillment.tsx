'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import BrandLogisticsDailyClose from './BrandLogisticsDailyClose'
import BrandBatchFulfillmentList from './BrandBatchFulfillmentList'
import BrandTierOrderFulfillmentList from './BrandTierOrderFulfillmentList'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const COURIERS = ['CJ대한통운', '한진', '로젠', '우체국', '롯데'] as const

type FilterTab = 'approved' | 'shipped'

interface TrackBOrder {
  id: string
  owner_name: string | null
  salon_name: string | null
  status: string
  items: Array<{ name: string; qty: number; bonus?: number; product_id?: string }>
  created_at: string
  courier: string | null
  tracking_no: string | null
  brand_id: string
}

interface Props {
  brandId: string | null
  brandName: string
}

function formatOrderItemLine(it: { name: string; qty: number; bonus?: number }): string {
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

export default function BrandInventoryFulfillment({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [bOrders, setBOrders] = useState<TrackBOrder[]>([])
  const [loadingB, setLoadingB] = useState(true)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<FilterTab>('approved')
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [todayClosed, setTodayClosed] = useState(false)
  const [batchTick, setBatchTick] = useState(0)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }

  const resolveCompanyBrands = useCallback(async () => {
    if (!brandId) {
      setCompanyBrandIds([])
      setCompanyId(null)
      return
    }
    const { data } = await supabase.from('brands').select('company_id').eq('id', brandId).maybeSingle()
    const cid = data?.company_id ? String(data.company_id) : null
    setCompanyId(cid)
    if (!cid) {
      setCompanyBrandIds([brandId])
      return
    }
    const { data: rows } = await supabase.from('brands').select('id').eq('company_id', cid)
    const ids = ((rows || []) as Array<{ id: string }>).map((r) => r.id)
    setCompanyBrandIds(ids.length > 0 ? ids : [brandId])
  }, [brandId])

  useEffect(() => { void resolveCompanyBrands() }, [resolveCompanyBrands])

  const companyKey = companyBrandIds.slice().sort().join('|')

  const fetchTrackB = useCallback(async () => {
    const ids = companyKey ? companyKey.split('|').filter(Boolean) : []
    if (ids.length === 0) return
    setLoadingB(true)
    const pending = filter === 'approved'
    const { data: bRows } = await supabase
      .from('hq_stock_orders')
      .select('id, brand_id, profile_id, status, items, created_at, courier, tracking_no')
      .in('brand_id', ids)
      .in('status', pending ? ['결제완료'] : ['배송완료', '구매확정'])
      .order('created_at', { ascending: false })
      .limit(50)
    const rawHq = bRows || []
    const hqProfileIds = Array.from(
      new Set(rawHq.map((o: { profile_id?: string }) => String(o.profile_id || '')).filter(Boolean)),
    )
    const profileIdToAuthId: Record<string, string> = {}
    const authIdToUserName: Record<string, string> = {}
    const authIdToUserId: Record<string, string> = {}
    const userIdToSalonName: Record<string, string> = {}
    if (hqProfileIds.length) {
      const { data: profRows } = await supabase
        .from('profiles')
        .select('id, auth_id')
        .in('id', hqProfileIds)
      for (const p of profRows || []) {
        if (p.id && p.auth_id) profileIdToAuthId[String(p.id)] = String(p.auth_id)
      }
      const authIds = Array.from(new Set(Object.values(profileIdToAuthId)))
      if (authIds.length) {
        const { data: userRows } = await supabase
          .from('users')
          .select('id, auth_id, name')
          .in('auth_id', authIds)
        for (const u of userRows || []) {
          const aid = String((u as { auth_id?: string }).auth_id || '')
          if (!aid) continue
          authIdToUserName[aid] = String((u as { name?: string }).name || '원장')
          authIdToUserId[aid] = String(u.id)
        }
        const userIds = Array.from(new Set(Object.values(authIdToUserId)))
        if (userIds.length) {
          const { data: salonRows } = await supabase
            .from('salons')
            .select('owner_id, name')
            .in('owner_id', userIds)
          for (const s of salonRows || []) {
            const oid = String((s as { owner_id?: string }).owner_id || '')
            if (oid) userIdToSalonName[oid] = String((s as { name?: string }).name || '')
          }
        }
      }
    }

    setBOrders(
      (rawHq as Array<Record<string, unknown>>).map((o) => {
        const pid = String(o.profile_id || '')
        const authId = profileIdToAuthId[pid] || ''
        const userId = authId ? authIdToUserId[authId] || '' : ''
        return {
          id: String(o.id),
          brand_id: String(o.brand_id),
          owner_name: (authId && authIdToUserName[authId]) || null,
          salon_name: (userId && userIdToSalonName[userId]) || null,
          status: String(o.status || ''),
          items: Array.isArray(o.items) ? o.items as TrackBOrder['items'] : [],
          created_at: String(o.created_at || ''),
          courier: (o.courier as string | null) || null,
          tracking_no: (o.tracking_no as string | null) || null,
        }
      }),
    )
    setLoadingB(false)
  }, [companyKey, filter])

  useEffect(() => { void fetchTrackB() }, [fetchTrackB, batchTick])

  const decrementStockForB = async (order: TrackBOrder) => {
    const { data: alreadyLogged } = await supabase
      .from('brand_stock_logs')
      .select('id')
      .eq('brand_id', order.brand_id)
      .eq('ref_type', 'order')
      .eq('ref_id', order.id)
      .maybeSingle()
    if (alreadyLogged) return
    for (const item of order.items) {
      const invQuery = supabase
        .from('brand_inventory')
        .select('id, total_stock, safety_stock')
        .eq('brand_id', order.brand_id)
      const { data: invRow } = item.product_id
        ? await invQuery.eq('product_id', item.product_id).maybeSingle()
        : await invQuery.eq('product_name', item.name).maybeSingle()
      if (!invRow) continue
      await supabase.rpc('decrement_inventory_stock', { p_inventory_id: invRow.id, p_qty: item.qty })
      await supabase.from('brand_stock_logs').insert({
        brand_id: order.brand_id,
        inventory_id: invRow.id,
        type: 'out',
        qty: item.qty,
        before_qty: invRow.total_stock,
        after_qty: Math.max(0, invRow.total_stock - item.qty),
        ref_type: 'order',
        ref_id: order.id,
        staff_name: '발주 자동 출고',
        memo: `발주 출고(B): ${item.name} ${item.qty}개`,
      })
    }
  }

  const shipTrackB = async (order: TrackBOrder) => {
    const input = trackingInputs[order.id]
    if (!input?.courier || !input?.no.trim()) {
      showToast('택배사와 운송장 번호를 입력해주세요')
      return
    }
    setBusyId(order.id)
    const now = new Date().toISOString()
    const trackingNo = input.no.trim()
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
    await decrementStockForB(order)
    setTrackingInputs((prev) => { const n = { ...prev }; delete n[order.id]; return n })
    setBusyId(null)
    try {
      const sub = await subscribeDelivery(input.courier, trackingNo, order.id)
      showToast(sub.ok
        ? '트랙B 발송 완료! 추적 구독 등록됨'
        : `발송 저장됨 · 추적구독 실패: ${sub.error}`)
    } catch {
      showToast('발송 저장됨 · 추적구독 네트워크 오류')
    }
    void fetchTrackB()
  }

  if (!brandId) {
    return <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>브랜드 선택 중…</div>
  }

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
          background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px',
          borderRadius: 20, zIndex: 999,
        }}>{toast}</div>
      )}

      <div style={CARD}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12, gap: 8, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 12, color: SUB }}>
            📦 발송 처리 (A: 배치·주문번호 단위 · B: 개별)
          </div>
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

        <div style={{ fontSize: 11, color: GOLD, marginBottom: 8 }}>트랙A · 배치(주문번호) 단위</div>
        {companyBrandIds.length > 0 ? (
          <BrandBatchFulfillmentList
            brandIds={companyBrandIds}
            filter={filter}
            todayClosed={todayClosed}
            onToast={showToast}
            onShipped={() => setBatchTick((n) => n + 1)}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>브랜드 범위 확인 중…</div>
        )}
      </div>

      <div style={{ fontSize: 11, color: GOLD, marginTop: 20, marginBottom: 8 }}>등급혜택 · 발송대기</div>
      <BrandTierOrderFulfillmentList companyId={companyId} onToast={showToast} />

      <div style={CARD}>
        <div style={{ fontSize: 11, color: '#c4a8f0', marginBottom: 8 }}>트랙B · 개별 발송 (기존 유지)</div>
        {loadingB ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : bOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>
            {filter === 'approved' ? '트랙B 발송 대기 없음' : '트랙B 발송 이력 없음'}
          </div>
        ) : (
          bOrders.map((o, i) => {
            const items = Array.isArray(o.items) ? o.items : []
            const open = !!trackingInputs[o.id]
            return (
              <div
                key={o.id}
                style={{ padding: '12px 0', borderBottom: i < bOrders.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 4,
                        background: 'rgba(123,94,167,0.18)', color: '#c4a8f0',
                      }}>B</span>
                      <span style={{ fontSize: 13, color: TEXT }}>{o.owner_name || '원장님'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>
                      {o.salon_name || '-'} · {new Date(o.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  {filter === 'shipped' ? (
                    <span style={{ fontSize: 11, color: 'rgba(41,182,246,0.8)' }}>{o.status}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTrackingInputs((prev) => (
                        prev[o.id]
                          ? (() => { const n = { ...prev }; delete n[o.id]; return n })()
                          : { ...prev, [o.id]: { courier: '', no: '' } }
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
                {items.length > 0 && (
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
                    {items.map((it) => formatOrderItemLine(it)).join(' · ')}
                  </div>
                )}
                {filter === 'shipped' && o.tracking_no && (
                  <div style={{ fontSize: 11, color: 'rgba(41,182,246,0.8)' }}>
                    📦 {o.courier} · {o.tracking_no}
                  </div>
                )}
                {filter === 'approved' && open && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      {COURIERS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTrackingInputs((prev) => ({
                            ...prev,
                            [o.id]: { courier: c, no: prev[o.id]?.no || '' },
                          }))}
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
                        onChange={(e) => setTrackingInputs((prev) => ({
                          ...prev,
                          [o.id]: { courier: prev[o.id]?.courier || '', no: e.target.value },
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
                        disabled={busyId === o.id}
                        onClick={() => void shipTrackB(o)}
                        style={{
                          padding: '7px 14px', borderRadius: 7, border: 'none', background: PURPLE,
                          color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                        }}
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

      <div style={{ fontSize: 11, color: SUB, padding: '0 2px', marginBottom: 10 }}>
        💡 A는 승인완료 배치를 주문번호 단위로 발송(운송장 1개). B는 개별 처리 유지.
      </div>
      <BrandLogisticsDailyClose brandId={brandId} onToast={showToast} onClosedChange={setTodayClosed} />
    </div>
  )
}