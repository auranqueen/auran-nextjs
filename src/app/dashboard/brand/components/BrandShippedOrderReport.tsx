'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

type PeriodKey = 'today' | 'thisMonth' | 'lastMonth' | 'custom'

type ReportRow = {
  id: string
  order_no: string
  owner_name: string
  salon_name: string
  status: string
  total_amount: number
  shipped_at: string
  brandLines: Array<{ brand_name: string; summary: string }>
}

interface Props {
  companyId: string
  hubBrandId: string
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function periodRange(key: PeriodKey, customStart: string, customEnd: string): { startIso: string; endIso: string; label: string } {
  const now = new Date()
  if (key === 'today') {
    const start = startOfLocalDay(now)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
    return {
      startIso: start.toISOString(),
      endIso: end.toISOString(),
      label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    }
  }
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
  const s = customStart ? startOfLocalDay(new Date(customStart)) : startOfLocalDay(now)
  const e = customEnd ? startOfLocalDay(new Date(customEnd)) : startOfLocalDay(now)
  const endExclusive = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1)
  return {
    startIso: s.toISOString(),
    endIso: endExclusive.toISOString(),
    label: `${customStart || '?'}~${customEnd || '?'}`,
  }
}

function formatItemLine(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return '-'
  return items
    .map((it: { name?: string; qty?: number }) => `${it?.name || '?'} ${Math.trunc(Number(it?.qty) || 0)}ea`)
    .join(' · ')
}

function brandNameFromJoin(brands: unknown): string {
  if (!brands) return '브랜드'
  if (Array.isArray(brands)) {
    const first = brands[0] as { name?: string } | undefined
    return first?.name || '브랜드'
  }
  return (brands as { name?: string }).name || '브랜드'
}

