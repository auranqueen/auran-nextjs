'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveOwnerSalonNames } from '@/lib/brand/resolveOwnerSalonNames'

const CARD: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
}
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

const STATUS_LABEL: Record<string, string> = {
  pending: '접수 대기',
  approved: '승인됨',
  shipping: '배송중',
  done: '완료',
  cancelled: '취소',
  '결제대기': '결제대기',
  '결제완료': '결제완료',
  '배송완료': '배송완료',
  '구매확정': '구매확정',
  '취소': '취소',
}

type MonthOrderRow = {
  id: string
  created_at: string
  owner_name: string
  salon_name: string | null
  amount: number
  status: string
  track: 'A' | 'B'
  brandBadges?: string[]
  itemsSummary?: string | null
}

interface Props {
  brandId: string
  onClose: () => void
}

function brandNameFromRow(o: { brands?: { name?: string } | { name?: string }[] | null }): string | null {
  const ref = o.brands
  const name = Array.isArray(ref) ? ref[0]?.name : ref?.name
  return name ? String(name) : null
}

function profileNameFromRow(o: {
  profiles?: { full_name?: string } | { full_name?: string }[] | null
  owner_name?: string
}): string {
  const profileRef = o.profiles
  const profileName = Array.isArray(profileRef) ? profileRef[0]?.full_name : profileRef?.full_name
  return profileName || o.owner_name || '원장님'
}

function flattenItemLines(orders: Array<{ items?: unknown }>): Array<{ name: string }> {
  const lines: Array<{ name: string }> = []
  for (const o of orders) {
    const items = Array.isArray(o.items) ? o.items : []
    for (const it of items) {
      const name =
        it && typeof it === 'object' && 'name' in it
          ? String((it as { name?: string }).name || '').trim()
          : ''
      lines.push({ name })
    }
  }
  return lines
}

function itemsSummaryFromOrders(orders: Array<{ items?: unknown }>): string | null {
  const lines = flattenItemLines(orders)
  if (lines.length === 0) return null
  const named = lines.map((l) => l.name).filter(Boolean)
  if (named.length === 0) return '-'
  const first = named[0]
  if (lines.length === 1) return first
  return `${first} 외 ${lines.length - 1}건`
}

