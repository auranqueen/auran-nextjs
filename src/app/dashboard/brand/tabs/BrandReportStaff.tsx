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
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface StaffStat {
  staff_name: string
  total_in: number
  total_out: number
  emergency: number
  mismatch: number
}
interface Props { companyBrandIds: string[]; brandNames: Record<string, string> }
export default function BrandReportStaff({ companyBrandIds, brandNames }: Props) {
  const supabase = createClient()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [stats, setStats] = useState<StaffStat[]>([])
  const [loading, setLoading] = useState(true)
  const [nightLogs, setNightLogs] = useState<Array<{ staff_name: string; created_at: string; qty: number; product: string; brand_id?: string }>>([])
  const loadData = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const [ym1, ym2] = yearMonth.split('-').map(Number)
    const startDate = new Date(ym1, ym2-1, 1).toISOString()
    const endDate = new Date(ym1, ym2, 1).toISOString()
    const { data: logs } = await supabase
      .from('brand_stock_logs')
      .select('type, qty, ref_type, hq_status, staff_name, created_at, brand_id, brand_inventory(product_name)')
      .in('brand_id', companyBrandIds)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
    const staffMap: Record<string, StaffStat> = {}
    const nights: typeof nightLogs = []
    for (const log of (logs || []) as Array<{ type: string; qty: number; ref_type: string; hq_status: string; staff_name: string | null; created_at: string; brand_id?: string; brand_inventory?: { product_name?: string } | null }>) {
      const name = log.staff_name || '알 수 없음'
      if (!staffMap[name]) staffMap[name] = { staff_name: name, total_in: 0, total_out: 0, emergency: 0, mismatch: 0 }
      if (log.type === 'in' || log.type === 'lot_in') staffMap[name].total_in += log.qty
      if (log.type === 'out') {
        staffMap[name].total_out += log.qty
        if (log.ref_type === 'emergency') staffMap[name].emergency++
        if (log.hq_status === 'disputed') staffMap[name].mismatch++
      }
      const hour = new Date(log.created_at).getHours()
      if (log.type === 'out' && (hour >= 22 || hour < 6)) {
        nights.push({ staff_name: name, created_at: log.created_at, qty: log.qty, product: log.brand_inventory?.product_name || '', brand_id: log.brand_id })
      }
    }
    setStats(Object.values(staffMap).sort((a, b) => (b.total_in + b.total_out) - (a.total_in + a.total_out)))
    setNightLogs(nights)
    setLoading(false)
  }, [companyBrandIds, yearMonth])
  useEffect(() => { void loadData() }, [loadData])
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  const maxTotal = Math.max(...stats.map(s => s.total_in + s.total_out), 1)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: TEXT, outline: 'none' }} />
        <button type="button" onClick={() => void loadData()}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', cursor: 'pointer' }}>
          새로고침
        </button>
      </div>
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>담당자별 처리량</div>
        {stats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 12 }}>이달 데이터가 없어요</div>
        ) : stats.map((s, i) => {
          const total = s.total_in + s.total_out
          const pct = Math.round(total / maxTotal * 100)
          const hasIssue = s.emergency > 0 || s.mismatch > 0
          return (
            <div key={s.staff_name} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < stats.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: hasIssue ? 'rgba(229,57,53,0.15)' : 'rgba(123,94,167,0.15)', border: `1px solid ${hasIssue ? 'rgba(229,57,53,0.3)' : 'rgba(123,94,167,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: hasIssue ? DANGER : '#c4a7e7', flexShrink: 0 }}>
                  {s.staff_name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, color: TEXT }}>{s.staff_name}</span>
                    {s.emergency > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(229,57,53,0.1)', color: DANGER }}>비상 {s.emergency}건</span>}
                    {s.mismatch > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(201,169,110,0.1)', color: GOLD }}>불일치 {s.mismatch}건</span>}
                  </div>
                  <div style={{ fontSize: 11, color: SUB }}>입고 {s.total_in}개 · 출고 {s.total_out}개</div>
                </div>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: hasIssue ? DANGER : PURPLE, borderRadius: 3 }} />
              </div>
            </div>
          )
        })}
      </div>
      {nightLogs.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: DANGER, marginBottom: 10 }}>⚠️ 야간 출고 감지 (22시~06시)</div>
          {nightLogs.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: i < nightLogs.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: TEXT }}>{n.staff_name} · {n.product}</span>
                  {n.brand_id && <BrandNameBadge name={brandNames[n.brand_id]} />}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>{new Date(n.created_at).toLocaleString('ko-KR')}</div>
              </div>
              <span style={{ fontSize: 12, color: DANGER, flexShrink: 0 }}>-{n.qty}개</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
