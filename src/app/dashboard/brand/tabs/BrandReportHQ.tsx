'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const GREEN = '#4CAF50'
const DANGER = '#E53935'
const GOLD = '#C9A96E'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface OrderRow {
  id: string
  owner_name: string | null
  salon_name: string | null
  grade: string | null
  status: string
  items: Array<{ name: string; qty: number }>
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
  created_at: string
}
interface ReturnRow {
  id: string
  type: string
  reason_code: string
  status: string
  qty: number
  created_at: string
  approved_by: string | null
}
interface Props { brandId: string | null }
export default function BrandReportHQ({ brandId }: Props) {
  const supabase = createClient()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [returns, setReturns] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'shipping' | 'done' | 'cancelled'>('all')
  const loadData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const [ym1, ym2] = yearMonth.split('-').map(Number)
    const startDate = new Date(ym1, ym2-1, 1).toISOString()
    const endDate = new Date(ym1, ym2, 1).toISOString()
    const [{ data: orderData }, { data: returnData }] = await Promise.all([
      supabase.from('brand_orders')
        .select('id, owner_name, salon_name, grade, status, items, courier, tracking_no, shipped_at, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false }),
      supabase.from('brand_returns')
        .select('id, type, reason_code, status, qty, created_at, approved_by')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lt('created_at', endDate)
        .order('created_at', { ascending: false }),
    ])
    setOrders((orderData || []) as OrderRow[])
    setReturns((returnData || []) as ReturnRow[])
    setLoading(false)
  }, [brandId, yearMonth])
  useEffect(() => { void loadData() }, [loadData])
  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    pending:   { label: '대기중', color: GOLD },
    approved:  { label: '승인됨', color: GREEN },
    shipping:  { label: '배송중', color: 'rgba(41,182,246,0.8)' },
    done:      { label: '완료', color: SUB },
    cancelled: { label: '취소', color: DANGER },
  }
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const totalQty = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0)
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: '총 발주', val: orders.length + '건', color: PURPLE },
          { label: '총 출고량', val: totalQty + '개', color: GREEN },
          { label: '반품 승인', val: returns.filter(r => r.status === 'approved' || r.status === 'done').length + '건', color: GOLD },
          { label: '취소', val: orders.filter(o => o.status === 'cancelled').length + '건', color: DANGER },
        ].map(k => (
          <div key={k.label} style={{ background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 10, textAlign: 'center' as const }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: k.color, marginBottom: 2 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: SUB }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={CARD}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 12 }}>
          {(['all','shipping','done','cancelled'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: `0.5px solid ${filter === f ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: filter === f ? 'rgba(123,94,167,0.2)' : 'transparent', color: filter === f ? '#c4a7e7' : SUB, cursor: 'pointer' }}>
              {f === 'all' ? '전체' : STATUS_MAP[f]?.label}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 12 }}>이달 발주가 없어요</div>
        ) : filtered.map((o, i) => {
          const st = STATUS_MAP[o.status] || { label: o.status, color: SUB }
          return (
            <div key={o.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: i < filtered.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{o.owner_name || '-'}</span>
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${st.color}18`, color: st.color }}>{st.label}</span>
                </div>
                <span style={{ fontSize: 11, color: SUB }}>{timeAgo(o.created_at)}</span>
              </div>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 2 }}>
                {o.salon_name} · {o.grade}
              </div>
              <div style={{ fontSize: 11, color: SUB, marginBottom: o.tracking_no ? 3 : 0 }}>
                {o.items.map(it => `${it.name} ${it.qty}ea`).join(' · ')}
              </div>
              {o.tracking_no && (
                <div style={{ fontSize: 11, color: 'rgba(41,182,246,0.7)' }}>
                  {o.courier} · {o.tracking_no}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {returns.length > 0 && (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>반품·교환 승인 이력</div>
          {returns.map((r, i) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: i < returns.length-1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: TEXT, marginBottom: 2 }}>{r.type === 'exchange' ? '교환' : '반품'} · {r.reason_code}</div>
                <div style={{ fontSize: 11, color: SUB }}>{r.qty}개 · 승인: {r.approved_by || '-'}</div>
              </div>
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: r.status === 'done' ? 'rgba(76,175,80,0.1)' : 'rgba(201,169,110,0.1)', color: r.status === 'done' ? GREEN : GOLD }}>
                {r.status === 'done' ? '완료' : '처리중'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
