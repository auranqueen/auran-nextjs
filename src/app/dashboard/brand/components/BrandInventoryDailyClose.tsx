'use client'
import { useCallback, useEffect, useMemo, useState, Fragment, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
interface Props {
  brandId: string | null
  companyBrandIds: string[]
  brandName: string
}
interface InvRow {
  id: string
  brand_id: string
  product_name: string
  total_stock: number
  safety_stock: number | null
}
interface LogRow {
  id: string
  inventory_id: string
  qty: number
  is_gift: boolean
  ref_id: string | null
}
interface OwnerBreakdown {
  key: string
  ownerName: string
  track: 'A' | 'B' | null
  sold: number
  gift: number
}
type PeriodType = 'day' | 'month' | 'year'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const DANGER = '#E53935'
const WARN = '#FFC107'
const GREEN = '#4CAF50'
const IS_GIFT_CUTOFF = '2026-08-11'
function pad(n: number) { return String(n).padStart(2, '0') }
function todayParts() {
  const d = new Date()
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}
function periodRange(type: PeriodType, y: number, m: number, d: number) {
  if (type === 'day') {
    return { start: `${y}-${pad(m)}-${pad(d)}T00:00:00`, end: `${y}-${pad(m)}-${pad(d)}T23:59:59`, label: `${y}년 ${m}월 ${d}일` }
  }
  if (type === 'month') {
    const lastDay = new Date(y, m, 0).getDate()
    return { start: `${y}-${pad(m)}-01T00:00:00`, end: `${y}-${pad(m)}-${pad(lastDay)}T23:59:59`, label: `${y}년 ${m}월` }
  }
  return { start: `${y}-01-01T00:00:00`, end: `${y}-12-31T23:59:59`, label: `${y}년` }
}
function prevPeriod(type: PeriodType, y: number, m: number, d: number) {
  if (type === 'day') {
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() - 1)
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }
  }
  if (type === 'month') {
    const dt = new Date(y, m - 1, 1)
    dt.setMonth(dt.getMonth() - 1)
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: 1 }
  }
  return { y: y - 1, m: 1, d: 1 }
}
export default function BrandInventoryDailyClose({ brandId, companyBrandIds }: Props) {
  const supabase = createClient()
  const init = todayParts()
  const [periodType, setPeriodType] = useState<PeriodType>('day')
  const [y, setY] = useState(init.y)
  const [m, setM] = useState(init.m)
  const [d, setD] = useState(init.d)
  const [trackFilter, setTrackFilter] = useState<'all' | 'A' | 'B'>('all')
  const [sortMode, setSortMode] = useState<'none' | 'stockDesc' | 'stockAsc'>('none')
  const resolvedBrandIds = companyBrandIds
  const [inventory, setInventory] = useState<InvRow[]>([])
  const [periodLogs, setPeriodLogs] = useState<LogRow[]>([])
  const [prevTotals, setPrevTotals] = useState<Record<string, number>>({})
  const [ownerByRef, setOwnerByRef] = useState<Record<string, { name: string; track: 'A' | 'B' }>>({})
  const [loading, setLoading] = useState(true)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [showLowStockDetail, setShowLowStockDetail] = useState(false)
  const [confirmedByName, setConfirmedByName] = useState('')
  const [closeRecord, setCloseRecord] = useState<{ confirmed_by: string | null; confirmed_at: string } | null>(null)
  const [closeSaving, setCloseSaving] = useState(false)
  const range = useMemo(() => periodRange(periodType, y, m, d), [periodType, y, m, d])
  const prevYmd = useMemo(() => prevPeriod(periodType, y, m, d), [periodType, y, m, d])
  const prevRange = useMemo(() => periodRange(periodType, prevYmd.y, prevYmd.m, prevYmd.d), [periodType, prevYmd])
  const load = useCallback(async () => {
    if (!resolvedBrandIds.length) return
    setLoading(true)
    const { data: invRows } = await supabase
      .from('brand_inventory')
      .select('id, brand_id, product_name, total_stock, safety_stock')
      .in('brand_id', resolvedBrandIds)
      .order('product_name')
    setInventory((invRows || []) as InvRow[])
    const invIds = (invRows || []).map((r: { id: string }) => r.id)
    if (!invIds.length) { setPeriodLogs([]); setLoading(false); return }
    const { data: logRows } = await supabase
      .from('brand_stock_logs')
      .select('id, inventory_id, qty, is_gift, ref_id')
      .in('inventory_id', invIds)
      .eq('type', 'out')
      .gte('created_at', range.start)
      .lte('created_at', range.end)
    setPeriodLogs((logRows || []) as LogRow[])
    const { data: prevLogs } = await supabase
      .from('brand_stock_logs')
      .select('inventory_id, qty')
      .in('inventory_id', invIds)
      .eq('type', 'out')
      .gte('created_at', prevRange.start)
      .lte('created_at', prevRange.end)
    const prevMap: Record<string, number> = {}
    for (const r of prevLogs || []) {
      const k = String((r as { inventory_id: string }).inventory_id)
      prevMap[k] = (prevMap[k] || 0) + Number((r as { qty: number }).qty || 0)
    }
    setPrevTotals(prevMap)
    const refIds = Array.from(new Set((logRows || []).map((r: { ref_id: string | null }) => r.ref_id).filter(Boolean))) as string[]
    const ownerMap: Record<string, { name: string; track: 'A' | 'B' }> = {}
    if (refIds.length) {
      const { data: aOrders } = await supabase
        .from('brand_orders')
        .select('id, owner_name, salon_name')
        .in('id', refIds)
      for (const o of aOrders || []) {
        const row = o as { id: string; owner_name?: string | null; salon_name?: string | null }
        ownerMap[row.id] = { name: row.owner_name || row.salon_name || '원장님', track: 'A' }
      }
      const { data: bLines } = await supabase
        .from('hq_stock_order_lines')
        .select('id, order_id')
        .in('id', refIds)
      const orderIds = Array.from(new Set((bLines || []).map((l: { order_id: string }) => l.order_id).filter(Boolean)))
      let bOrderMap: Record<string, { name: string }> = {}
      if (orderIds.length) {
        const { data: bOrders } = await supabase
          .from('hq_stock_orders')
          .select('id, owner_name, salon_name')
          .in('id', orderIds)
        for (const o of bOrders || []) {
          const row = o as { id: string; owner_name?: string | null; salon_name?: string | null }
          bOrderMap[row.id] = { name: row.owner_name || row.salon_name || '원장님' }
        }
      }
      for (const l of bLines || []) {
        const row = l as { id: string; order_id: string }
        const parent = bOrderMap[row.order_id]
        if (parent) ownerMap[row.id] = { name: parent.name, track: 'B' }
      }
    }
    setOwnerByRef(ownerMap)
    setLoading(false)
  }, [resolvedBrandIds, range, prevRange, supabase])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (periodType !== 'day' || !brandId) { setCloseRecord(null); return }
    let cancelled = false
    void (async () => {
      const closeDate = `${y}-${pad(m)}-${pad(d)}`
      const { data } = await supabase
        .from('brand_daily_close')
        .select('confirmed_by, confirmed_at')
        .eq('brand_id', brandId)
        .eq('close_date', closeDate)
        .maybeSingle()
      if (!cancelled) setCloseRecord(data as { confirmed_by: string | null; confirmed_at: string } | null)
    })()
    return () => { cancelled = true }
  }, [periodType, brandId, y, m, d])
  const filteredLogs = useMemo(() => {
    if (trackFilter === 'all') return periodLogs
    return periodLogs.filter((l) => l.ref_id && ownerByRef[l.ref_id]?.track === trackFilter)
  }, [periodLogs, trackFilter, ownerByRef])
  const perInventory = useMemo(() => {
    const map: Record<string, { sold: number; gift: number; owners: Record<string, OwnerBreakdown> }> = {}
    for (const log of filteredLogs) {
      if (!map[log.inventory_id]) map[log.inventory_id] = { sold: 0, gift: 0, owners: {} }
      const bucket = map[log.inventory_id]
      if (log.is_gift) bucket.gift += log.qty
      else bucket.sold += log.qty
      const owner = log.ref_id ? ownerByRef[log.ref_id] : null
      const ownerKey = owner ? `${owner.name}__${owner.track}` : '미확인'
      if (!bucket.owners[ownerKey]) {
        bucket.owners[ownerKey] = { key: ownerKey, ownerName: owner?.name || '미확인', track: owner?.track || null, sold: 0, gift: 0 }
      }
      if (log.is_gift) bucket.owners[ownerKey].gift += log.qty
      else bucket.owners[ownerKey].sold += log.qty
    }
    return map
  }, [filteredLogs, ownerByRef])
  const lowStockList = useMemo(
    () => inventory.filter((i) => i.safety_stock != null && i.total_stock <= i.safety_stock),
    [inventory],
  )
  const kpi = useMemo(() => {
    let sold = 0, gift = 0
    const ownerSet = new Set<string>()
    for (const bucket of Object.values(perInventory)) {
      sold += bucket.sold
      gift += bucket.gift
      for (const k of Object.keys(bucket.owners)) ownerSet.add(k)
    }
    return { total: sold + gift, sold, gift, ownerCount: ownerSet.size }
  }, [perInventory])
  const sortedInventory = useMemo(() => {
    const arr = [...inventory]
    if (sortMode === 'stockDesc') arr.sort((a, b) => b.total_stock - a.total_stock)
    if (sortMode === 'stockAsc') arr.sort((a, b) => a.total_stock - b.total_stock)
    return arr
  }, [inventory, sortMode])
  const periodLabel = periodType === 'day' ? '전일대비' : periodType === 'month' ? '지난달대비' : '작년대비'
  const includesLegacyData = range.start.slice(0, 10) < IS_GIFT_CUTOFF
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중…</div>
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'A', 'B'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTrackFilter(t)}
              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: `0.5px solid ${trackFilter === t ? '#7B5EA7' : 'rgba(255,255,255,0.1)'}`, background: trackFilter === t ? 'rgba(123,94,167,0.2)' : 'transparent', color: trackFilter === t ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
              {t === 'all' ? '전체' : `트랙${t}`}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '0.5px solid rgba(255,255,255,0.15)' }}>
            {(['day', 'month', 'year'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPeriodType(p)}
                style={{ fontSize: 11, padding: '5px 10px', border: 'none', background: periodType === p ? '#7B5EA7' : 'transparent', color: periodType === p ? '#fff' : SUB, cursor: 'pointer' }}>
                {p === 'day' ? '일별' : p === 'month' ? '월별' : '연도별'}
              </button>
            ))}
          </div>
          {periodType === 'day' && (
            <input type="date" value={`${y}-${pad(m)}-${pad(d)}`}
              onChange={(e) => { const [ny, nm, nd] = e.target.value.split('-').map(Number); setY(ny); setM(nm); setD(nd) }}
              style={{ fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: TEXT, colorScheme: 'dark' }} />
          )}
          {periodType === 'month' && (
            <input type="month" value={`${y}-${pad(m)}`}
              onChange={(e) => { const [ny, nm] = e.target.value.split('-').map(Number); setY(ny); setM(nm) }}
              style={{ fontSize: 12, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: TEXT, colorScheme: 'dark' }} />
          )}
          {periodType === 'year' && (
            <input type="number" value={y} onChange={(e) => setY(Number(e.target.value))}
              style={{ fontSize: 12, width: 70, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: TEXT }} />
          )}
          <button type="button" onClick={() => window.print()}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: TEXT, cursor: 'pointer' }}>🖨️ 인쇄</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>{range.label} 총 출고</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{kpi.total}개</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>판매 / 증정</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{kpi.sold} / {kpi.gift}</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>주문한 원장 수</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT }}>{kpi.ownerCount}명</div>
        </div>
        <div
          onClick={() => setShowLowStockDetail((v) => !v)}
          style={{ ...CARD, background: lowStockList.length > 0 ? 'rgba(229,57,53,0.1)' : CARD.background, cursor: 'pointer' }}
        >
          <div style={{ fontSize: 11, color: lowStockList.length > 0 ? DANGER : SUB, marginBottom: 4 }}>재고 부족 {lowStockList.length > 0 && <span style={{ fontSize: 9 }}>▾ 눌러서 보기</span>}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: lowStockList.length > 0 ? DANGER : TEXT }}>{lowStockList.length}종</div>
        </div>
      </div>
      {includesLegacyData && (
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 11, color: SUB }}>
          ℹ️ 2026년 8월 11일 이전 데이터는 판매/증정 구분이 안 되어있어요 — 그 이전 출고는 전부 판매로 표시돼요.
        </div>
      )}
      {showLowStockDetail && lowStockList.length > 0 && (
        <div style={{ background: 'rgba(229,57,53,0.08)', border: `0.5px solid ${DANGER}55`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: DANGER, marginBottom: 6, fontWeight: 500 }}>재고 부족 제품 (지금 남은 수량)</div>
          {lowStockList.map((p) => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: DANGER }}>
              <span>{p.product_name}</span>
              <span>{p.total_stock}개 남음</span>
            </div>
          ))}
        </div>
      )}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: SUB }}>제품별 재고현황 ({range.label} 누적) <span style={{ fontSize: 11 }}>— 행을 누르면 원장별 내역이 펼쳐져요</span></div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button type="button" onClick={() => setSortMode(sortMode === 'stockDesc' ? 'none' : 'stockDesc')}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `0.5px solid ${sortMode === 'stockDesc' ? '#7B5EA7' : 'rgba(255,255,255,0.1)'}`, background: sortMode === 'stockDesc' ? 'rgba(123,94,167,0.2)' : 'transparent', color: sortMode === 'stockDesc' ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
              많이 남은순
            </button>
            <button type="button" onClick={() => setSortMode(sortMode === 'stockAsc' ? 'none' : 'stockAsc')}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: `0.5px solid ${sortMode === 'stockAsc' ? '#7B5EA7' : 'rgba(255,255,255,0.1)'}`, background: sortMode === 'stockAsc' ? 'rgba(123,94,167,0.2)' : 'transparent', color: sortMode === 'stockAsc' ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
              적게 남은순
            </button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
              <th style={{ textAlign: 'left', padding: '6px 4px', color: SUB, fontWeight: 400 }}>제품명</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', color: SUB, fontWeight: 400 }}>판매</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', color: SUB, fontWeight: 400 }}>증정</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', color: SUB, fontWeight: 400 }}>지금 남은 재고</th>
              <th style={{ textAlign: 'right', padding: '6px 4px', color: SUB, fontWeight: 400 }}>{periodLabel}</th>
            </tr>
          </thead>
          <tbody>
            {sortedInventory.map((inv) => {
              const bucket = perInventory[inv.id]
              const sold = bucket?.sold || 0
              const gift = bucket?.gift || 0
              const total = sold + gift
              const isLow = inv.safety_stock != null && inv.total_stock <= inv.safety_stock
              const prevTotal = prevTotals[inv.id] || 0
              const diff = total - prevTotal
              const isExpanded = expandedProduct === inv.id
              const owners = bucket ? Object.values(bucket.owners) : []
              return (
                <Fragment key={inv.id}>
                  <tr onClick={() => total > 0 && setExpandedProduct(isExpanded ? null : inv.id)}
                    style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)', cursor: total > 0 ? 'pointer' : 'default' }}>
                    <td style={{ padding: '8px 4px', color: TEXT }}>{inv.product_name}</td>
                    <td style={{ textAlign: 'right', padding: '8px 4px', color: TEXT }}>{sold}</td>
                    <td style={{ textAlign: 'right', padding: '8px 4px', color: gift > 0 ? WARN : TEXT }}>{gift}</td>
                    <td style={{ textAlign: 'right', padding: '8px 4px', color: isLow ? DANGER : TEXT, fontWeight: isLow ? 600 : 400 }}>{inv.total_stock}</td>
                    <td style={{ textAlign: 'right', padding: '8px 4px', color: diff > 0 ? DANGER : diff < 0 ? GREEN : SUB, fontSize: 11 }}>
                      {diff > 0 ? `▲${diff} 더 나감` : diff < 0 ? `▽${-diff} 덜 나감` : '-'}
                    </td>
                  </tr>
                  {isExpanded && owners.length > 0 && (
                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <td colSpan={5} style={{ padding: '8px 16px' }}>
                        <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>{range.label} 누적 · 원장별</div>
                        {owners.map((o) => (
                          <div key={o.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11, color: SUB }}>
                            <span>{o.ownerName} {o.track ? `(트랙${o.track})` : ''}</span>
                            <span>판매 {o.sold}{o.gift > 0 ? ` · 증정 ${o.gift}` : ''}</span>
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {periodType === 'day' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 14 }}>
          {closeRecord ? (
            <div style={{ fontSize: 12, color: GREEN }}>
              ✅ {range.label} 마감 확인됨 · {closeRecord.confirmed_by || '이름없음'} · {new Date(closeRecord.confirmed_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          ) : (
            <>
              <input
                value={confirmedByName}
                onChange={(e) => setConfirmedByName(e.target.value)}
                placeholder="확인자 이름"
                style={{ fontSize: 12, width: 90, background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 8px', color: TEXT }}
              />
              <button
                type="button"
                disabled={closeSaving || !confirmedByName.trim() || !brandId}
                onClick={async () => {
                  if (!brandId) return
                  setCloseSaving(true)
                  const closeDate = `${y}-${pad(m)}-${pad(d)}`
                  const { error } = await supabase.from('brand_daily_close').insert({
                    brand_id: brandId,
                    close_date: closeDate,
                    confirmed_by: confirmedByName.trim(),
                  })
                  setCloseSaving(false)
                  if (!error) {
                    setCloseRecord({ confirmed_by: confirmedByName.trim(), confirmed_at: new Date().toISOString() })
                  } else {
                    window.alert('저장 실패: ' + error.message)
                  }
                }}
                style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8, border: 'none', background: closeSaving || !confirmedByName.trim() ? 'rgba(76,175,80,0.4)' : GREEN, color: '#fff', cursor: closeSaving || !confirmedByName.trim() ? 'not-allowed' : 'pointer' }}>
                🔒 오늘 마감 확인
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
