'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
import { calcPouchTier } from '@/lib/brand/brandBilling'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GREEN = 'rgba(76,175,80,0.8)'
const TIERS = [200, 300, 500] as const
type Tier = (typeof TIERS)[number]
const TIER_COLOR: Record<Tier, string> = {
  200: 'rgba(100,181,246,0.85)',
  300: GOLD,
  500: 'rgba(229,115,115,0.9)',
}
const HQ_PAID_STATUSES = ['결제완료', '배송완료', '구매확정']
type KitRow = {
  id: string
  company_id: string
  tier: number
  product_id: string
  qty: number
  product_name?: string
}
type SampleProduct = { id: string; name: string }
type PouchRow = {
  id: string
  track: 'A' | 'B'
  owner_id: string
  billing_month: string
  total_amount: number
  pouch_tier: number | null
  pouch_status: string | null
}
type OwnerInfo = { name: string; salon: string }
type DraftLine = { product_id: string; qty: number }
type Props = {
  myBrands: { id: string; name: string }[]
  brandId: string | null
}
function monthLabel(ym: string) {
  return String(ym || '').slice(0, 7) || '-'
}
function pouchStatusMeta(status: string | null) {
  if (status === 'shipped') return { label: '발송완료', color: GREEN }
  if (status === 'approved') return { label: '승인됨', color: 'rgba(100,181,246,0.85)' }
  return { label: '승인대기', color: 'rgba(255,193,7,0.85)' }
}
function currentMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 1)
  const billingMonth = `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { startIso: start.toISOString(), endIso: end.toISOString(), billingMonth }
}
export default function BrandTabPouch({ myBrands: _myBrands, brandId }: Props) {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const [kits, setKits] = useState<KitRow[]>([])
  const [sampleProducts, setSampleProducts] = useState<SampleProduct[]>([])
  const [rows, setRows] = useState<PouchRow[]>([])
  const [owners, setOwners] = useState<Record<string, OwnerInfo>>({})
  const [months, setMonths] = useState<string[]>([])
  const [monthFilter, setMonthFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [editTier, setEditTier] = useState<Tier | null>(null)
  const [draftLines, setDraftLines] = useState<DraftLine[]>([])
  const [savingKit, setSavingKit] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [approving, setApproving] = useState(false)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  useEffect(() => {
    if (!brandId) {
      setCompanyId(null)
      setCompanyBrandIds([])
      return
    }
    let cancelled = false
    void (async () => {
      const [{ data }, ids] = await Promise.all([
        supabase.from('brands').select('company_id').eq('id', brandId).maybeSingle(),
        resolveCompanyBrandIds(supabase, brandId),
      ])
      if (cancelled) return
      setCompanyId(data?.company_id ? String(data.company_id) : null)
      setCompanyBrandIds(ids)
    })()
    return () => { cancelled = true }
  }, [brandId, supabase])
  const loadKitsAndProducts = useCallback(async () => {
    if (!companyId || !companyBrandIds.length) {
      setKits([])
      setSampleProducts([])
      return
    }
    const [{ data: kitData }, { data: prodData }] = await Promise.all([
      supabase
        .from('pouch_tier_kits')
        .select('id, company_id, tier, product_id, qty')
        .eq('company_id', companyId)
        .order('tier')
        .order('created_at'),
      supabase
        .from('brand_products')
        .select('id, name')
        .in('brand_id', companyBrandIds)
        .eq('is_sample_pouch', true)
        .order('name'),
    ])
    const products = (prodData || []) as SampleProduct[]
    const nameById: Record<string, string> = {}
    for (const p of products) nameById[p.id] = p.name
    setKits(((kitData || []) as KitRow[]).map((k) => ({
      ...k,
      product_name: nameById[k.product_id] || '(삭제된 제품)',
    })))
    setSampleProducts(products)
  }, [companyId, companyBrandIds, supabase])
  const aggregateTrackB = useCallback(async () => {
    if (!companyId) return
    const { startIso, endIso, billingMonth } = currentMonthRange()
    const { data: orderRows } = await supabase
      .from('hq_stock_orders')
      .select('profile_id, final_amount, status, ordered_at')
      .eq('company_id', companyId)
      .in('status', HQ_PAID_STATUSES)
      .gte('ordered_at', startIso)
      .lt('ordered_at', endIso)
    const sums: Record<string, number> = {}
    for (const r of (orderRows || []) as { profile_id?: string; final_amount?: number }[]) {
      const pid = r.profile_id ? String(r.profile_id) : ''
      if (!pid) continue
      sums[pid] = (sums[pid] || 0) + Math.trunc(Number(r.final_amount) || 0)
    }
    for (const [profileId, total] of Object.entries(sums)) {
      const tier = calcPouchTier(total)
      if (!tier) continue
      const { data: existing } = await supabase
        .from('hq_pouch_records')
        .select('id, pouch_status')
        .eq('company_id', companyId)
        .eq('owner_id', profileId)
        .eq('billing_month', billingMonth)
        .maybeSingle()
      if (existing?.pouch_status) continue
      if (existing?.id) {
        await supabase
          .from('hq_pouch_records')
          .update({ total_amount: total, pouch_tier: tier, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase.from('hq_pouch_records').insert({
          company_id: companyId,
          owner_id: profileId,
          billing_month: billingMonth,
          total_amount: total,
          pouch_tier: tier,
        })
      }
    }
  }, [companyId, supabase])
  const loadRows = useCallback(async () => {
    if (!companyId) {
      setRows([])
      setOwners({})
      setMonths([])
      return
    }
    const [{ data: invData }, { data: hqData }] = await Promise.all([
      supabase
        .from('brand_billing_invoices')
        .select('id, owner_id, billing_month, total_amount, pouch_tier, pouch_status, status')
        .eq('company_id', companyId)
        .eq('status', 'paid')
        .not('pouch_tier', 'is', null)
        .order('billing_month', { ascending: false }),
      supabase
        .from('hq_pouch_records')
        .select('id, owner_id, billing_month, total_amount, pouch_tier, pouch_status')
        .eq('company_id', companyId)
        .not('pouch_tier', 'is', null)
        .order('billing_month', { ascending: false }),
    ])
    const aRows: PouchRow[] = ((invData || []) as { id: string; owner_id: string; billing_month: string; total_amount: number; pouch_tier: number | null; pouch_status: string | null }[])
      .map((r) => ({ ...r, track: 'A' as const }))
    const bRows: PouchRow[] = ((hqData || []) as { id: string; owner_id: string; billing_month: string; total_amount: number; pouch_tier: number | null; pouch_status: string | null }[])
      .map((r) => ({ ...r, track: 'B' as const }))
    const merged = [...aRows, ...bRows]
    setRows(merged)
    const monthSet = Array.from(new Set(merged.map((r) => String(r.billing_month).slice(0, 10))))
    setMonths(monthSet)
    setMonthFilter((prev) => (prev && monthSet.includes(prev) ? prev : (monthSet[0] || '')))
    const ownerIds = Array.from(new Set(merged.map((r) => r.owner_id).filter(Boolean)))
    if (!ownerIds.length) {
      setOwners({})
      return
    }
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, owner_store_name')
      .in('id', ownerIds)
    const map: Record<string, OwnerInfo> = {}
    for (const p of profiles || []) {
      const id = String((p as { id: string }).id)
      map[id] = {
        name: String((p as { full_name?: string | null }).full_name || '원장님'),
        salon: String((p as { owner_store_name?: string | null }).owner_store_name || '-'),
      }
    }
    setOwners(map)
  }, [companyId, supabase])
  const fetchAll = useCallback(async () => {
    setLoading(true)
    await aggregateTrackB()
    await Promise.all([loadKitsAndProducts(), loadRows()])
    setLoading(false)
  }, [aggregateTrackB, loadKitsAndProducts, loadRows])
  useEffect(() => { void fetchAll() }, [fetchAll])
  const kitsByTier = useMemo(() => {
    const map: Record<Tier, KitRow[]> = { 200: [], 300: [], 500: [] }
    for (const k of kits) {
      if (k.tier === 200 || k.tier === 300 || k.tier === 500) map[k.tier as Tier].push(k)
    }
    return map
  }, [kits])
  const filteredRows = useMemo(() => {
    if (!monthFilter) return rows
    return rows.filter((r) => String(r.billing_month).slice(0, 10) === monthFilter)
  }, [rows, monthFilter])
  const pendingRows = useMemo(
    () => filteredRows.filter((r) => !r.pouch_status),
    [filteredRows],
  )
  const openEdit = (tier: Tier) => {
    const lines = kitsByTier[tier].map((k) => ({ product_id: k.product_id, qty: k.qty }))
    setDraftLines(lines.length ? lines : [{ product_id: '', qty: 1 }])
    setEditTier(tier)
  }
  const saveKit = async () => {
    if (!companyId || !editTier) return
    setSavingKit(true)
    const cleaned = draftLines
      .map((l) => ({ product_id: l.product_id.trim(), qty: Math.trunc(Number(l.qty) || 0) }))
      .filter((l) => l.product_id && l.qty > 0)
    const seen = new Set<string>()
    const uniq: DraftLine[] = []
    for (const l of cleaned) {
      if (seen.has(l.product_id)) continue
      seen.add(l.product_id)
      uniq.push(l)
    }
    const existing = kitsByTier[editTier]
    const keepIds = new Set(uniq.map((l) => l.product_id))
    for (const row of existing) {
      if (!keepIds.has(row.product_id)) {
        const { error } = await supabase.from('pouch_tier_kits').delete().eq('id', row.id)
        if (error) {
          showToast('구성 삭제 실패: ' + error.message)
          setSavingKit(false)
          return
        }
      }
    }
    for (const line of uniq) {
      const { error } = await supabase.from('pouch_tier_kits').upsert(
        {
          company_id: companyId,
          tier: editTier,
          product_id: line.product_id,
          qty: line.qty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,tier,product_id' },
      )
      if (error) {
        showToast('구성 저장 실패: ' + error.message)
        setSavingKit(false)
        return
      }
    }
    showToast(`${editTier}만 파우치 구성 저장됨`)
    setEditTier(null)
    setSavingKit(false)
    await loadKitsAndProducts()
  }
  const buildSnapshotForTier = (tier: number) => {
    return kits
      .filter((k) => k.tier === tier)
      .map((k) => ({
        product_id: k.product_id,
        name: k.product_name || '',
        qty: k.qty,
      }))
  }
  const approveRows = async (ids: string[]) => {
    if (!ids.length) {
      showToast('승인할 대상을 선택해주세요')
      return
    }
    setApproving(true)
    let ok = 0
    for (const id of ids) {
      const row = rows.find((r) => r.id === id)
      if (!row || row.pouch_status || !row.pouch_tier) continue
      const snapshot = buildSnapshotForTier(row.pouch_tier)
      if (!snapshot.length) {
        showToast(`${row.pouch_tier}만 구성이 비어 있어요. 먼저 구성을 저장하세요.`)
        setApproving(false)
        return
      }
      const table = row.track === 'A' ? 'brand_billing_invoices' : 'hq_pouch_records'
      const { error } = await supabase
        .from(table)
        .update({
          pouch_kit_snapshot: snapshot,
          pouch_status: 'approved',
        })
        .eq('id', id)
        .is('pouch_status', null)
      if (!error) ok += 1
    }
    showToast(ok > 0 ? `${ok}건 승인 완료` : '승인 실패')
    setSelectedIds([])
    setApproving(false)
    await loadRows()
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const toggleSelectAllPending = () => {
    const pendingIds = pendingRows.map((r) => r.id)
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id))
    setSelectedIds(allSelected ? [] : pendingIds)
  }
  if (!brandId) {
    return <div style={{ fontSize: 13, color: SUB, padding: 16 }}>브랜드를 선택해주세요</div>
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>
      )}
      <div style={{ fontSize: 13, color: TEXT, marginBottom: 8, fontWeight: 600 }}>등급별 파우치 구성</div>
      <div style={{ fontSize: 11, color: SUB, marginBottom: 12 }}>샘플파우치 제품만 구성에 넣을 수 있어요. 승인 시 이 구성이 스냅샷으로 고정됩니다. (트랙A·트랙B 공통 구성)</div>
      {loading ? (
        <div style={{ fontSize: 12, color: SUB, padding: 16 }}>불러오는 중…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
            {TIERS.map((tier) => (
              <div key={tier} style={CARD}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: TIER_COLOR[tier], fontWeight: 600 }}>{tier}만 파우치</span>
                  <button
                    type="button"
                    onClick={() => openEdit(tier)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'transparent', color: '#c4a7e7', cursor: 'pointer' }}
                  >
                    구성 수정
                  </button>
                </div>
                {kitsByTier[tier].length === 0 ? (
                  <div style={{ fontSize: 12, color: SUB }}>구성 없음</div>
                ) : (
                  kitsByTier[tier].map((k) => (
                    <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: TEXT, padding: '4px 0', borderBottom: `0.5px solid ${BORDER}` }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.product_name}</span>
                      <span style={{ color: SUB, flexShrink: 0 }}>×{k.qty}</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
          {editTier !== null && (
            <div style={{ ...CARD, border: `1px solid ${PURPLE}`, marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: GOLD, marginBottom: 10 }}>{editTier}만 구성 수정</div>
              {!sampleProducts.length && (
                <div style={{ fontSize: 12, color: 'rgba(229,115,115,0.9)', marginBottom: 8 }}>is_sample_pouch 체크된 제품이 없어요. 제품등록에서 먼저 표시해주세요.</div>
              )}
              {draftLines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select
                    value={line.product_id}
                    onChange={(e) => {
                      const v = e.target.value
                      setDraftLines((prev) => prev.map((l, i) => (i === idx ? { ...l, product_id: v } : l)))
                    }}
                    style={{ flex: 1, background: '#12101a', color: TEXT, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                  >
                    <option value="">제품 선택</option>
                    {sampleProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => {
                      const v = Math.max(1, Math.trunc(Number(e.target.value) || 1))
                      setDraftLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: v } : l)))
                    }}
                    style={{ width: 72, background: '#12101a', color: TEXT, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                  />
                  <button
                    type="button"
                    onClick={() => setDraftLines((prev) => prev.filter((_, i) => i !== idx))}
                    style={{ fontSize: 11, color: SUB, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDraftLines((prev) => [...prev, { product_id: '', qty: 1 }])}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: `0.5px solid ${BORDER}`, background: 'transparent', color: TEXT, cursor: 'pointer' }}
                >
                  + 제품 추가
                </button>
                <button
                  type="button"
                  disabled={savingKit}
                  onClick={() => void saveKit()}
                  style={{ fontSize: 12, padding: '6px 14px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: savingKit ? 'not-allowed' : 'pointer' }}
                >
                  {savingKit ? '저장 중…' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditTier(null)}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: `0.5px solid ${BORDER}`, background: 'transparent', color: SUB, cursor: 'pointer' }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>파우치 승인 대상</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                style={{ background: '#12101a', color: TEXT, border: `0.5px solid ${BORDER}`, borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
              >
                {months.length === 0 && <option value="">해당월 없음</option>}
                {months.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={approving || selectedIds.length === 0}
                onClick={() => void approveRows(selectedIds)}
                style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: selectedIds.length ? PURPLE : 'rgba(255,255,255,0.08)', color: '#fff', cursor: selectedIds.length && !approving ? 'pointer' : 'not-allowed' }}
              >
                {approving ? '승인 중…' : `선택승인 (${selectedIds.length})`}
              </button>
            </div>
          </div>
          <div style={CARD}>
            {filteredRows.length === 0 ? (
              <div style={{ fontSize: 12, color: SUB, textAlign: 'center', padding: 12 }}>이번 조건의 파우치 등급 대상이 없어요</div>
            ) : (
              <>
                {pendingRows.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: SUB, marginBottom: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={pendingRows.every((r) => selectedIds.includes(r.id)) && pendingRows.length > 0}
                      onChange={toggleSelectAllPending}
                      style={{ accentColor: PURPLE }}
                    />
                    승인대기 전체 선택
                  </label>
                )}
                {filteredRows.map((row) => {
                  const st = pouchStatusMeta(row.pouch_status)
                  const tier = (row.pouch_tier === 200 || row.pouch_tier === 300 || row.pouch_tier === 500) ? row.pouch_tier as Tier : null
                  const owner = owners[row.owner_id]
                  const waiting = !row.pouch_status
                  return (
                    <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: `0.5px solid ${BORDER}`, flexWrap: 'wrap' }}>
                      {waiting ? (
                        <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelect(row.id)} style={{ accentColor: PURPLE }} />
                      ) : (
                        <span style={{ width: 16 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: row.track === 'A' ? 'rgba(100,181,246,0.15)' : 'rgba(201,169,110,0.15)', color: row.track === 'A' ? '#64B5F6' : GOLD }}>트랙{row.track}</span>
                          <div style={{ fontSize: 13, color: TEXT }}>{owner?.name || '원장님'}</div>
                        </div>
                        <div style={{ fontSize: 11, color: SUB }}>{owner?.salon || '-'} · ₩{row.total_amount.toLocaleString()}</div>
                      </div>
                      {tier && (
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: TIER_COLOR[tier] }}>{tier}만</span>
                      )}
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: st.color }}>{st.label}</span>
                      {waiting && (
                        <button
                          type="button"
                          disabled={approving}
                          onClick={() => void approveRows([row.id])}
                          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', cursor: approving ? 'not-allowed' : 'pointer' }}
                        >
                          승인
                        </button>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
