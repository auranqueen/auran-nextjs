'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
import BrandNameBadge from '../components/BrandNameBadge'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const DANGER = '#E53935'
const GOLD = '#C9A96E'
const GREEN = '#4CAF50'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface MismatchRow {
  id: string
  product_name: string
  hq_approved: number
  logistics_out: number
  diff: number
  last_date: string
  brand_ids: string[]
}
interface EmergencyRow {
  id: string
  brand_id: string
  product_name: string
  qty: number
  staff_name: string
  memo: string | null
  hq_status: string
  created_at: string
}
interface Props { companyBrandIds: string[]; brandNames: Record<string, string> }
export default function BrandReportMismatch({ companyBrandIds, brandNames }: Props) {
  const supabase = createClient()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [mismatches, setMismatches] = useState<MismatchRow[]>([])
  const [emergencies, setEmergencies] = useState<EmergencyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadData = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const [ym1, ym2] = yearMonth.split('-').map(Number)
    const startDate = new Date(ym1, ym2-1, 1).toISOString()
    const endDate = new Date(ym1, ym2, 1).toISOString()
    const [{ data: orders }, { data: logs }] = await Promise.all([
      supabase.from('brand_orders').select('items, status, shipped_at, brand_id').in('brand_id', companyBrandIds).eq('status', 'shipping').gte('shipped_at', startDate).lt('shipped_at', endDate),
      supabase.from('brand_stock_logs').select('id, inventory_id, type, qty, ref_type, hq_status, staff_name, memo, created_at, brand_id, brand_inventory(product_name)').in('brand_id', companyBrandIds).gte('created_at', startDate).lt('created_at', endDate),
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
    const logMap: Record<string, { qty: number; last: string }> = {}
    const logBrandMap: Record<string, Set<string>> = {}
    const emgList: EmergencyRow[] = []
    for (const log of (logs || []) as Array<{ id: string; type: string; qty: number; ref_type: string; hq_status: string; staff_name: string | null; memo: string | null; created_at: string; brand_id?: string; brand_inventory?: { product_name?: string } | null }>) {
      const name = log.brand_inventory?.product_name || ''
      if (name && log.brand_id) {
        if (!logBrandMap[name]) logBrandMap[name] = new Set()
        logBrandMap[name].add(log.brand_id)
      }
      if (log.type === 'out') {
        if (!logMap[name]) logMap[name] = { qty: 0, last: log.created_at }
        logMap[name].qty += log.qty
        logMap[name].last = log.created_at
        if (log.ref_type === 'emergency') {
          emgList.push({ id: log.id, brand_id: log.brand_id || '', product_name: name, qty: log.qty, staff_name: log.staff_name || '-', memo: log.memo, hq_status: log.hq_status || 'pending', created_at: log.created_at })
        }
      }
    }
    const allNames = Array.from(new Set([...Object.keys(hqMap), ...Object.keys(logMap)]))
    const rows: MismatchRow[] = []
    for (const name of allNames) {
      const hq = hqMap[name] || 0
      const log = logMap[name]?.qty || 0
      if (hq !== log) {
        const brandIds = Array.from(new Set([
          ...Array.from(hqBrandMap[name] || []),
          ...Array.from(logBrandMap[name] || []),
        ]))
        rows.push({ id: name, product_name: name, hq_approved: hq, logistics_out: log, diff: log - hq, last_date: logMap[name]?.last || '', brand_ids: brandIds })
      }
    }
    setMismatches(rows.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)))
    setEmergencies(emgList)
    setLoading(false)
  }, [companyBrandIds, yearMonth])
  useEffect(() => { void loadData() }, [loadData])
  const requestExplain = (name: string) => showToast(`${name} 담당자 소명 요청 발송됨`)
  const timeAgo = (iso: string) => {
    if (!iso) return '-'
    const diff = Date.now() - new Date(iso).getTime()
    const d = Math.floor(diff / 86400000)
    if (d < 1) return '오늘'
    return `${d}일 전`
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: DANGER, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const }}>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: TEXT, outline: 'none' }} />
        <button type="button" onClick={() => void loadData()}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', cursor: 'pointer' }}>
          새로고침
        </button>
      </div>
      {mismatches.length === 0 && emergencies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: GREEN, fontSize: 14 }}>
          ✅ 이달 불일치 없음 · 모든 기록 일치
        </div>
      ) : (
        <>
          {mismatches.length > 0 && (
            <div style={CARD}>
              <div style={{ fontSize: 12, color: DANGER, marginBottom: 12 }}>⚠️ 수량 불일치 ({mismatches.length}건)</div>
              {mismatches.map((m, i) => (
                <div key={m.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < mismatches.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: TEXT }}>{m.product_name}</span>
                      {m.brand_ids.map(id => <BrandNameBadge key={id} name={brandNames[id]} />)}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: DANGER, flexShrink: 0 }}>{m.diff > 0 ? '+' : ''}{m.diff}개 차이</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '6px 10px', textAlign: 'center' as const }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: PURPLE }}>{m.hq_approved}개</div>
                      <div style={{ fontSize: 10, color: SUB }}>본사 승인</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '6px 10px', textAlign: 'center' as const }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: DANGER }}>{m.logistics_out}개</div>
                      <div style={{ fontSize: 10, color: SUB }}>물류 출고</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: SUB }}>마지막 출고: {timeAgo(m.last_date)}</span>
                    <button type="button" onClick={() => requestExplain(m.product_name)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: `0.5px solid rgba(229,57,53,0.3)`, background: 'rgba(229,57,53,0.08)', color: DANGER, cursor: 'pointer' }}>
                      소명 요청
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {emergencies.length > 0 && (
            <div style={CARD}>
              <div style={{ fontSize: 12, color: GOLD, marginBottom: 10 }}>🚨 비상 출고 미확인 ({emergencies.filter(e => e.hq_status === 'pending').length}건)</div>
              {emergencies.map((e, i) => {
                const isPending = e.hq_status === 'pending'
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: i < emergencies.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' as const }}>
                        <BrandNameBadge name={brandNames[e.brand_id]} />
                        <span style={{ fontSize: 12, color: TEXT }}>{e.product_name}</span>
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: isPending ? 'rgba(201,169,110,0.1)' : 'rgba(76,175,80,0.1)', color: isPending ? GOLD : GREEN }}>
                          {isPending ? '확인대기' : e.hq_status === 'confirmed' ? '확인완료' : '이의제기'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: SUB }}>담당: {e.staff_name} · {e.memo || '-'}</div>
                      <div style={{ fontSize: 11, color: SUB }}>{timeAgo(e.created_at)}</div>
                    </div>
                    <span style={{ fontSize: 12, color: DANGER, flexShrink: 0 }}>-{e.qty}개</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>자동 감지 규칙</div>
        {[
          { rule: '본사 승인 수량 ≠ 물류 출고 수량', action: '즉시 감지', color: DANGER },
          { rule: '비상 출고 본사 미확인 2시간 초과', action: '재알림', color: GOLD },
          { rule: '야간(22~06시) 출고 발생', action: '경고', color: GOLD },
          { rule: '폐기 본사 미승인 시도', action: '차단 + 알림', color: DANGER },
          { rule: '동일 담당자 연속 불일치 3회', action: '계정 잠금', color: DANGER },
        ].map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 4 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <span style={{ fontSize: 12, color: TEXT }}>{r.rule}</span>
            <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: `${r.color}15`, color: r.color }}>{r.action}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