function downloadCsv(rows: ReportRow[], filename: string) {
  const header = ['발송일', '주문번호', '샵', '원장', '브랜드상품요약', '합계', '상태']
  const lines = rows.map((r) => {
    const brandSummary = r.brandLines.map((b) => `${b.brand_name}: ${b.summary}`).join(' / ')
    return [
      new Date(r.shipped_at).toLocaleDateString('ko-KR'),
      r.order_no,
      r.salon_name,
      r.owner_name,
      brandSummary.replace(/"/g, '""'),
      String(r.total_amount),
      r.status,
    ].map((c) => `"${c}"`).join(',')
  })
  const bom = '\uFEFF'
  const blob = new Blob([bom + [header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function openStatementLinks(rows: ReportRow[]) {
  const links = rows
    .map((r) => `<li><a href="/dashboard/brand/print/order-batch/${r.id}" target="_blank" rel="noopener noreferrer">${r.order_no || r.id} — ${r.salon_name || '-'} / ${r.owner_name || '-'}</a></li>`)
    .join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>명세서 링크</title>
<style>body{font-family:sans-serif;padding:24px;background:#111;color:#eee}a{color:#C9A96E}li{margin:8px 0}</style></head>
<body><h1>명세서 링크 (${rows.length})</h1><ul>${links || '<li>없음</li>'}</ul></body></html>`
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
  }
}

export default function BrandShippedOrderReport({ companyId, hubBrandId }: Props) {
  const supabase = createClient()
  const [period, setPeriod] = useState<PeriodKey>('thisMonth')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [shopQuery, setShopQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<ReportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const periodMeta = useMemo(
    () => periodRange(period, customStart, customEnd),
    [period, customStart, customEnd],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!companyId) return
      setLoading(true)
      setError(null)
      try {
        const { data: brandRows } = await supabase
          .from('brands')
          .select('id')
          .eq('company_id', companyId)
        let brandIds = (brandRows || []).map((b: { id: string }) => String(b.id))
        if (brandIds.length === 0 && hubBrandId) brandIds = [hubBrandId]
        if (brandIds.length === 0) {
          if (!cancelled) setRows([])
          return
        }

        const { data: orderRows, error: orderErr } = await supabase
          .from('brand_orders')
          .select('id, batch_id, brand_id, items, promo_applied, total_amount, shipped_at, brands(name)')
          .in('brand_id', brandIds)
          .not('batch_id', 'is', null)
          .not('shipped_at', 'is', null)
          .gte('shipped_at', periodMeta.startIso)
          .lt('shipped_at', periodMeta.endIso)
          .limit(2000)

        if (orderErr) throw orderErr
        const orders = orderRows || []
        const batchIds = Array.from(new Set(orders.map((o: { batch_id: string }) => String(o.batch_id)).filter(Boolean)))
        if (batchIds.length === 0) {
          if (!cancelled) setRows([])
          return
        }

        const { data: batches, error: batchErr } = await supabase
          .from('brand_order_batches')
          .select('id, order_no, owner_name, salon_name, total_amount, status, created_at, approved_at')
          .in('id', batchIds)
          .in('status', ['배송중', '배송완료'])

        if (batchErr) throw batchErr

        const ordersByBatch = new Map<string, typeof orders>()
        for (const o of orders) {
          const bid = String((o as { batch_id: string }).batch_id)
          if (!ordersByBatch.has(bid)) ordersByBatch.set(bid, [])
          ordersByBatch.get(bid)!.push(o)
        }

        const built: ReportRow[] = (batches || []).map((b: Record<string, unknown>) => {
          const id = String(b.id)
          const batchOrders = ordersByBatch.get(id) || []
          let shippedAt = ''
          for (const o of batchOrders) {
            const s = String((o as { shipped_at?: string }).shipped_at || '')
            if (s && (!shippedAt || s > shippedAt)) shippedAt = s
          }
          const byBrand = new Map<string, string[]>()
          for (const o of batchOrders) {
            const name = brandNameFromJoin((o as { brands?: unknown }).brands)
            const line = formatItemLine((o as { items?: unknown }).items)
            if (!byBrand.has(name)) byBrand.set(name, [])
            byBrand.get(name)!.push(line)
          }
          const brandLines = Array.from(byBrand.entries()).map(([brand_name, summaries]) => ({
            brand_name,
            summary: summaries.filter((s) => s && s !== '-').join(' · ') || '-',
          }))
          return {
            id,
            order_no: String(b.order_no || ''),
            owner_name: String(b.owner_name || ''),
            salon_name: String(b.salon_name || ''),
            status: String(b.status || ''),
            total_amount: Math.trunc(Number(b.total_amount) || 0),
            shipped_at: shippedAt || String(b.approved_at || b.created_at || ''),
            brandLines,
          }
        })

        built.sort((a, b) => (a.shipped_at < b.shipped_at ? 1 : a.shipped_at > b.shipped_at ? -1 : 0))
        if (!cancelled) setRows(built)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '불러오기 실패'
        if (!cancelled) {
          setError(msg)
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [companyId, hubBrandId, periodMeta.startIso, periodMeta.endIso, supabase])

  const filtered = useMemo(() => {
    const q = shopQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      (r.salon_name || '').toLowerCase().includes(q) ||
      (r.owner_name || '').toLowerCase().includes(q),
    )
  }, [rows, shopQuery])

  const periodBtn = (key: PeriodKey, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setPeriod(key)}
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
    <div>
      <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginBottom: 10 }}>발송완료 리포트</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {periodBtn('today', '오늘')}
        {periodBtn('thisMonth', '이번 달')}
        {periodBtn('lastMonth', '지난 달')}
        {periodBtn('custom', '직접 선택')}
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT }}
          />
          <span style={{ color: SUB, fontSize: 11, alignSelf: 'center' }}>~</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT }}
          />
        </div>
      )}

      <input
        type="text"
        value={shopQuery}
        onChange={(e) => setShopQuery(e.target.value)}
        placeholder="샵명·원장명 검색"
        style={{
          width: '100%', boxSizing: 'border-box', marginBottom: 10,
          fontSize: 12, padding: '8px 10px', borderRadius: 8,
          border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: TEXT,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: SUB }}>{loading ? '불러오는 중…' : `${filtered.length}건`}{' · '}{periodMeta.label}</span>
        <button
          type="button"
          disabled={filtered.length === 0}
          onClick={() => downloadCsv(filtered, `발송완료 리포트_${periodMeta.label}.csv`)}
          style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: filtered.length ? 'pointer' : 'default',
            border: `0.5px solid ${GOLD}`, background: 'rgba(201,169,110,0.12)', color: GOLD, opacity: filtered.length ? 1 : 0.4,
          }}
        >
          CSV 다운로드
        </button>
        <button
          type="button"
          disabled={filtered.length === 0}
          onClick={() => openStatementLinks(filtered)}
          style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 6, cursor: filtered.length ? 'pointer' : 'default',
            border: '0.5px solid rgba(123,94,167,0.5)', background: 'rgba(123,94,167,0.12)', color: '#c4a7e7', opacity: filtered.length ? 1 : 0.4,
          }}
        >
          명세서 링크 열기
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#e57373', marginBottom: 8 }}>{error}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ fontSize: 12, color: SUB, padding: '12px 0' }}>발송완료 주문이 없습니다</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((r) => {
          const open = previewId === r.id
          return (
            <div key={r.id} style={{ ...CARD, marginBottom: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>
                    {r.shipped_at ? new Date(r.shipped_at).toLocaleString('ko-KR') : '-'}
                    <span style={{ margin: '0 6px', opacity: 0.5 }}>|</span>
                    <span style={{ color: GOLD }}>{r.order_no || r.id.slice(0, 8)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: TEXT, marginBottom: 6 }}>
                    {r.salon_name || '-'}{' · '}{r.owner_name || '-'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {r.brandLines.map((bl, i) => (
                      <div key={i} style={{ fontSize: 11, color: SUB }}>
                        <span style={{ color: '#c4a7e7' }}>{bl.brand_name}</span>: {bl.summary}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, color: GOLD, fontWeight: 600, marginBottom: 6 }}>
                    {r.total_amount.toLocaleString('ko-KR')}원
                  </div>
                  <span style={{
                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                    background: r.status === '배송완료' ? 'rgba(76,175,80,0.15)' : 'rgba(123,94,167,0.18)',
                    color: r.status === '배송완료' ? 'rgba(76,175,80,0.9)' : '#c4a7e7',
                  }}>
                    {r.status}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setPreviewId(open ? null : r.id)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: '0.5px solid rgba(255,255,255,0.12)', background: open ? 'rgba(123,94,167,0.2)' : 'transparent',
                    color: open ? '#c4a7e7' : SUB,
                  }}
                >
                  미리보기 {open ? '닫기' : ''}
                </button>
                <a
                  href={`/dashboard/brand/print/order-batch/${r.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: GOLD, textDecoration: 'none' }}
                >
                  새창에서 명세서
                </a>
              </div>
              {open && (
                <div style={{ marginTop: 10 }}>
                  <iframe
                    title={`명세서 링크-${r.order_no || r.id}`}
                    src={`/dashboard/brand/print/order-batch/${r.id}`}
                    style={{ width: '100%', height: 420, border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, background: '#fff' }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
