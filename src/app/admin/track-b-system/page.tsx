'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const HQ_PAID = ['결제완료', '배송완료', '구매확정'] as const

type HqOrder = {
  id: string
  status: string
  final_amount: number
  ordered_at: string | null
  created_at: string
  owner_name: string | null
  salon_name: string | null
  brand_id: string
  profile_id: string
}

type LedgerRow = {
  id: string
  sponsor_owner_id: string
  buyer_owner_id: string
  brand_id: string
  commission_amount: number
  commission_rate: number
  status: string
  created_at: string
  paid_at: string | null
}

type SponsorAgg = {
  sponsor_owner_id: string
  name: string
  grade: string
  pending_amount: number
  paid_amount: number
  pending_count: number
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthStartIso() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function AdminTrackBSystemPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<HqOrder[]>([])
  const [ledgers, setLedgers] = useState<LedgerRow[]>([])
  const [sponsorAgg, setSponsorAgg] = useState<SponsorAgg[]>([])
  const [trend, setTrend] = useState<Array<{ label: string; amount: number }>>([])
  const [kpi, setKpi] = useState({ monthSales: 0, pendingCommission: 0, activeSponsors: 0, monthOrders: 0 })
  const [statusFilter, setStatusFilter] = useState<string>('전체')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setMsg('')
    const thisMonthIso = monthStartIso()
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - 29)
    const sinceIso = since.toISOString()

    const [{ data: orderRows }, { data: ledgerRows }, { data: trendRows }] = await Promise.all([
      supabase
        .from('hq_stock_orders')
        .select('id, status, final_amount, ordered_at, created_at, owner_name, salon_name, brand_id, profile_id')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('hq_commission_ledger')
        .select('id, sponsor_owner_id, buyer_owner_id, brand_id, commission_amount, commission_rate, status, created_at, paid_at')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('hq_stock_orders')
        .select('final_amount, ordered_at, created_at, status')
        .in('status', [...HQ_PAID])
        .gte('created_at', sinceIso),
    ])

    const ordersList = (orderRows || []) as HqOrder[]
    const ledgersList = (ledgerRows || []) as LedgerRow[]
    setOrders(ordersList)
    setLedgers(ledgersList)

    const monthSales = ordersList
      .filter((o) => {
        if (!HQ_PAID.includes(o.status as (typeof HQ_PAID)[number])) return false
        const ts = o.ordered_at || o.created_at
        return ts && ts >= thisMonthIso
      })
      .reduce((s, o) => s + Math.trunc(Number(o.final_amount) || 0), 0)

    const monthOrders = ordersList.filter((o) => {
      if (!HQ_PAID.includes(o.status as (typeof HQ_PAID)[number])) return false
      const ts = o.ordered_at || o.created_at
      return ts && ts >= thisMonthIso
    }).length

    const pendingCommission = ledgersList
      .filter((l) => l.status === 'pending')
      .reduce((s, l) => s + Math.trunc(Number(l.commission_amount) || 0), 0)

    const activeSponsors = new Set(
      ledgersList.filter((l) => l.status === 'pending' || l.status === 'paid').map((l) => l.sponsor_owner_id),
    ).size

    setKpi({ monthSales, pendingCommission, activeSponsors, monthOrders })

    const byDay: Record<string, number> = {}
    for (const o of trendRows || []) {
      const ts = (o as { ordered_at?: string; created_at?: string }).ordered_at
        || (o as { created_at?: string }).created_at
      if (!ts) continue
      const k = dayKey(ts)
      byDay[k] = (byDay[k] || 0) + Math.trunc(Number((o as { final_amount?: number }).final_amount) || 0)
    }
    const trendOut: Array<{ label: string; amount: number }> = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(since.getFullYear(), since.getMonth(), since.getDate() + i)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      trendOut.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, amount: byDay[k] || 0 })
    }
    setTrend(trendOut)

    const sponsorIds = Array.from(new Set(ledgersList.map((l) => l.sponsor_owner_id)))
    const nameById: Record<string, string> = {}
    const gradeByKey: Record<string, string> = {}
    if (sponsorIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', sponsorIds)
      for (const p of profiles || []) {
        nameById[String(p.id)] = String((p as { full_name?: string }).full_name || '스폰서')
      }
      const brandIds = Array.from(new Set(ledgersList.map((l) => l.brand_id)))
      const { data: grades } = await supabase
        .from('brand_owner_grades')
        .select('owner_id, brand_id, grade')
        .in('owner_id', sponsorIds)
        .in('brand_id', brandIds)
      for (const g of grades || []) {
        gradeByKey[`${g.owner_id}:${g.brand_id}`] = String(g.grade || '-')
      }
    }

    const aggMap: Record<string, SponsorAgg> = {}
    for (const l of ledgersList) {
      const key = l.sponsor_owner_id
      if (!aggMap[key]) {
        aggMap[key] = {
          sponsor_owner_id: key,
          name: nameById[key] || key.slice(0, 8),
          grade: gradeByKey[`${key}:${l.brand_id}`] || '-',
          pending_amount: 0,
          paid_amount: 0,
          pending_count: 0,
        }
      }
      const amt = Math.trunc(Number(l.commission_amount) || 0)
      if (l.status === 'pending') {
        aggMap[key].pending_amount += amt
        aggMap[key].pending_count += 1
      } else if (l.status === 'paid') {
        aggMap[key].paid_amount += amt
      }
      if (aggMap[key].grade === '-' && gradeByKey[`${key}:${l.brand_id}`]) {
        aggMap[key].grade = gradeByKey[`${key}:${l.brand_id}`]
      }
    }
    setSponsorAgg(Object.values(aggMap).sort((a, b) => b.pending_amount - a.pending_amount))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const filteredOrders = useMemo(() => {
    if (statusFilter === '전체') return orders
    return orders.filter((o) => o.status === statusFilter)
  }, [orders, statusFilter])

  const settleSponsor = async (sponsorOwnerId: string) => {
    setBusyId(sponsorOwnerId)
    setMsg('')
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('hq_commission_ledger')
      .update({ status: 'paid', paid_at: nowIso })
      .eq('sponsor_owner_id', sponsorOwnerId)
      .eq('status', 'pending')
    setBusyId(null)
    if (error) {
      setMsg(error.message)
      return
    }
    setMsg('정산 처리 완료 (장부 상태만 변경 · 실송금 없음)')
    await load()
  }

  const updateOrderStatus = async (id: string, status: string) => {
    setBusyId(id)
    setMsg('')
    const { error } = await supabase
      .from('hq_stock_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    setBusyId(null)
    if (error) {
      setMsg(error.message)
      return
    }
    await load()
  }

  const card = (label: string, value: string, sub?: string) => (
    <div style={{ background: '#111', border: '1px solid rgba(201,169,110,0.25)', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, color: GOLD, fontWeight: 600 }}>{value}</div>
      {sub ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{sub}</div> : null}
    </div>
  )

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 18, color: '#fff', margin: '0 0 6px' }}>트랙B 시스템</h1>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px' }}>
        HQ 재고발주 매출 · 스폰서 커미션 (실송금 없음 · 장부 정산만)
      </p>
      {msg ? <div style={{ marginBottom: 12, fontSize: 12, color: GOLD }}>{msg}</div> : null}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>불러오는 중…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {card('이번달 트랙B 매출', `₩${kpi.monthSales.toLocaleString()}`)}
            {card('정산대기 커미션', `₩${kpi.pendingCommission.toLocaleString()}`)}
            {card('활성 스폰서 수', `${kpi.activeSponsors}명`)}
            {card('이번달 발주건수', `${kpi.monthOrders}건`)}
          </div>

          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: '#fff', marginBottom: 10 }}>30일 매출 추이</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} width={56} />
                  <Tooltip
                    contentStyle={{ background: '#1a1520', border: `1px solid ${PURPLE}`, fontSize: 11 }}
                    formatter={(v: number) => [`₩${Number(v).toLocaleString()}`, '매출']}
                  />
                  <Line type="monotone" dataKey="amount" stroke={PURPLE} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: '#fff', marginBottom: 10 }}>스폰서 커미션</div>
            {sponsorAgg.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>커미션 내역 없음</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px' }}>스폰서</th>
                    <th style={{ padding: '6px 4px' }}>등급</th>
                    <th style={{ padding: '6px 4px' }}>대기</th>
                    <th style={{ padding: '6px 4px' }}>완료</th>
                    <th style={{ padding: '6px 4px' }} />
                  </tr>
                </thead>
                <tbody>
                  {sponsorAgg.map((s) => (
                    <tr key={s.sponsor_owner_id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '8px 4px', color: '#fff' }}>{s.name}</td>
                      <td style={{ padding: '8px 4px', color: PURPLE }}>{s.grade}</td>
                      <td style={{ padding: '8px 4px', color: GOLD }}>
                        ₩{s.pending_amount.toLocaleString()} ({s.pending_count})
                      </td>
                      <td style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.5)' }}>
                        ₩{s.paid_amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <button
                          type="button"
                          disabled={!s.pending_count || busyId === s.sponsor_owner_id}
                          onClick={() => void settleSponsor(s.sponsor_owner_id)}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: '1px solid rgba(201,169,110,0.4)',
                            background: s.pending_count ? 'rgba(201,169,110,0.15)' : 'transparent',
                            color: GOLD,
                            cursor: s.pending_count ? 'pointer' : 'default',
                            opacity: s.pending_count ? 1 : 0.4,
                          }}
                        >
                          정산 처리
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ledgers.length > 0 ? (
              <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                원장 건수 {ledgers.length} · pending {ledgers.filter((l) => l.status === 'pending').length}
              </div>
            ) : null}
          </div>

          <div style={{ background: '#111', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, color: '#fff', marginRight: 8 }}>최근 발주</div>
              {['전체', '결제대기', '결제완료', '배송완료', '구매확정', '취소'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  style={{
                    fontSize: 11,
                    padding: '3px 8px',
                    borderRadius: 999,
                    border: statusFilter === s ? `1px solid ${PURPLE}` : '1px solid rgba(255,255,255,0.12)',
                    background: statusFilter === s ? 'rgba(123,94,167,0.2)' : 'transparent',
                    color: statusFilter === s ? '#c4a8f0' : 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            {filteredOrders.length === 0 ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>발주 없음</div>
            ) : (
              filteredOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: 'rgba(255,255,255,0.4)', width: 78 }}>
                    {new Date(o.ordered_at || o.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <span style={{ color: '#fff', flex: 1, minWidth: 0 }}>
                    {o.owner_name || '원장'} {o.salon_name ? `· ${o.salon_name}` : ''}
                  </span>
                  <span style={{ color: GOLD }}>₩{Math.trunc(Number(o.final_amount) || 0).toLocaleString()}</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', width: 64 }}>{o.status}</span>
                  {o.status === '결제완료' ? (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => void updateOrderStatus(o.id, '배송완료')}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: `1px solid ${PURPLE}`,
                        background: 'rgba(123,94,167,0.15)',
                        color: '#c4a8f0',
                        cursor: 'pointer',
                      }}
                    >
                      배송완료
                    </button>
                  ) : null}
                  {o.status === '배송완료' ? (
                    <button
                      type="button"
                      disabled={busyId === o.id}
                      onClick={() => void updateOrderStatus(o.id, '구매확정')}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: '1px solid rgba(201,169,110,0.4)',
                        background: 'rgba(201,169,110,0.12)',
                        color: GOLD,
                        cursor: 'pointer',
                      }}
                    >
                      구매확정
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
