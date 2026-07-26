'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = 'rgba(76,175,80,0.8)'

type BrandOpt = { id: string; name: string }
type PeriodKey = 'thisMonth' | 'lastMonth' | 'cycle26' | 'custom'
type Track = 'A' | 'B'
type DetailMode = 'monthOrders' | 'periodRevenue' | null

type OrderLine = {
  id: string
  created_at: string
  track: Track
  brand_id: string
  brand_name: string
  owner_name: string
  products: string
  amount: number
  cancelled: boolean
}

interface Props {
  myBrands: BrandOpt[]
  selectedBrandId: string | null
  onBrandChange: (brandId: string | null) => void
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function periodRange(key: PeriodKey, customStart: string, customEnd: string): { startIso: string; endIso: string; label: string } {
  const now = new Date()
  if (key === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { startIso: start.toISOString(), endIso: end.toISOString(), label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` }
  }
  if (key === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 1)
    return { startIso: start.toISOString(), endIso: end.toISOString(), label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` }
  }
  if (key === 'cycle26') {
    const d = now.getDate()
    const start = d >= 26
      ? new Date(now.getFullYear(), now.getMonth(), 26)
      : new Date(now.getFullYear(), now.getMonth() - 1, 26)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 26)
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1)
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: `${start.getMonth() + 1}/${start.getDate()}~${endDay.getMonth() + 1}/${endDay.getDate()}`,
    }
  }
  const s = customStart ? startOfLocalDay(new Date(customStart)) : startOfLocalDay(now)
  const e = customEnd ? startOfLocalDay(new Date(customEnd)) : startOfLocalDay(now)
  const endExclusive = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1)
  return {
    startIso: s.toISOString(),
    endIso: endExclusive.toISOString(),
    label: `${customStart || '?'}~${customEnd || '?'}`,
  }
}

function formatItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return '-'
  return items
    .map((it: { name?: string; qty?: number }) => `${it?.name || '?'} ${Math.trunc(Number(it?.qty) || 0)}ea`)
    .join(' · ')
}

function trackBadge(track: Track) {
  return (
    <span
      style={{
        fontSize: 9,
        padding: '1px 5px',
        borderRadius: 4,
        flexShrink: 0,
        background: track === 'A' ? 'rgba(201,169,110,0.15)' : 'rgba(123,94,167,0.18)',
        color: track === 'A' ? GOLD : '#c4a8f0',
      }}
    >
      {track}
    </span>
  )
}

