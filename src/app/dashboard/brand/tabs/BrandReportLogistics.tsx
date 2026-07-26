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
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface LogRow {
  id: string
  brand_id: string
  type: string
  qty: number
  before_qty: number
  after_qty: number
  ref_type: string
  staff_name: string | null
  memo: string | null
  created_at: string
  hq_status: string
  brand_inventory: { product_name: string } | null
}
interface Props { companyBrandIds: string[]; brandNames: Record<string, string> }
export default function BrandReportLogistics({ companyBrandIds, brandNames }: Props) {
  const supabase = createClient()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out' | 'emergency'>('all')
  const loadData = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const [ym1, ym2] = yearMonth.split('-').map(Number)
    const startDate = new Date(ym1, ym2-1, 1).toISOString()
    const endDate = new Date(ym1, ym2, 1).toISOString()
    const { data } = await supabase
      .from('brand_stock_logs')
      .select('id, brand_id, type, qty, before_qty, after_qty, ref_type, staff_name, memo, created_at, hq_status, brand_inventory(product_name)')
      .in('brand_id', companyBrandIds)
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs((data || []) as unknown as LogRow[])
    setLoading(false)
  }, [companyBrandIds, yearMonth])
  useEffect(() => { void loadData() }, [loadData])
  const filtered = typeFilter === 'all' ? logs
    : typeFilter === 'emergency' ? logs.filter(l => l.ref_type === 'emergency')
    : logs.filter(l => l.type === typeFilter)
  const totalIn = logs.filter(l => l.type === 'in' || l.type === 'lot_in').reduce((s, l) => s + l.qty, 0)
  const totalOut = logs.filter(l => l.type === 'out').reduce((s, l) => s + l.qty, 0)
  const emergencyCount = logs.filter(l => l.ref_type === 'emergency').length
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' as const }}>
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 12, color: TEXT, outline: 'none' }} />
        <button type="button" onClick={() => void loadData()}
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', cursor: 'pointer' }}>
          새로고침
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '총 입고', val: totalIn + '개', color: GREEN },
          { label: '총 출고', val: totalOut + '개', color: DANGER },
          { label: '비상 출고', val: emergencyCount + '건', color: emergencyCount > 0 ? DANGER : SUB },
        ].map(k => (
          <div key={k.label} style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10, textAlign: 'center' as const }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: k.color, marginBottom: 2 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12 }}>
          {(['all','in','out','emergency'] as const).map(f => (
            <button key={f} type="button" onClick={() => setTypeFilter(f)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${typeFilter === f ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: typeFilter === f ? 'rgba(123,94,167,0.2)' : 'transparent', color: typeFilter === f ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
              {f === 'all' ? '전체' : f === 'in' ? '입고' : f === 'out' ? '출고' : '비상출고'}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 12 }}>이달 이력이 없어요</div>
        ) : filtered.map((log, i) => {
          const isIn = log.type === 'in' || log.type === 'lot_in'
          const isEmergency = log.ref_type === 'emergency'
          return (
            <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 0', borderBottom: i < filtered.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{isIn ? '⬇️' : isEmergency ? '🚨' : '⬆️'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' as const }}>
                  <BrandNameBadge name={brandNames[log.brand_id]} />
                  <span style={{ fontSize: 12, color: TEXT }}>{log.brand_inventory?.product_name}</span>
                  {isEmergency && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(229,57,53,0.1)', color: DANGER }}>비상</span>}
                  {log.hq_status === 'disputed' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(201,169,110,0.1)', color: '#C9A96E' }}>이의제기</span>}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {log.memo || '-'} · {log.staff_name || '-'}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>{timeAgo(log.created_at)}</div>
              </div>
              <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: isIn ? GREEN : DANGER }}>{isIn ? '+' : '-'}{log.qty}개</div>
                <div style={{ fontSize: 10, color: SUB }}>{log.before_qty}→{log.after_qty}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
