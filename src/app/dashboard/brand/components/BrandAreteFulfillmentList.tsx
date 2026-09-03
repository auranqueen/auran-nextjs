'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
const GREEN = 'rgba(61,184,100,0.9)'
const COURIERS = ['CJ대한통운', '한진', '로젠', '우체국', '롯데'] as const

type FilterTab = 'approved' | 'shipped'
type KitItem = { product_id?: string; name?: string; qty?: number }

type AreteInvoice = {
  id: string
  owner_id: string
  billing_month: string
  kit_snapshot: KitItem[] | null
  tracking_no: string | null
  courier: string | null
  shipped_at: string | null
  owner_name: string
  salon_name: string
}

type Props = {
  companyId: string | null
  filter: FilterTab
  onToast: (msg: string) => void
  onShipped?: () => void
  onPendingCount?: (count: number) => void
}

function monthKey(raw: string) {
  return String(raw || '').slice(0, 10)
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

export default function BrandAreteFulfillmentList({ companyId, filter, onToast, onShipped, onPendingCount }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<AreteInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, { courier: string; no: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const onPendingCountRef = useRef(onPendingCount)
  onPendingCountRef.current = onPendingCount

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!companyId) {
      setRows([])
      setLoading(false)
      onPendingCountRef.current?.(0)
      return
    }
    if (!opts?.silent) setLoading(true)
    let invQuery = supabase
      .from('brand_arete_invoices')
      .select('id, owner_id, billing_month, kit_snapshot, tracking_no, courier, shipped_at, ship_status')
      .eq('company_id', companyId)
      .eq('status', 'paid')
      .order('billing_month', { ascending: false })
    invQuery = filter === 'approved'
      ? invQuery.is('ship_status', null)
      : invQuery.eq('ship_status', 'shipped')

    const { data: invData } = await invQuery

    type RawRow = {
      id: string
      owner_id: string
      billing_month: string
      kit_snapshot: unknown
      tracking_no: string | null
      courier: string | null
      shipped_at: string | null
    }
    const list = (invData || []) as RawRow[]

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

    const months = Array.from(new Set(list.map((r) => monthKey(r.billing_month)).filter(Boolean)))
    const bundleMap: Record<string, KitItem[]> = {}
    if (filter === 'approved' && months.length) {
      const { data: bundles } = await supabase
        .from('brand_arete_monthly_bundles')
        .select('billing_month, items')
        .eq('company_id', companyId)
        .in('billing_month', months)
      for (const b of bundles || []) {
        const key = monthKey(String((b as { billing_month: string }).billing_month))
        bundleMap[key] = parseSnapshot((b as { items?: unknown }).items)
      }
    }

    setRows(list.map((r) => {
      const saved = parseSnapshot(r.kit_snapshot)
      const preview = bundleMap[monthKey(r.billing_month)] || []
      return {
        id: r.id,
        owner_id: r.owner_id,
        billing_month: r.billing_month,
        kit_snapshot: saved.length ? saved : preview,
        tracking_no: r.tracking_no,
        courier: r.courier,
        shipped_at: r.shipped_at,
        owner_name: nameMap[r.owner_id]?.name || '원장님',
        salon_name: nameMap[r.owner_id]?.salon || '-',
      }
    }))
    setLoading(false)
    onPendingCountRef.current?.(filter === 'approved' ? list.length : 0)
  }, [companyId, filter, supabase])

  useEffect(() => {
    void load()
    const id = setInterval(() => { void load({ silent: true }) }, 10000)
    return () => clearInterval(id)
  }, [load])

  const shipArete = async (inv: AreteInvoice) => {
    const input = trackingInputs[inv.id]
    if (!input?.courier || !input?.no.trim()) {
      onToast('택배사와 운송장 번호를 입력해주세요')
      return
    }
    if (!companyId) {
      onToast('company_id가 없어요')
      return
    }

    setBusyId(inv.id)
    const res = await fetch('/api/brand-arete/ship', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: inv.id,
        company_id: companyId,
        courier: input.courier,
        tracking_no: input.no.trim(),
      }),
    })
    const json = await res.json().catch(() => ({})) as { ok?: boolean; message?: string; error?: string }
    setBusyId(null)
    if (!res.ok || !json.ok) {
      onToast(json.message || json.error || '발송 실패')
      return
    }

    setTrackingInputs((prev) => {
      const n = { ...prev }
      delete n[inv.id]
      return n
    })
    onToast('아레테 월간번들 발송 완료!')
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
        {filter === 'approved' ? '아레테 발송 대기 없음' : '아레테 발송 이력 없음'}
      </div>
    )
  }

  return (
    <div>
      {rows.map((inv, i) => {
        const open = !!trackingInputs[inv.id]
        const kit = inv.kit_snapshot || []
        const monthLabel = monthKey(inv.billing_month).slice(0, 7)
        return (
          <div
            key={inv.id}
            style={{ padding: '12px 0', borderBottom: i < rows.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{inv.owner_name}</span>
                  <span style={{
                    fontSize: 10, padding: '1px 7px', borderRadius: 10,
                    background: 'rgba(201,169,110,0.15)', color: '#C9A96E',
                  }}>{monthLabel}</span>
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
                  {inv.shipped_at && (
                    <div style={{ color: SUB, marginTop: 2 }}>
                      {new Date(inv.shipped_at).toLocaleDateString('ko-KR')}
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
                {inv.courier || '-'} · {inv.tracking_no || '-'}
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
                  onClick={() => void shipArete(inv)}
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