function downloadCsv(rows: OrderLine[], filename: string) {
  const header = ['날짜', '트랙', '브랜드', '원장', '상품', '금액']
  const lines = rows.map((r) => [
    new Date(r.created_at).toLocaleDateString('ko-KR'),
    r.track,
    r.brand_name,
    r.owner_name,
    r.products.replace(/"/g, '""'),
    r.cancelled ? '0' : String(r.amount),
  ].map((c) => `"${c}"`).join(','))
  const bom = '\uFEFF'
  const blob = new Blob([bom + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function BrandOrdersSummary({ myBrands, selectedBrandId, onBrandChange }: Props) {
  const supabase = createClient()
  const [companyBrands, setCompanyBrands] = useState<BrandOpt[]>(myBrands)
  const [brandOpen, setBrandOpen] = useState(false)
  const [period, setPeriod] = useState<PeriodKey>('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [monthOrderCount, setMonthOrderCount] = useState(0)
  const [ownerCount, setOwnerCount] = useState(0)
  const [productCount, setProductCount] = useState(0)
  const [periodRevenue, setPeriodRevenue] = useState(0)
  const [monthRows, setMonthRows] = useState<OrderLine[]>([])
  const [periodRows, setPeriodRows] = useState<OrderLine[]>([])
  const [detailMode, setDetailMode] = useState<DetailMode>(null)

  const brandMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const b of companyBrands) m[b.id] = b.name
    return m
  }, [companyBrands])

  const activeBrandIds = useMemo(
    () => (selectedBrandId ? [selectedBrandId] : companyBrands.map((b) => b.id)),
    [selectedBrandId, companyBrands],
  )

  const periodMeta = useMemo(
    () => periodRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  )

  const brandLabel = selectedBrandId
    ? (brandMap[selectedBrandId] || '브랜드')
    : `전체 (${companyBrands.length}개 브랜드)`

  useEffect(() => {
    const loadBrands = async () => {
      if (myBrands.length === 0) { setCompanyBrands([]); return }
      const { data } = await supabase.from('brands').select('company_id').eq('id', myBrands[0].id).maybeSingle()
      const cid = data?.company_id ? String(data.company_id) : null
      if (!cid) { setCompanyBrands(myBrands); return }
      const { data: rows } = await supabase.from('brands').select('id, name').eq('company_id', cid).order('name')
      if (rows && rows.length > 0) setCompanyBrands(rows as BrandOpt[])
      else setCompanyBrands(myBrands)
    }
    void loadBrands()
  }, [myBrands, supabase])

  const fetchOrdersInRange = useCallback(async (brandIds: string[], startIso: string, endIso: string): Promise<OrderLine[]> => {
    if (brandIds.length === 0) return []
    const [{ data: aRows }, { data: bRows }] = await Promise.all([
      supabase
        .from('brand_orders')
        .select('id, brand_id, total_amount, status, created_at, owner_name, salon_name, items')
        .in('brand_id', brandIds)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('hq_stock_orders')
        .select('id, brand_id, final_amount, status, ordered_at, created_at, items, profile_id')
        .in('brand_id', brandIds)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false }),
    ])
    const listA: OrderLine[] = (aRows || []).map((o: Record<string, unknown>) => {
      const st = String(o.status || '')
      return {
        id: `A-${o.id}`,
        created_at: String(o.created_at),
        track: 'A' as const,
        brand_id: String(o.brand_id),
        brand_name: brandMap[String(o.brand_id)] || '-',
        owner_name: String(o.owner_name || o.salon_name || '원장'),
        products: formatItems(o.items),
        amount: Math.trunc(Number(o.total_amount) || 0),
        cancelled: st === 'cancelled' || st === '취소',
      }
    })
    // 트랙B: profile_id → profiles.auth_id → users.name / users.id → salons.name
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

    const listB: OrderLine[] = rawHq.map((o: Record<string, unknown>) => {
      const st = String(o.status || '')
      const pid = String(o.profile_id || '')
      const authId = profileIdToAuthId[pid] || ''
      const userId = authId ? authIdToUserId[authId] || '' : ''
      const ownerName = (authId && authIdToUserName[authId]) || '원장'
      return {
        id: `B-${o.id}`,
        created_at: String(o.ordered_at || o.created_at),
        track: 'B' as const,
        brand_id: String(o.brand_id),
        brand_name: brandMap[String(o.brand_id)] || '-',
        owner_name: ownerName,
        products: formatItems(o.items),
        amount: Math.trunc(Number(o.final_amount) || 0),
        cancelled: st === 'cancelled' || st === '취소',
      }
    })
    return [...listA, ...listB].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [supabase, brandMap])

  const load = useCallback(async () => {
    if (activeBrandIds.length === 0) {
      setMonthOrderCount(0); setOwnerCount(0); setProductCount(0); setPeriodRevenue(0)
      setMonthRows([]); setPeriodRows([]); setLoading(false)
      return
    }
    setLoading(true)
    const month = periodRange('thisMonth', '', '')
    const [monthList, periodList, ownerRes, productRes] = await Promise.all([
      fetchOrdersInRange(activeBrandIds, month.startIso, month.endIso),
      fetchOrdersInRange(activeBrandIds, periodMeta.startIso, periodMeta.endIso),
      supabase.from('brand_owner_links').select('id', { count: 'exact', head: true }).in('brand_id', activeBrandIds).eq('status', 'active'),
      supabase.from('brand_products').select('id', { count: 'exact', head: true }).in('brand_id', activeBrandIds),
    ])
    setMonthRows(monthList)
    setPeriodRows(periodList)
    setMonthOrderCount(monthList.length)
    setPeriodRevenue(periodList.reduce((s, r) => s + (r.cancelled ? 0 : r.amount), 0))
    setOwnerCount(ownerRes.count ?? 0)
    setProductCount(productRes.count ?? 0)
    setLoading(false)
  }, [activeBrandIds, fetchOrdersInRange, periodMeta, supabase])

  useEffect(() => { void load() }, [load])

  const detailRows = detailMode === 'monthOrders' ? monthRows : detailMode === 'periodRevenue' ? periodRows : []
  const detailTitle = detailMode === 'monthOrders' ? '이번달 발주 상세' : detailMode === 'periodRevenue' ? '기간 합계 매출 상세' : ''

  const csvName = () => {
    const safeBrand = brandLabel.replace(/[\\/:*?"<>|]/g, '_')
    const tag = detailMode === 'monthOrders' ? '이번달발주' : `매출_${periodMeta.label}`
    return `${safeBrand}_${tag}.csv`
  }

  const presetBtn = (key: PeriodKey, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => { setPeriod(key); setDetailMode(null) }}
      style={{
        fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
        border: `0.5px solid ${period === key ? PURPLE : 'rgba(255,255,255,0.1)'}`,
        background: period === key ? 'rgba(123,94,167,0.2)' : 'transparent',
        color: period === key ? '#c4a7e7' : SUB,
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ marginBottom: 10 }}>
      {/* 브랜드 드롭다운 */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => setBrandOpen((v) => !v)}
          style={{
            width: '100%', textAlign: 'left', fontSize: 12, padding: '9px 12px', borderRadius: 8,
            border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT, cursor: 'pointer',
          }}
        >
          {brandLabel} ▾
        </button>
        {brandOpen && (
          <div style={{
            position: 'absolute', zIndex: 20, left: 0, right: 0, marginTop: 4, maxHeight: 220, overflowY: 'auto',
            background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8,
          }}>
            <button
              type="button"
              onClick={() => { onBrandChange(null); setBrandOpen(false); setDetailMode(null) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                background: !selectedBrandId ? 'rgba(123,94,167,0.15)' : 'transparent',
                color: !selectedBrandId ? '#c4a7e7' : TEXT,
              }}
            >
              전체 ({companyBrands.length}개 브랜드)
            </button>
            {companyBrands.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { onBrandChange(b.id); setBrandOpen(false); setDetailMode(null) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                  background: selectedBrandId === b.id ? 'rgba(123,94,167,0.15)' : 'transparent',
                  color: selectedBrandId === b.id ? '#c4a7e7' : TEXT,
                }}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 기간 필터 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {presetBtn('thisMonth', '이번달')}
        {presetBtn('lastMonth', '지난달')}
        {presetBtn('cycle26', '26~25일 청구주기')}
        {presetBtn('custom', '기간직접선택')}
      </div>
      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
            style={{ flex: 1, padding: '7px 8px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT, fontSize: 12 }} />
          <span style={{ color: SUB, fontSize: 11 }}>~</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
            style={{ flex: 1, padding: '7px 8px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT, fontSize: 12 }} />
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
        {([
          { key: 'monthOrders' as const, label: '이번달 발주', value: `${monthOrderCount}건`, color: PURPLE, clickable: true },
          { key: null, label: '연결 원장님', value: `${ownerCount}명`, color: GOLD, clickable: false },
          { key: null, label: '등록 제품', value: `${productCount}개`, color: '#a07fd4', clickable: false },
          { key: 'periodRevenue' as const, label: '기간합계매출', value: `₩${periodRevenue.toLocaleString()}`, color: GREEN, clickable: true },
        ]).map((k) => (
          <button
            key={k.label}
            type="button"
            disabled={!k.clickable || loading}
            onClick={() => {
              if (!k.clickable || !k.key) return
              setDetailMode((prev) => (prev === k.key ? null : k.key))
            }}
            style={{
              ...CARD, marginBottom: 0, textAlign: 'center', cursor: k.clickable ? 'pointer' : 'default',
              border: detailMode === k.key ? `0.5px solid ${PURPLE}` : CARD.border as string,
              background: detailMode === k.key ? 'rgba(123,94,167,0.12)' : CARD.background as string,
            }}
          >
            <div style={{ fontSize: 18, color: k.color, marginBottom: 4 }}>{loading ? '-' : k.value}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}{k.clickable ? ' ▾' : ''}</div>
          </button>
        ))}
      </div>

      {/* 인라인 상세 */}
      {detailMode && (
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: SUB }}>{detailTitle} ({detailRows.length}건)</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => downloadCsv(detailRows, csvName())}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}
              >
                CSV 출력
              </button>
              <button
                type="button"
                onClick={() => setDetailMode(null)}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: SUB, cursor: 'pointer' }}
              >
                접기
              </button>
            </div>
          </div>
          {detailRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>내역이 없어요</div>
          ) : (
            detailRows.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)', fontSize: 11 }}>
                <span style={{ color: SUB, width: 72, flexShrink: 0 }}>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                {trackBadge(r.track)}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.brand_name}</div>
                  <div style={{ color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.owner_name} · {r.products}</div>
                </span>
                <span style={{ color: r.cancelled ? SUB : (r.track === 'A' ? GOLD : PURPLE), flexShrink: 0 }}>
                  {r.cancelled ? '-' : ''}₩{r.amount.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
