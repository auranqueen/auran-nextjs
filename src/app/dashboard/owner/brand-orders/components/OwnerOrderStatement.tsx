'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BORDER,
  PURPLE,
  STATUS_MAP,
  SUB,
  TEXT,
  formatOrderItemLine,
  type OrderItemLine,
} from '../brandOrdersUi'

type StatementOrder = {
  id: string
  brand_id: string | null
  brand_name: string
  status: string
  items: OrderItemLine[]
  promo_applied: string | null
  points_earned: number
  points_used: number
  points_used_reward: number
  total_amount: number
  created_at: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
}

type Props = {
  ownerProfileId: string | null
  onReturnRequest?: (order: StatementOrder) => void
}

type KitItem = { product_id?: string; name?: string; qty?: number }

type PouchRow = {
  id: string
  track: 'A' | 'B'
  billing_month: string
  pouch_tier: number | null
  pouch_status: string | null
  pouch_kit_snapshot: KitItem[] | null
  pouch_tracking_no: string | null
  pouch_courier: string | null
}

function parseSnapshot(raw: unknown): KitItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      const r = x as KitItem
      return {
        product_id: r.product_id ? String(r.product_id) : undefined,
        name: String(r.name || ''),
        qty: Math.trunc(Number(r.qty) || 0),
      }
    })
    .filter((x) => (x.qty || 0) > 0)
}

function monthLabelKo(billingMonth: string): string {
  const m = Number(String(billingMonth || '').slice(5, 7))
  return Number.isFinite(m) && m > 0 ? `${m}월` : '이번달'
}

function pouchTitle(row: PouchRow): string {
  const month = monthLabelKo(row.billing_month)
  const tier = row.pouch_tier ?? 0
  if (row.pouch_status === 'shipped') {
    return `🎁 ${month} 등급파우치 도착했어요!`
  }
  if (row.pouch_status === 'approved') {
    return '🎁 파우치 준비 중이에요'
  }
  return `🎁 ${month}엔 ${tier}장 파우치를 받으실 예정이에요`
}

function formatOrderDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h24 = d.getHours()
  const period = h24 < 12 ? '오전' : '오후'
  const h12 = h24 % 12 || 12
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${period} ${h12}:${min}`
}

function formatOrderDateLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function groupOrdersByDate(list: StatementOrder[]): { dateLabel: string; items: StatementOrder[] }[] {
  const groups: { dateLabel: string; items: StatementOrder[] }[] = []
  const indexByKey: Record<string, number> = {}
  for (const o of list) {
    const d = new Date(o.created_at)
    const key = Number.isNaN(d.getTime())
      ? ''
      : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    const existing = indexByKey[key]
    if (existing === undefined) {
      indexByKey[key] = groups.length
      groups.push({ dateLabel: formatOrderDateLabel(o.created_at), items: [o] })
    } else {
      groups[existing].items.push(o)
    }
  }
  return groups
}

const cardStyle = {
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: '12px',
  marginBottom: 10,
  borderBottom: '1px dashed #ede9f7',
} as const

export default function OwnerOrderStatement({ ownerProfileId, onReturnRequest }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<StatementOrder[]>([])
  const [pouches, setPouches] = useState<PouchRow[]>([])
  const [areteBalance, setAreteBalance] = useState(0)
  const [rewardBalance, setRewardBalance] = useState(0)

  const load = useCallback(async () => {
    if (!ownerProfileId) {
      setOrders([])
      setPouches([])
      setAreteBalance(0)
      setRewardBalance(0)
      setLoading(false)
      return
    }
    setLoading(true)

    const [
      { data: orderRows },
      { data: invPouch },
      { data: hqPouch },
      { data: pointRows },
    ] = await Promise.all([
      supabase
        .from('brand_orders')
        .select('id, brand_id, status, items, promo_applied, points_earned, points_used, points_used_reward, total_amount, created_at, courier, tracking_no, shipped_at, brands(name)')
        .eq('profile_id', ownerProfileId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('brand_billing_invoices')
        .select('id, billing_month, pouch_tier, pouch_status, pouch_kit_snapshot, pouch_tracking_no, pouch_courier')
        .eq('owner_id', ownerProfileId)
        .eq('status', 'paid')
        .not('pouch_tier', 'is', null)
        .order('billing_month', { ascending: false })
        .limit(3),
      supabase
        .from('hq_pouch_records')
        .select('id, billing_month, pouch_tier, pouch_status, pouch_kit_snapshot, pouch_tracking_no, pouch_courier')
        .eq('owner_id', ownerProfileId)
        .not('pouch_tier', 'is', null)
        .order('billing_month', { ascending: false })
        .limit(3),
      supabase
        .from('brand_points')
        .select('track, balance')
        .eq('owner_id', ownerProfileId)
        .in('track', ['ARETE', 'REWARD']),
    ])

    setOrders(
      ((orderRows || []) as Array<{
        id: string
        brand_id: string | null
        status: string
        items: OrderItemLine[]
        promo_applied: string | null
        points_earned: number | null
        points_used: number | null
        points_used_reward: number | null
        total_amount: number | null
        created_at: string
        courier: string | null
        tracking_no: string | null
        shipped_at: string | null
        brands: { name: string } | { name: string }[] | null
      }>).map((o) => {
        const brandRef = o.brands
        const brandName = Array.isArray(brandRef) ? brandRef[0]?.name : brandRef?.name
        return {
          id: o.id,
          brand_id: o.brand_id || null,
          brand_name: brandName || '',
          status: o.status,
          items: Array.isArray(o.items) ? o.items : [],
          promo_applied: o.promo_applied,
          points_earned: Math.trunc(Number(o.points_earned) || 0),
          points_used: Math.trunc(Number(o.points_used) || 0),
          points_used_reward: Math.trunc(Number(o.points_used_reward) || 0),
          total_amount: Math.trunc(Number(o.total_amount) || 0),
          created_at: o.created_at,
          courier: o.courier,
          tracking_no: o.tracking_no,
          shipped_at: o.shipped_at,
        }
      }),
    )

    type PouchRaw = {
      id: string
      billing_month: string
      pouch_tier: number | null
      pouch_status: string | null
      pouch_kit_snapshot: unknown
      pouch_tracking_no: string | null
      pouch_courier: string | null
    }
    const aList: PouchRow[] = ((invPouch || []) as PouchRaw[]).map((r) => ({
      id: r.id,
      track: 'A' as const,
      billing_month: r.billing_month,
      pouch_tier: r.pouch_tier,
      pouch_status: r.pouch_status,
      pouch_kit_snapshot: parseSnapshot(r.pouch_kit_snapshot),
      pouch_tracking_no: r.pouch_tracking_no,
      pouch_courier: r.pouch_courier,
    }))
    const bList: PouchRow[] = ((hqPouch || []) as PouchRaw[]).map((r) => ({
      id: r.id,
      track: 'B' as const,
      billing_month: r.billing_month,
      pouch_tier: r.pouch_tier,
      pouch_status: r.pouch_status,
      pouch_kit_snapshot: parseSnapshot(r.pouch_kit_snapshot),
      pouch_tracking_no: r.pouch_tracking_no,
      pouch_courier: r.pouch_courier,
    }))
    setPouches(
      [...aList, ...bList].sort((a, b) =>
        String(b.billing_month).localeCompare(String(a.billing_month)),
      ),
    )

    let arete = 0
    let reward = 0
    for (const row of (pointRows || []) as { track?: string; balance?: number }[]) {
      const bal = Math.trunc(Number(row.balance) || 0)
      if (row.track === 'ARETE') arete += bal
      if (row.track === 'REWARD') reward += bal
    }
    setAreteBalance(arete)
    setRewardBalance(reward)
    setLoading(false)
  }, [ownerProfileId, supabase])

  useEffect(() => {
    void load()
  }, [load])

  if (!ownerProfileId) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>
        프로필을 확인할 수 없어요
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>
        불러오는 중…
      </div>
    )
  }

  const empty = orders.length === 0 && pouches.length === 0
  const ordersByDate = groupOrdersByDate(orders)

  return (
    <div>
      {empty && (
        <div style={{ textAlign: 'center', padding: '40px 0 20px', color: SUB, fontSize: 14 }}>
          발주 내역이 없어요
        </div>
      )}

      {ordersByDate.map((group, gi) => (
        <div key={group.dateLabel || gi} style={{ marginTop: gi === 0 ? 0 : 20 }}>
          <div style={{ fontSize: 12, color: SUB, textAlign: 'left', margin: '8px 0' }}>
            {group.dateLabel}
          </div>
          {group.items.map((o) => {
        const st = STATUS_MAP[o.status] || { label: o.status, color: SUB, bg: '#F5F5F5' }
        const gross = o.total_amount + o.points_used + o.points_used_reward
        return (
          <div key={o.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{o.brand_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: SUB }}>{formatOrderDateTime(o.created_at)}</span>
                <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>
              {o.items.map((it) => formatOrderItemLine(it)).join(' · ')}
            </div>
            {o.promo_applied && (
              <div style={{ fontSize: 11, color: PURPLE, marginBottom: 6 }}>{o.promo_applied} 적용</div>
            )}
            <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 8, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT, marginBottom: 4 }}>
                <span>발주 합계</span>
                <span>₩{gross.toLocaleString()}</span>
              </div>
              {o.points_used > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB, marginBottom: 4 }}>
                  <span>아레테 포인트 사용</span>
                  <span>-{o.points_used.toLocaleString()}원</span>
                </div>
              )}
              {o.points_used_reward > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB, marginBottom: 4 }}>
                  <span>일반적립금 사용</span>
                  <span>-{o.points_used_reward.toLocaleString()}원</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT, fontWeight: 500, marginBottom: 4 }}>
                <span>실결제금액</span>
                <span>₩{o.total_amount.toLocaleString()}</span>
              </div>
              {o.points_earned > 0 && (
                <div style={{ fontSize: 11, color: '#1E6B40', marginTop: 2 }}>
                  적립 예정 +{o.points_earned}T
                </div>
              )}
            </div>
            {o.tracking_no && (
              <div style={{ fontSize: 11, color: '#185FA5', marginTop: 8, padding: '4px 8px', background: '#E6F1FB', borderRadius: 6, display: 'inline-block' }}>
                배송완료 · {o.courier} {o.tracking_no}
              </div>
            )}
            {(o.status === 'shipping' || o.status === 'done') && (
              <button
                type="button"
                onClick={() => onReturnRequest?.(o)}
                style={{ marginTop: 6, fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.06)', color: '#E53935', cursor: 'pointer', display: 'block' }}
              >
                반품·교환 신청
              </button>
            )}
          </div>
        )
          })}
        </div>
      ))}

      {pouches.map((p) => {
        const kit = p.pouch_kit_snapshot || []
        const shipped = p.pouch_status === 'shipped'
        return (
          <div
            key={`${p.track}-${p.id}`}
            style={{
              ...cardStyle,
              background: 'rgba(123,94,167,0.08)',
              border: `1px solid ${BORDER}`,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: shipped ? 8 : 0 }}>
              {pouchTitle(p)}
            </div>
            {shipped && (
              <>
                {kit.length > 0 && (
                  <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>
                    {kit.map((k) => `${k.name} ×${k.qty}`).join(' · ')}
                  </div>
                )}
                <div style={{ fontSize: 11, color: SUB }}>
                  {p.pouch_courier || '-'} · 운송장 조회 {p.pouch_tracking_no || '-'}
                </div>
              </>
            )}
          </div>
        )
      })}

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginBottom: 10 }}>이번달 요약</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT, marginBottom: 6 }}>
          <span>아레테 잔여 포인트</span>
          <span>{areteBalance.toLocaleString()}T</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: TEXT }}>
          <span>일반적립금 잔여</span>
          <span>{rewardBalance.toLocaleString()}T</span>
        </div>
      </div>
    </div>
  )
}
