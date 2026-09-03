'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import BrandLogisticsDailyClose from './BrandLogisticsDailyClose'
import BrandBatchFulfillmentList from './BrandBatchFulfillmentList'
import BrandPouchFulfillmentList from './BrandPouchFulfillmentList'
import BrandAreteFulfillmentList from './BrandAreteFulfillmentList'
import BrandTierOrderFulfillmentList from './BrandTierOrderFulfillmentList'

function playBeep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.value = 0.08
    o.start()
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    o.stop(ctx.currentTime + 0.3)
  } catch {
    /* ignore */
  }
}

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GREEN = 'rgba(61,184,100,0.9)'
const COURIERS = ['CJ대한통운', '한진', '로젠', '우체국', '롯데'] as const
const BRAND_PALETTE = ['#7B5EA7', '#2188ff', '#3db864', '#E8A0BF', '#C9A96E', '#EF9F27', '#e85555']

type FilterTab = 'approved' | 'shipped'
type OrderItem = { name: string; qty: number; bonus?: number; product_id?: string; promo?: string }

type TrackBLine = {
  id: string
  order_id: string
  brand_id: string
  brand_name: string
  items: OrderItem[]
  status: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
}

type TrackBBatch = {
  id: string
  owner_name: string | null
  salon_name: string | null
  status: string
  created_at: string
  lines: TrackBLine[]
}

interface Props {
  brandId: string | null
  brandName: string
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

export default function BrandInventoryFulfillment({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [bBatches, setBBatches] = useState<TrackBBatch[]>([])
  const [loadingB, setLoadingB] = useState(true)
  const [toast, setToast] = useState('')
  const [filter, setFilter] = useState<FilterTab>('approved')
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedLineIds, setSelectedLineIds] = useState<Record<string, Set<string>>>({})
  const [todayClosed, setTodayClosed] = useState(false)
  const [batchTick, setBatchTick] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const pendingCountRef = useRef<Record<string, number | null>>({})
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }

  const reportPendingCount = useCallback((key: string, count: number) => {
    const prev = pendingCountRef.current[key]
    if (prev != null && count > prev && soundEnabledRef.current) playBeep()
    pendingCountRef.current[key] = count
  }, [])

