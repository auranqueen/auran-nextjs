'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
import BrandNameBadge from '../components/BrandNameBadge'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = '#4CAF50'
const DANGER = '#E53935'
const GOLD = '#C9A96E'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface CompareRow {
  product_name: string
  hq_approved: number
  logistics_out: number
  diff: number
  brand_ids: string[]
}
interface Props { companyBrandIds: string[]; brandNames: Record<string, string> }
export default function BrandReportCompare({ companyBrandIds, brandNames }: Props) {
  const supabase = createClient()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [rows, setRows] = useState<CompareRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [totalIn, setTotalIn] = useState(0)
  const [totalOut, setTotalOut] = useState(0)
  const [totalReturn, setTotalReturn] = useState(0)
  const [emergencyCount, setEmergencyCount] = useState(0)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadData = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const [ym1, ym2] = yearMonth.split('-').map(Number)
    const startDate = new Date(ym1, ym2-1, 1).toISOString()
    const endDate = new Date(ym1, ym2, 1).toISOString()
    const [{ data: orders }, { data: logs }] = await Promise.all([
      supabase.from('brand_orders')
        .select('items, status, brand_id')
        .in('brand_id', companyBrandIds)
        .eq('status', 'shipping')
        .gte('shipped_at', startDate)
        .lt('shipped_at', endDate),
      supabase.from('brand_stock_logs')
        .select('inventory_id, type, qty, ref_type, brand_id, brand_inventory(product_name)')
        .in('brand_id', companyBrandIds)
        .gte('created_at', startDate)
        .lt('created_at', endDate),
    ])
    const hqMap: Record<string, number> = {}
    const hqBrandMap: Record<string, Set<string>> = {}
    for (const order of (orders || []) as Array<{ brand_id?: string; items?: Array<{ name?: string; qty?: number }> }>) {
      const bid = order.brand_id
      for (const item of (Array.isArray(order.items) ? order.items : [])) {
        const name = item.name || ''
        hqMap[name] = (hqMap[name] || 0) + (item.qty || 0)
        if (bid) {
          if (!hqBrandMap[name]) hqBrandMap[name] = new Set()
          hqBrandMap[name].add(bid)
        }
      }
    }
    const logMap: Record<string, number> = {}
    const logBrandMap: Record<string, Set<string>> = {}
    let tin = 0, tout = 0, tret = 0, emg = 0
    for (const log of (logs || []) as Array<{ type: string; qty: number; ref_type: string; brand_id?: string; brand_inventory?: { product_name?: string } | null }>) {
      const name = log.brand_inventory?.product_name || ''
      if (name && log.brand_id) {
        if (!logBrandMap[name]) logBrandMap[name] = new Set()
        logBrandMap[name].add(log.brand_id)
      }
      if (log.type === 'out') {
        logMap[name] = (logMap[name] || 0) + log.qty
        tout += log.qty
        if (log.ref_type === 'emergency') emg++
      }
      if (log.type === 'in' || log.type === 'lot_in') tin += log.qty
      if (log.type === 'return_in') tret += log.qty
    }
    setTotalIn(tin); setTotalOut(tout); setTotalReturn(tret); setEmergencyCount(emg)
    const allNames = new Set([...Object.keys(hqMap), ...Object.keys(logMap)])
    const compareRows: CompareRow[] = Array.from(allNames).map(name => {
      const hqQty = hqMap[name] || 0
      const logQty = logMap[name] || 0
      const brandIds = Array.from(new Set([
        ...Array.from(hqBrandMap[name] || []),
        ...Array.from(logBrandMap[name] || []),
      ]))
      return { product_name: name, hq_approved: hqQty, logistics_out: logQty, diff: logQty - hqQty, brand_ids: brandIds }
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    setRows(compareRows)
    setLoading(false)
  }, [companyBrandIds, yearMonth])
  useEffect(() => { void loadData() }, [loadData])
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  const mismatchCount = rows.filter(r => r.diff !== 0).length
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const }}>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: TEXT, outline: 'none' }} />
        <button type="button" onClick={() => void loadData()}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', cursor: 'pointer' }}>
          새로고침
        </button>
        {mismatchCount > 0 && (
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'rgba(229,57,53,0.1)', color: DANGER }}>
            불일치 {mismatchCount}건
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '총 입고', val: totalIn + '개', color: GREEN },
          { label: '총 출고', val: totalOut + '개', color: DANGER },
          { label: '반품 수령', val: totalReturn + '개', color: GOLD },
          { label: '비상 출고', val: emergencyCount + '건', color: emergencyCount > 0 ? DANGER : SUB },
        ].map(k => (
          <div key={k.label} style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10, textAlign: 'center' as const }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: k.color, marginBottom: 2 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>본사 승인 vs 물류 출고 대조</div>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 12 }}>이달 데이터가 없어요</div>
        ) : rows.map((row, i) => {
          const isMatch = row.diff === 0
          const pct = row.hq_approved > 0 ? Math.min(100, Math.round(row.logistics_out / row.hq_approved * 100)) : 0
          return (
            <div key={row.product_name} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < rows.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{row.product_name}</span>
                  {row.brand_ids.map(id => <BrandNameBadge key={id} name={brandNames[id]} />)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: isMatch ? GREEN : DANGER, flexShrink: 0 }}>
                  {isMatch ? '✅ 일치' : `⚠️ ${row.diff > 0 ? '+' : ''}${row.diff}개`}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '6px 10px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: PURPLE }}>{row.hq_approved}개</div>
                  <div style={{ fontSize: 10, color: SUB }}>본사 승인</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '6px 10px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: isMatch ? GREEN : DANGER }}>{row.logistics_out}개</div>
                  <div style={{ fontSize: 10, color: SUB }}>물류 출고</div>
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: isMatch ? GREEN : DANGER, borderRadius: 2 }} />
              </div>
              {!isMatch && (
                <button type="button"
                  onClick={() => showToast(`${row.product_name} 불일치 — 담당자 소명 요청 발송!`)}
                  style={{ marginTop: 6, width: '100%', padding: '5px', borderRadius: 5, border: `0.5px solid rgba(229,57,53,0.3)`, background: 'rgba(229,57,53,0.08)', color: DANGER, fontSize: 11, cursor: 'pointer' }}>
                  담당자 소명 요청
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
