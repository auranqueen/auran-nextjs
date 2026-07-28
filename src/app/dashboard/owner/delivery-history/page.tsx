'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
type HistoryItem = {
  id: string
  source: 'restock' | 'grade'
  createdAt: string
  statusLabel: string
  amount: number
  courier: string | null
  trackingNo: string | null
  label: string
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
function tierStatusLabel(row: { status: string; approved_at: string | null; shipped_at: string | null }): string {
  if (row.status !== 'paid') return '결제대기'
  if (!row.approved_at) return '승인대기'
  if (!row.shipped_at) return '물류전달됨'
  return '발송완료'
}
export default function DeliveryHistoryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [filter, setFilter] = useState<'all' | 'restock' | 'grade'>('all')
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=owner')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
      if (!profile?.id) {
        setLoading(false)
        return
      }
      const profileId = String(profile.id)
      const restockItems: HistoryItem[] = []
      const { data: batches } = await supabase
        .from('brand_order_batches')
        .select('id, order_no, status, total_amount, created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(30)
      const batchRows = (batches || []) as any[]
      if (batchRows.length) {
        const batchIds = batchRows.map((b) => String(b.id))
        const { data: orderLines } = await supabase
          .from('brand_orders')
          .select('batch_id, courier, tracking_no, shipped_at')
          .in('batch_id', batchIds)
        const trackingByBatch: Record<string, { courier: string | null; no: string | null }> = {}
        for (const o of (orderLines || []) as any[]) {
          const bid = String(o.batch_id)
          if (!trackingByBatch[bid] && (o.courier || o.tracking_no)) {
            trackingByBatch[bid] = { courier: o.courier || null, no: o.tracking_no || null }
          }
        }
        for (const b of batchRows) {
          const bid = String(b.id)
          const tr = trackingByBatch[bid]
          restockItems.push({
            id: bid,
            source: 'restock',
            createdAt: b.created_at,
            statusLabel: String(b.status || ''),
            amount: Math.trunc(Number(b.total_amount) || 0),
            courier: tr?.courier || null,
            trackingNo: tr?.no || null,
            label: `주문 ${b.order_no || ''}`.trim(),
          })
        }
      }
      const { data: hqOrders } = await supabase
        .from('hq_stock_orders')
        .select('id, status, final_amount, created_at, courier, tracking_no')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(30)
      for (const o of (hqOrders || []) as any[]) {
        restockItems.push({
          id: String(o.id),
          source: 'restock',
          createdAt: o.created_at,
          statusLabel: String(o.status || ''),
          amount: Math.trunc(Number(o.final_amount) || 0),
          courier: o.courier || null,
          trackingNo: o.tracking_no || null,
          label: '본사재고발주',
        })
      }
      const gradeItems: HistoryItem[] = []
      const { data: tierOrders } = await supabase
        .from('brand_tier_orders')
        .select('id, created_at, status, approved_at, tracking_carrier, tracking_number, shipped_at, amount, tier_package_id')
        .eq('owner_id', profileId)
        .order('created_at', { ascending: false })
        .limit(30)
      const tierRows = (tierOrders || []) as any[]
      if (tierRows.length) {
        const tierIds = Array.from(new Set(tierRows.map((r) => String(r.tier_package_id)).filter(Boolean)))
        const { data: tiers } = tierIds.length
          ? await supabase.from('brand_tier_packages').select('id, tier_name').in('id', tierIds)
          : { data: [] }
        const tierNameMap: Record<string, string> = {}
        for (const t of (tiers || []) as any[]) {
          tierNameMap[String(t.id)] = String(t.tier_name)
        }
        for (const r of tierRows) {
          gradeItems.push({
            id: String(r.id),
            source: 'grade',
            createdAt: r.created_at,
            statusLabel: tierStatusLabel(r),
            amount: Math.trunc(Number(r.amount) || 0),
            courier: r.tracking_carrier || null,
            trackingNo: r.tracking_number || null,
            label: tierNameMap[String(r.tier_package_id)] || '등급구매',
          })
        }
      }
      const merged = [...restockItems, ...gradeItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      setItems(merged)
    } finally {
      setLoading(false)
    }
  }, [router, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const filtered = items.filter((it) => filter === 'all' || it.source === filter)
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>배송 이력</div>
      </div>
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
        {([
          { key: 'all', label: '전체' },
          { key: 'restock', label: '재고발주' },
          { key: 'grade', label: '등급혜택' },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${filter === t.key ? PURPLE : BORDER}`,
              background: filter === t.key ? 'rgba(123,94,167,0.1)' : 'transparent',
              color: filter === t.key ? PURPLE : SUB,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>배송 이력이 없어요</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((it) => (
              <div key={`${it.source}-${it.id}`} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 20,
                      background: it.source === 'restock' ? 'rgba(74,141,192,0.12)' : 'rgba(123,94,167,0.12)',
                      color: it.source === 'restock' ? '#4a8dc0' : PURPLE,
                    }}
                  >
                    {it.source === 'restock' ? '재고발주' : '등급혜택'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{it.label}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: SUB }}>
                    {fmtDate(it.createdAt)} · ₩{it.amount.toLocaleString()}
                    {it.courier && it.trackingNo ? ` · 📦 ${it.courier} ${it.trackingNo}` : ''}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: LIGHT,
                      color: TEXT,
                    }}
                  >
                    {it.statusLabel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DashboardBottomNav role="owner" />
    </div>
  )
}
