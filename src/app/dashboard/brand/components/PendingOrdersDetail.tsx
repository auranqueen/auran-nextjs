'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
import { resolveOwnerSalonNames } from '@/lib/brand/resolveOwnerSalonNames'

const CARD: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
}
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'

const TRACK_A_PENDING = ['pending', 'approved'] as const
const TRACK_B_PENDING = ['결제완료'] as const

type PendingRow = {
  id: string
  track: 'A' | 'B'
  at: string
  ownerName: string
  salonName: string
  productSummary: string
  amount: number
  status: string
}

interface Props {
  brandId: string
  onClose: () => void
}

function summarizeItems(items: unknown): string {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return '-'
  const first = list[0] as { name?: string; qty?: number }
  const name = String(first?.name || '-')
  const qty = Math.trunc(Number(first?.qty) || 0)
  const head = qty > 0 ? `${name} x${qty}` : name
  return list.length > 1 ? `${head} 외 ${list.length - 1}건` : head
}

function statusLabel(status: string): string {
  if (status === 'pending') return '대기'
  if (status === 'approved') return '승인'
  return status
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function PendingOrdersDetail({ brandId, onClose }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<PendingRow[]>([])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const companyBrandIds = await resolveCompanyBrandIds(supabase, brandId)

      const [{ data: aRows }, { data: bRows }] = await Promise.all([
        supabase
          .from('brand_orders')
          .select('id, created_at, owner_name, salon_name, items, total_amount, status, profile_id')
          .in('brand_id', companyBrandIds)
          .in('status', [...TRACK_A_PENDING])
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('hq_stock_orders')
          .select('id, ordered_at, created_at, profile_id, items, final_amount, status')
          .in('brand_id', companyBrandIds)
          .in('status', [...TRACK_B_PENDING])
          .order('ordered_at', { ascending: false })
          .limit(80),
      ])

      const profileIds = [
        ...((aRows || []) as Array<{ profile_id?: string }>).map((r) => String(r.profile_id || '')),
        ...((bRows || []) as Array<{ profile_id?: string }>).map((r) => String(r.profile_id || '')),
      ].filter(Boolean)
      const { ownerNameByProfileId, salonNameByProfileId } = await resolveOwnerSalonNames(
        supabase,
        profileIds,
      )

      const mappedA: PendingRow[] = ((aRows || []) as Array<Record<string, unknown>>).map((o) => {
        const pid = String(o.profile_id || '')
        return {
          id: `A-${String(o.id)}`,
          track: 'A' as const,
          at: String(o.created_at || ''),
          ownerName: ownerNameByProfileId[pid] || String(o.owner_name || '원장'),
          salonName: salonNameByProfileId[pid] || String(o.salon_name || '-'),
          productSummary: summarizeItems(o.items),
          amount: Math.trunc(Number(o.total_amount) || 0),
          status: String(o.status || ''),
        }
      })

      const mappedB: PendingRow[] = ((bRows || []) as Array<Record<string, unknown>>).map((o) => {
        const pid = String(o.profile_id || '')
        return {
          id: `B-${String(o.id)}`,
          track: 'B' as const,
          at: String(o.ordered_at || o.created_at || ''),
          ownerName: ownerNameByProfileId[pid] || '원장',
          salonName: salonNameByProfileId[pid] || '-',
          productSummary: summarizeItems(o.items),
          amount: Math.trunc(Number(o.final_amount) || 0),
          status: String(o.status || ''),
        }
      })

      const merged = [...mappedA, ...mappedB].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      )
      if (!cancelled) {
        setRows(merged)
        setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [brandId, supabase])

  return (
    <div style={{ ...CARD, outline: `1px solid rgba(232,165,0,0.35)` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>
          처리대기 주문 {loading ? '' : `(${rows.length})`}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            fontSize: 11,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent',
            color: SUB,
            cursor: 'pointer',
          }}
        >
          접기
        </button>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>처리대기 주문 없음</div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: 'auto' as const }}>
          {rows.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 28px 1fr auto',
                gap: 6,
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < rows.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div style={{ fontSize: 10, color: SUB }}>{formatDate(r.at)}</div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textAlign: 'center',
                  padding: '1px 4px',
                  borderRadius: 4,
                  background: r.track === 'A' ? 'rgba(201,169,110,0.18)' : 'rgba(123,94,167,0.22)',
                  color: r.track === 'A' ? GOLD : PURPLE,
                }}
              >
                {r.track}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {r.salonName} · {r.ownerName}
                </div>
                <div style={{ fontSize: 10, color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {r.productSummary}
                </div>
              </div>
              <div style={{ textAlign: 'right' as const, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: TEXT }}>₩{r.amount.toLocaleString()}</div>
                <div style={{ fontSize: 9, color: '#e8a500' }}>{statusLabel(r.status)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}