  useEffect(() => {
    pendingCountRef.current = {}
  }, [filter])

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
  }, [brandId, supabase])

  useEffect(() => { void resolveCompanyBrands() }, [resolveCompanyBrands])

  const companyKey = companyBrandIds.slice().sort().join('|')

  const fetchTrackB = useCallback(async (opts?: { silent?: boolean }) => {
    const ids = companyKey ? companyKey.split('|').filter(Boolean) : []
    if (ids.length === 0) {
      setBBatches([])
      setLoadingB(false)
      reportPendingCount('trackB', 0)
      return
    }
    if (!opts?.silent) setLoadingB(true)
    const pending = filter === 'approved'
    const brandIdSet = new Set(ids)

    let parentQ = supabase
      .from('hq_stock_orders')
      .select('id, brand_id, company_id, profile_id, status, items, created_at, courier, tracking_no')
      .order('created_at', { ascending: false })
      .limit(50)

    if (companyId) {
      parentQ = parentQ.eq('company_id', companyId)
    } else {
      parentQ = parentQ.in('brand_id', ids)
    }
    parentQ = pending
      ? parentQ.in('status', ['결제완료', '배송중'])
      : parentQ.in('status', ['배송완료', '구매확정'])

    const { data: parentRows } = await parentQ
    const rawHq = (parentRows || []) as Array<Record<string, unknown>>
    if (rawHq.length === 0) {
      setBBatches([])
      setLoadingB(false)
      reportPendingCount('trackB', 0)
      return
    }

    const orderIds = rawHq.map((o) => String(o.id))
    const [{ data: lineRows }, { data: brandNameRows }] = await Promise.all([
      supabase
        .from('hq_stock_order_lines')
        .select('id, order_id, brand_id, items, line_amount, courier, tracking_no, shipped_at, status')
        .in('order_id', orderIds),
      supabase.from('brands').select('id, name').in('id', ids),
    ])
    const brandNameMap: Record<string, string> = {}
    for (const b of (brandNameRows || []) as Array<{ id: string; name?: string }>) {
      brandNameMap[String(b.id)] = String(b.name || '브랜드')
    }

    const linesByOrder = new Map<string, TrackBLine[]>()
    for (const raw of (lineRows || []) as Array<Record<string, unknown>>) {
      const bid = String(raw.brand_id || '')
      if (!brandIdSet.has(bid)) continue
      const orderId = String(raw.order_id || '')
      const line: TrackBLine = {
        id: String(raw.id),
        order_id: orderId,
        brand_id: bid,
        brand_name: brandNameMap[bid] || '브랜드',
        items: Array.isArray(raw.items) ? (raw.items as OrderItem[]) : [],
        status: String(raw.status || ''),
        courier: (raw.courier as string | null) || null,
        tracking_no: (raw.tracking_no as string | null) || null,
        shipped_at: (raw.shipped_at as string | null) || null,
      }
      if (!linesByOrder.has(orderId)) linesByOrder.set(orderId, [])
      linesByOrder.get(orderId)!.push(line)
    }

    // 레거시(라인 없음): 부모 items를 단일 라인으로 합성
    for (const o of rawHq) {
      const oid = String(o.id)
      if (linesByOrder.has(oid)) continue
      const bid = String(o.brand_id || '')
      if (!brandIdSet.has(bid)) continue
      linesByOrder.set(oid, [{
        id: oid,
        order_id: oid,
        brand_id: bid,
        brand_name: brandNameMap[bid] || '브랜드',
        items: Array.isArray(o.items) ? (o.items as OrderItem[]) : [],
        status: String(o.status || ''),
        courier: (o.courier as string | null) || null,
        tracking_no: (o.tracking_no as string | null) || null,
        shipped_at: null,
      }])
    }

    const hqProfileIds = Array.from(
      new Set(rawHq.map((o) => String(o.profile_id || '')).filter(Boolean)),
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

    const batches: TrackBBatch[] = []
    for (const o of rawHq) {
      const oid = String(o.id)
      const lines = linesByOrder.get(oid) || []
      if (lines.length === 0) continue
      const hasUnshipped = lines.some((l) => !l.tracking_no)
      const hasShipped = lines.some((l) => !!l.tracking_no)
      if (pending && !hasUnshipped) continue
      if (!pending && !hasShipped && !['배송완료', '구매확정'].includes(String(o.status || ''))) continue
      const pid = String(o.profile_id || '')
      const authId = profileIdToAuthId[pid] || ''
      const userId = authId ? authIdToUserId[authId] || '' : ''
      batches.push({
        id: oid,
        owner_name: (authId && authIdToUserName[authId]) || null,
        salon_name: (userId && userIdToSalonName[userId]) || null,
        status: String(o.status || ''),
        created_at: String(o.created_at || ''),
        lines,
      })
    }
    setBBatches(batches)
    setLoadingB(false)
    reportPendingCount('trackB', pending ? batches.length : 0)
  }, [companyKey, companyId, filter, supabase, reportPendingCount])

  useEffect(() => { void fetchTrackB() }, [fetchTrackB, batchTick])

  useEffect(() => {
    const id = setInterval(() => { void fetchTrackB({ silent: true }) }, 10000)
    return () => clearInterval(id)
  }, [fetchTrackB])

  const toggleLineSelect = (orderId: string, lineId: string) => {
    setSelectedLineIds((prev) => {
      const current = new Set(prev[orderId] ?? [])
      if (current.has(lineId)) current.delete(lineId)
      else current.add(lineId)
      return { ...prev, [orderId]: current }
    })
  }

  const decrementStockForBLine = async (line: TrackBLine) => {
    const { data: alreadyLogged } = await supabase
      .from('brand_stock_logs')
      .select('id')
      .eq('brand_id', line.brand_id)
      .eq('ref_type', 'order')
      .eq('ref_id', line.id)
      .limit(1)
    if (alreadyLogged && alreadyLogged.length > 0) return
    for (const item of line.items) {
      const invQuery = supabase
        .from('brand_inventory')
        .select('id, total_stock, safety_stock')
        .eq('brand_id', line.brand_id)
      const { data: invRow } = item.product_id
        ? await invQuery.eq('product_id', item.product_id).maybeSingle()
        : await invQuery.eq('product_name', item.name).maybeSingle()
      if (!invRow) {
        console.warn(`[재고차감 실패] 매칭 안 됨: ${item.name} (line ${line.id})`)
        await supabase.from('brand_stock_logs').insert({
          brand_id: line.brand_id,
          inventory_id: null,
          type: 'adjust',
          qty: item.qty + (item.bonus || 0),
          before_qty: 0,
          after_qty: 0,
          ref_type: 'order',
          ref_id: line.id,
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
        brand_id: line.brand_id,
        inventory_id: invRow.id,
        type: 'out',
        qty: item.qty,
        before_qty: invRow.total_stock,
        after_qty: midStock,
        ref_type: 'order',
        ref_id: line.id,
        staff_name: '발주 자동 출고',
        memo: `발주 출고(B, 판매): ${item.name} ${item.qty}개`,
        is_gift: false,
      }]
      if (bonusQty > 0) {
        logRows.push({
          brand_id: line.brand_id,
          inventory_id: invRow.id,
          type: 'out',
          qty: bonusQty,
          before_qty: midStock,
          after_qty: Math.max(0, midStock - bonusQty),
          ref_type: 'order',
          ref_id: line.id,
          staff_name: '발주 자동 출고',
          memo: `발주 출고(B, 증정): ${item.name} ${bonusQty}개`,
          is_gift: true,
        })
      }
      await supabase.from('brand_stock_logs').insert(logRows)
    }
  }

  const shipTrackB = async (batch: TrackBBatch) => {
    const input = trackingInputs[batch.id]
    if (!input?.courier || !input?.no.trim()) {
      showToast('택배사와 운송장 번호를 입력해주세요')
      return
    }
    const unshipped = batch.lines.filter((l) => !l.tracking_no)
    if (unshipped.length === 0) {
      showToast('이미 전부 발송된 주문이에요')
      return
    }
    const selected = selectedLineIds[batch.id]
    const targetLineIds = selected && selected.size > 0
      ? Array.from(selected).filter((id) => unshipped.some((l) => l.id === id))
      : unshipped.map((l) => l.id)
    if (targetLineIds.length === 0) {
      showToast('발송할 라인을 선택해주세요')
      return
    }

    setBusyId(batch.id)
    const now = new Date().toISOString()
    const trackingNo = input.no.trim()
    const targets = batch.lines.filter((l) => targetLineIds.includes(l.id))
    const legacyTargets = targets.filter((l) => l.id === batch.id)
    const lineTargets = targets.filter((l) => l.id !== batch.id)

    if (lineTargets.length > 0) {
      const { error: lineErr } = await supabase
        .from('hq_stock_order_lines')
        .update({
          status: '배송완료',
          courier: input.courier,
          tracking_no: trackingNo,
          shipped_at: now,
          updated_at: now,
        })
        .in('id', lineTargets.map((l) => l.id))
      if (lineErr) {
        setBusyId(null)
        showToast('처리 실패: ' + lineErr.message)
        return
      }
    }

    // 레거시(라인 테이블 없음): 부모 직접 배송완료
    if (legacyTargets.length > 0) {
      const { error: parentLegacyErr } = await supabase
        .from('hq_stock_orders')
        .update({
          status: '배송완료',
          courier: input.courier,
          tracking_no: trackingNo,
          updated_at: now,
        })
        .eq('id', batch.id)
      if (parentLegacyErr) {
        setBusyId(null)
        showToast('처리 실패: ' + parentLegacyErr.message)
        return
      }
    } else {
      const { data: allLines } = await supabase
        .from('hq_stock_order_lines')
        .select('id, status, tracking_no')
        .eq('order_id', batch.id)
      const rows = (allLines || []) as Array<{ id: string; status?: string; tracking_no?: string | null }>
      const allShipped = rows.length > 0 && rows.every((r) => !!r.tracking_no || r.status === '배송완료')
      const { error: parentErr } = await supabase
        .from('hq_stock_orders')
        .update({
          status: allShipped ? '배송완료' : '배송중',
          updated_at: now,
          ...(allShipped ? { courier: input.courier, tracking_no: trackingNo } : {}),
        })
        .eq('id', batch.id)
      if (parentErr) {
        showToast('라인 발송됨 · 부모상태 갱신 실패: ' + parentErr.message)
      }
    }

    for (const line of targets) {
      await decrementStockForBLine(line)
    }

    setTrackingInputs((prev) => {
      const n = { ...prev }
      delete n[batch.id]
      return n
    })
    setSelectedLineIds((prev) => ({ ...prev, [batch.id]: new Set() }))
    setBusyId(null)

    try {
      const sub = await subscribeDelivery(input.courier, trackingNo, targets[0]?.id || batch.id)
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
            📦 발송 처리 (A: 배치·주문번호 단위 · B: 라인 단위)
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: TEXT, cursor: 'pointer', marginRight: 4 }}>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
              🔔 알림음
            </label>
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

        <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 10, opacity: 0.85 }}>
          여기서 브랜드사가 승인완료한 발주를 확인하고 물류처리(발송) 하시면 됩니다. 새 건이 들어오면 알림음이 울려요.
        </div>
        <div style={{ fontSize: 11, color: GOLD, marginBottom: 8 }}>트랙A · 배치(주문번호) 단위</div>
        {companyBrandIds.length > 0 ? (
          <BrandBatchFulfillmentList
            brandIds={companyBrandIds}
            filter={filter}
            todayClosed={todayClosed}
            onToast={showToast}
            onShipped={() => setBatchTick((n) => n + 1)}
            onPendingCount={(n) => reportPendingCount('trackA', n)}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>브랜드 범위 확인 중…</div>
        )}
      </div>

      <div style={{ fontSize: 11, color: GOLD, marginTop: 20, marginBottom: 8 }}>
        등급파우치 · {filter === 'approved' ? '발송대기' : '발송이력'}
      </div>
      <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 6, opacity: 0.85 }}>
        샘플파우치 발송 대기
      </div>
      <div style={CARD}>
        <BrandPouchFulfillmentList
          companyId={companyId}
          filter={filter}
          onToast={showToast}
          onShipped={() => setBatchTick((n) => n + 1)}
          onPendingCount={(n) => reportPendingCount('pouch', n)}
        />
      </div>

      <div style={{ fontSize: 11, color: GOLD, marginTop: 20, marginBottom: 8 }}>
        아레테 월간번들 · {filter === 'approved' ? '발송대기' : '발송이력'}
      </div>
      <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 6, opacity: 0.85 }}>
        아레테 번들 발송 대기
      </div>
      <div style={CARD}>
        <BrandAreteFulfillmentList
          companyId={companyId}
          filter={filter}
          onToast={showToast}
          onShipped={() => setBatchTick((n) => n + 1)}
          onPendingCount={(n) => reportPendingCount('arete', n)}
        />
      </div>

      <div style={{ fontSize: 11, color: GOLD, marginTop: 20, marginBottom: 8 }}>
        등급혜택 · {filter === 'approved' ? '발송대기' : '발송이력'}
      </div>
      <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 6, opacity: 0.85 }}>
        등급혜택 자재 발송 대기
      </div>
      <BrandTierOrderFulfillmentList
        companyId={companyId}
        filter={filter}
        onToast={showToast}
        onPendingCount={(n) => reportPendingCount('tier', n)}
      />

      <div style={CARD}>
        <div style={{ fontSize: 11, color: '#c4a8f0', marginBottom: 6 }}>트랙B · 라인별 발송 (체크박스)</div>
        <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.5, marginBottom: 8, opacity: 0.85 }}>
          오렌몰(트랙B) 재구매 주문 발송 대기 목록입니다
        </div>
        {loadingB ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : bBatches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>
            {filter === 'approved' ? '트랙B 발송 대기 없음' : '트랙B 발송 이력 없음'}
          </div>
        ) : (
          bBatches.map((batch, i) => {
            const open = !!trackingInputs[batch.id]
            const unshippedCount = batch.lines.filter((l) => !l.tracking_no).length
            return (
              <div
                key={batch.id}
                style={{ padding: '12px 0', borderBottom: i < bBatches.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 9, padding: '1px 5px', borderRadius: 4,
                        background: 'rgba(123,94,167,0.18)', color: '#c4a8f0',
                      }}>B</span>
                      <span style={{ fontSize: 13, color: TEXT }}>{batch.owner_name || '원장님'}</span>
                      <span style={{ fontSize: 10, color: SUB }}>{batch.lines.length}라인</span>
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>
                      {batch.salon_name || '-'} · {new Date(batch.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
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

                {batch.lines.map((line) => {
                  const color = brandColor(line.brand_id)
                  const shipped = !!line.tracking_no
                  const selected = selectedLineIds[batch.id]?.has(line.id) ?? false
                  return (
                    <div
                      key={line.id}
                      style={{
                        marginBottom: 8, padding: 8, borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                      }}
                    >
                      {shipped || filter === 'shipped' ? (
                        <span style={{ width: 16, flexShrink: 0 }} />
                      ) : (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleLineSelect(batch.id, line.id)}
                          style={{ marginTop: 2, accentColor: PURPLE, flexShrink: 0 }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: `${color}22`, color, border: `0.5px solid ${color}55`,
                          }}>
                            {line.brand_name}
                          </span>
                          {shipped && (
                            <span style={{ fontSize: 11, color: GREEN }}>
                              발송완료 · {line.courier} · {line.tracking_no}
                            </span>
                          )}
                        </div>
                        {line.items.length > 0 && (
                          <div style={{ fontSize: 11, color: SUB }}>
                            {line.items.map((it) => formatOrderItemLine(it)).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {filter === 'approved' && open && unshippedCount > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
                      {(selectedLineIds[batch.id]?.size || 0) > 0
                        ? `선택 ${selectedLineIds[batch.id]!.size}개 라인 발송`
                        : `미발송 ${unshippedCount}개 라인 전체 발송`}
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
                        onClick={() => void shipTrackB(batch)}
                        style={{
                          padding: '7px 14px', borderRadius: 7, border: 'none', background: PURPLE,
                          color: '#fff', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        {busyId === batch.id ? '처리중…' : '발송완료'}
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
        💡 A는 배치 단위, B는 브랜드 라인별 체크박스 발송(부분 발송 가능).
      </div>
      <BrandLogisticsDailyClose brandId={brandId} onToast={showToast} onClosedChange={setTodayClosed} />
    </div>
  )
}