export default function MonthlyOrderAccordion({ brandId, onClose }: Props) {
  const supabase = createClient()
  const [monthOrderList, setMonthOrderList] = useState<MonthOrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) return
    const fetch = async () => {
      setLoading(true)
      const thisMonth = new Date()
      thisMonth.setDate(1)
      thisMonth.setHours(0, 0, 0, 0)
      const thisMonthIso = thisMonth.toISOString()

      const [{ data: monthRows }, { data: hqMonthRows }] = await Promise.all([
        supabase
          .from('brand_orders')
          .select(
            'id, batch_id, brand_id, total_amount, status, created_at, owner_name, salon_name, items, brands(name), profile_id, profiles(full_name)',
          )
          .eq('brand_id', brandId)
          .gte('created_at', thisMonthIso)
          .order('created_at', { ascending: false }),
        supabase
          .from('hq_stock_orders')
          .select('id, final_amount, status, ordered_at, created_at, profile_id')
          .eq('brand_id', brandId)
          .gte('created_at', thisMonthIso)
          .order('created_at', { ascending: false }),
      ])

      const seedRows = (monthRows || []) as any[]
      const batchIds = Array.from(
        new Set(
          seedRows
            .map((o) => (o.batch_id != null && String(o.batch_id) ? String(o.batch_id) : null))
            .filter((id): id is string => Boolean(id)),
        ),
      )

      let siblingRows: any[] = []
      if (batchIds.length) {
        const { data } = await supabase
          .from('brand_orders')
          .select(
            'id, batch_id, brand_id, total_amount, status, created_at, owner_name, salon_name, items, brands(name), profiles(full_name)',
          )
          .in('batch_id', batchIds)
        siblingRows = data || []
      }

      const byBatch: Record<string, any[]> = {}
      for (const o of siblingRows) {
        const bid = String(o.batch_id || '')
        if (!bid) continue
        if (!byBatch[bid]) byBatch[bid] = []
        byBatch[bid].push(o)
      }

      const seenBatches = new Set<string>()
      const listA: MonthOrderRow[] = []

      for (const o of seedRows) {
        const bid = o.batch_id != null && String(o.batch_id) ? String(o.batch_id) : null
        if (bid) {
          if (seenBatches.has(bid)) continue
          seenBatches.add(bid)
          const group = byBatch[bid]?.length ? byBatch[bid] : [o]
          const current = group.find((g) => String(g.brand_id) === String(brandId)) || null
          const primary = current || group[0]
          const brandBadges = Array.from(
            new Set(
              group
                .map((g) => brandNameFromRow(g))
                .filter((n): n is string => Boolean(n)),
            ),
          )
          listA.push({
            id: `A-batch-${bid}`,
            created_at: current?.created_at || primary.created_at,
            owner_name: profileNameFromRow(primary),
            salon_name: primary.salon_name ? String(primary.salon_name) : null,
            amount: Math.trunc(
              group.reduce((sum, g) => sum + (Number(g.total_amount) || 0), 0),
            ),
            status: (current || primary).status || 'pending',
            track: 'A',
            brandBadges,
            itemsSummary: itemsSummaryFromOrders(group),
          })
        } else {
          const badge = brandNameFromRow(o)
          listA.push({
            id: `A-${o.id}`,
            created_at: o.created_at,
            owner_name: profileNameFromRow(o),
            salon_name: o.salon_name ? String(o.salon_name) : null,
            amount: Math.trunc(Number(o.total_amount) || 0),
            status: o.status || 'pending',
            track: 'A',
            brandBadges: badge ? [badge] : undefined,
            itemsSummary: itemsSummaryFromOrders([o]),
          })
        }
      }

      // 트랙B: profile_id → profiles.auth_id → users.name / users.id → salons.name
      const rawHqOrders = hqMonthRows || []
      const hqProfileIds = Array.from(
        new Set(rawHqOrders.map((o: { profile_id?: string }) => String(o.profile_id || '')).filter(Boolean)),
      )
      const { ownerNameByProfileId, salonNameByProfileId } = await resolveOwnerSalonNames(supabase, hqProfileIds)

      const listB = rawHqOrders.map((o: any) => {
        const pid = String(o.profile_id || '')
        return {
          id: `B-${o.id}`,
          created_at: o.ordered_at || o.created_at,
          owner_name: ownerNameByProfileId[pid] || '원장',
          salon_name: salonNameByProfileId[pid] || null,
          amount: Math.trunc(Number(o.final_amount) || 0),
          status: o.status || '결제대기',
          track: 'B' as const,
        }
      })

      setMonthOrderList(
        [...listA, ...listB].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      )
      setLoading(false)
    }
    void fetch()
  }, [brandId, supabase])

  return (
    <div style={{ ...CARD, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: SUB }}>이달 재고발주 내역</div>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: TEXT,
            cursor: 'pointer',
          }}
        >
          접기
        </button>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : monthOrderList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>이달 발주 내역이 없어요</div>
      ) : (
        monthOrderList.map((row) => {
          const cancelled = row.status === 'cancelled' || row.status === '취소'
          return (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                fontSize: 11,
              }}
            >
              <span style={{ color: SUB, width: 72, flexShrink: 0 }}>
                {new Date(row.created_at).toLocaleDateString('ko-KR')}
              </span>
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 4,
                  flexShrink: 0,
                  background: row.track === 'A' ? 'rgba(201,169,110,0.15)' : 'rgba(123,94,167,0.18)',
                  color: row.track === 'A' ? GOLD : '#c4a8f0',
                }}
              >
                {row.track}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      color: '#fff',
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.salon_name || '살롱'}
                  </span>
                  {(row.brandBadges || []).map((b) => (
                    <span
                      key={b}
                      style={{
                        fontSize: 8,
                        padding: '1px 5px',
                        borderRadius: 999,
                        flexShrink: 0,
                        background: 'rgba(201,169,110,0.12)',
                        color: GOLD,
                        border: '1px solid rgba(201,169,110,0.25)',
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </span>
                <span
                  style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 11,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.owner_name || '원장'}
                </span>
                {row.itemsSummary ? (
                  <span
                    style={{
                      color: SUB,
                      fontSize: 10,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.itemsSummary}
                  </span>
                ) : null}
              </span>
              <span style={{ color: cancelled ? SUB : (row.track === 'A' ? GOLD : PURPLE), flexShrink: 0 }}>
                {cancelled ? '-' : ''}₩{row.amount.toLocaleString()}
              </span>
              <span
                style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 4,
                  flexShrink: 0,
                  background: cancelled ? 'rgba(255,255,255,0.06)' : 'rgba(201,169,110,0.12)',
                  color: cancelled ? 'rgba(255,255,255,0.35)' : GOLD,
                }}
              >
                {STATUS_LABEL[row.status] || row.status}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}