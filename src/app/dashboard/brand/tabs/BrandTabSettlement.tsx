'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { expandOrderItemsToLines, monthBillingRange } from '@/lib/brand/brandBilling'

const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const CARD = {
  background: '#1a1520',
  border: '0.5px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: 14,
  marginBottom: 10,
} as const

type StatusFilter = 'all' | 'unpaid' | 'paid'

type InvoiceRow = {
  id: string
  owner_id: string
  billing_month: string
  total_amount: number
  status: 'unpaid' | 'paid'
  paid_at: string | null
  points_total: number
}

type OrderRow = {
  id: string
  profile_id: string
  owner_name: string | null
  salon_name: string | null
  grade: string | null
  items: Array<{ name?: string; qty?: number; bonus?: number; unit_price?: number; line_amount?: number }> | null
  created_at: string
  total_amount: number | null
}

interface Props {
  brandId: string | null
  brandName: string
}

function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function prevYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatWon(n: number): string {
  return `₩${Math.trunc(n).toLocaleString()}`
}

function formatGrowth(current: number, prev: number): string {
  if (prev <= 0) return current > 0 ? '+100%' : '0%'
  const pct = ((current - prev) / prev) * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export default function BrandTabSettlement({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [ym, setYm] = useState(currentYm)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [prevMonthTotal, setPrevMonthTotal] = useState(0)
  const [ordersByOwner, setOrdersByOwner] = useState<Record<string, OrderRow[]>>({})
  const [salonNameFromOrders, setSalonNameFromOrders] = useState<Record<string, string>>({})
  const [ownerNameFromOrders, setOwnerNameFromOrders] = useState<Record<string, string>>({})
  const [storeNames, setStoreNames] = useState<Record<string, string>>({})
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }

  const resolveOwnerName = useCallback(
    (ownerId: string) =>
      salonNameFromOrders[ownerId]
      || storeNames[ownerId]
      || ownerNameFromOrders[ownerId]
      || profileNames[ownerId]
      || '원장님',
    [salonNameFromOrders, storeNames, ownerNameFromOrders, profileNames],
  )

  const resolveSubtitleLead = useCallback(
    (ownerId: string) => {
      // 제목이 매장명(salon_name 또는 owner_store_name)일 때만 부제에 담당자명
      if (salonNameFromOrders[ownerId] || storeNames[ownerId]) {
        return ownerNameFromOrders[ownerId] || profileNames[ownerId] || '-'
      }
      return '-'
    },
    [salonNameFromOrders, storeNames, ownerNameFromOrders, profileNames],
  )

  const load = useCallback(async () => {
    if (!brandId) {
      setInvoices([])
      setPrevMonthTotal(0)
      setOrdersByOwner({})
      setLoading(false)
      return
    }

    setLoading(true)
    const { billingMonth, startIso, endIso } = monthBillingRange(ym)
    const { billingMonth: prevBillingMonth } = monthBillingRange(prevYm(ym))

    const [invoiceRes, prevRes, orderRes] = await Promise.all([
      supabase
        .from('brand_billing_invoices')
        .select('id, owner_id, billing_month, total_amount, status, paid_at, points_total')
        .eq('brand_id', brandId)
        .eq('billing_month', billingMonth)
        .order('total_amount', { ascending: false }),
      supabase
        .from('brand_billing_invoices')
        .select('total_amount')
        .eq('brand_id', brandId)
        .eq('billing_month', prevBillingMonth),
      supabase
        .from('brand_orders')
        .select('id, profile_id, owner_name, salon_name, grade, items, created_at, total_amount')
        .eq('brand_id', brandId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: true }),
    ])

    if (invoiceRes.error) showToast('청구서를 불러오지 못했어요')
    if (orderRes.error) showToast('발주 내역을 불러오지 못했어요')

    const invoiceRows = (invoiceRes.data || []) as InvoiceRow[]
    const orderRows = (orderRes.data || []) as OrderRow[]

    const ownerIds = Array.from(new Set(invoiceRows.map((r) => r.owner_id)))
    const profileMap: Record<string, string> = {}
    const storeMap: Record<string, string> = {}
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, owner_store_name')
        .in('id', ownerIds)
      for (const p of profiles || []) {
        const id = (p as { id: string }).id
        profileMap[id] = String((p as { full_name?: string | null }).full_name || '')
        const store = String((p as { owner_store_name?: string | null }).owner_store_name || '').trim()
        if (store) storeMap[id] = store
      }
    }

    const salonFromOrders: Record<string, string> = {}
    const nameFromOrders: Record<string, string> = {}
    const grouped: Record<string, OrderRow[]> = {}
    for (const o of orderRows) {
      const pid = o.profile_id
      if (!pid) continue
      if (o.salon_name) salonFromOrders[pid] = o.salon_name
      if (o.owner_name) nameFromOrders[pid] = o.owner_name
      if (!grouped[pid]) grouped[pid] = []
      grouped[pid].push(o)
    }

    setInvoices(invoiceRows)
    setPrevMonthTotal(
      ((prevRes.data || []) as { total_amount: number }[]).reduce(
        (s, r) => s + Math.trunc(Number(r.total_amount) || 0),
        0,
      ),
    )
    setOrdersByOwner(grouped)
    setSalonNameFromOrders(salonFromOrders)
    setOwnerNameFromOrders(nameFromOrders)
    setStoreNames(storeMap)
    setProfileNames(profileMap)
    setExpandedOwnerId(null)
    setLoading(false)
  }, [brandId, supabase, ym])

  useEffect(() => {
    void load()
  }, [load])

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((inv) => {
        if (statusFilter === 'all') return true
        return inv.status === statusFilter
      }),
    [invoices, statusFilter],
  )

  const monthTotal = useMemo(
    () => filteredInvoices.reduce((s, r) => s + Math.trunc(Number(r.total_amount) || 0), 0),
    [filteredInvoices],
  )

  const allMonthTotal = useMemo(
    () => invoices.reduce((s, r) => s + Math.trunc(Number(r.total_amount) || 0), 0),
    [invoices],
  )

  const paidCount = useMemo(() => invoices.filter((i) => i.status === 'paid').length, [invoices])
  const unpaidCount = useMemo(() => invoices.filter((i) => i.status === 'unpaid').length, [invoices])

  const growthLabel = formatGrowth(
    statusFilter === 'all' ? allMonthTotal : monthTotal,
    prevMonthTotal,
  )
  const growthUp = (statusFilter === 'all' ? allMonthTotal : monthTotal) >= prevMonthTotal

  const toggleExpand = (ownerId: string) => {
    setExpandedOwnerId((prev) => (prev === ownerId ? null : ownerId))
  }

  if (!brandId) {
    return (
      <div style={{ ...CARD, textAlign: 'center', color: SUB, fontSize: 13 }}>
        브랜드를 선택해주세요
      </div>
    )
  }

  return (
    <div>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PURPLE,
            color: '#fff',
            fontSize: 12,
            padding: '7px 18px',
            borderRadius: 20,
            zIndex: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}

      <div style={CARD}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="month"
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 7,
              border: '0.5px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)',
              color: TEXT,
              fontSize: 13,
            }}
          />
          <span style={{ fontSize: 12, color: SUB }}>{brandName} · 월별 원장 결제 현황</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <div style={{ background: 'rgba(123,94,167,0.12)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>선택월 합계</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#c4a7e7' }}>{formatWon(monthTotal)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>전월 대비</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: growthUp ? 'rgba(76,175,80,0.9)' : 'rgba(232,85,85,0.9)' }}>
              {growthLabel}
            </div>
            <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>전월 {formatWon(prevMonthTotal)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>결제 현황</div>
            <div style={{ fontSize: 13, color: TEXT }}>
              완료 <span style={{ color: 'rgba(76,175,80,0.9)' }}>{paidCount}</span>
              {' · '}
              미결제 <span style={{ color: 'rgba(255,193,7,0.9)' }}>{unpaidCount}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 0, border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
          {([
            { key: 'all', label: '전체' },
            { key: 'unpaid', label: '미결제' },
            { key: 'paid', label: '완료' },
          ] as const).map((t, i, arr) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusFilter(t.key)}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: 12,
                border: 'none',
                background: statusFilter === t.key ? 'rgba(123,94,167,0.2)' : 'transparent',
                color: statusFilter === t.key ? '#c4a7e7' : SUB,
                cursor: 'pointer',
                borderRight: i < arr.length - 1 ? '0.5px solid rgba(255,255,255,0.1)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>
          원장별 청구 내역 ({filteredInvoices.length}명)
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : filteredInvoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 12 }}>
            {statusFilter === 'all' ? '이번 달 청구 내역이 없어요' : '해당 상태의 청구 내역이 없어요'}
          </div>
        ) : (
          filteredInvoices.map((inv, idx) => {
            const ownerId = inv.owner_id
            const expanded = expandedOwnerId === ownerId
            const ownerOrders = ordersByOwner[ownerId] || []
            const detailLines = expandOrderItemsToLines(ownerOrders)
            const isPaid = inv.status === 'paid'
            const firstOrder = ownerOrders[0]

            return (
              <div
                key={inv.id}
                style={{
                  borderBottom: idx < filteredInvoices.length - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(ownerId)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 13, color: TEXT }}>{resolveOwnerName(ownerId)}</span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 7px',
                          borderRadius: 10,
                          background: isPaid ? 'rgba(76,175,80,0.15)' : 'rgba(255,193,7,0.15)',
                          color: isPaid ? 'rgba(76,175,80,0.9)' : 'rgba(255,193,7,0.9)',
                          border: `0.5px solid ${isPaid ? 'rgba(76,175,80,0.4)' : 'rgba(255,193,7,0.4)'}`,
                        }}
                      >
                        {isPaid ? '결제완료' : '미결제'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>
                      {resolveSubtitleLead(ownerId)}
                      {firstOrder?.grade ? ` · ${firstOrder.grade}` : ''}
                      {inv.paid_at ? ` · 결제 ${new Date(inv.paid_at).toLocaleDateString('ko-KR')}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#c4a7e7' }}>
                      {formatWon(inv.total_amount)}
                    </div>
                    <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
                      발주 {ownerOrders.length}건 · {expanded ? '▲' : '▼'}
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div
                    style={{
                      margin: '0 0 12px',
                      padding: 10,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: '0.5px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {detailLines.length === 0 ? (
                      <div style={{ fontSize: 11, color: SUB, textAlign: 'center', padding: '8px 0' }}>
                        이 달 발주 품목이 없어요 (청구서만 존재)
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '72px 1fr 40px 56px 64px',
                            gap: 6,
                            padding: '4px 0 6px',
                            fontSize: 10,
                            color: SUB,
                            fontWeight: 600,
                          }}
                        >
                          <span>날짜</span>
                          <span>제품</span>
                          <span>수량</span>
                          <span>단가</span>
                          <span>소계</span>
                        </div>
                        {detailLines.map((row, i) => (
                          <div
                            key={`${row.order_id}-${i}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '72px 1fr 40px 56px 64px',
                              gap: 6,
                              padding: '6px 0',
                              borderTop: '0.5px solid rgba(255,255,255,0.05)',
                              fontSize: 11,
                              color: TEXT,
                            }}
                          >
                            <span style={{ color: SUB }}>{row.date}</span>
                            <span>{row.name}</span>
                            <span>{row.qty}</span>
                            <span>{formatWon(row.unit_price)}</span>
                            <span>{formatWon(row.line_amount)}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
