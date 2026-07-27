'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
type OrderRow = {
  id: string
  owner_id: string
  tier_package_id: string
  amount: number
  status: string
  approved_at: string | null
  created_at: string
}
type EnrichedOrder = OrderRow & {
  ownerName: string
  originTrack: string | null
  tierName: string
  itemCount: number
}
type Props = {
  companyId: string | null
}
export default function BrandTierOrderApprovalSection({ companyId }: Props) {
  const supabase = createClient()
  const [orders, setOrders] = useState<EnrichedOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const { data: orderRows } = await supabase
        .from('brand_tier_orders')
        .select('id, owner_id, tier_package_id, amount, status, approved_at, created_at')
        .eq('company_id', companyId)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
      const rows = (orderRows || []) as OrderRow[]
      if (rows.length === 0) {
        setOrders([])
        return
      }
      const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id)))
      const tierIds = Array.from(new Set(rows.map((r) => r.tier_package_id)))
      const orderIds = rows.map((r) => r.id)
      const [{ data: profiles }, { data: tiers }, { data: items }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, owner_store_name, auth_id').in('id', ownerIds),
        supabase.from('brand_tier_packages').select('id, tier_name').in('id', tierIds),
        supabase.from('brand_tier_order_items').select('order_id').in('order_id', orderIds),
      ])
      const authIds = (profiles || []).map((p: any) => p.auth_id).filter(Boolean)
      const { data: users } = authIds.length
        ? await supabase.from('users').select('auth_id, origin_track').in('auth_id', authIds)
        : { data: [] }
      const profileMap: Record<string, { name: string; auth_id: string | null }> = {}
      for (const p of (profiles || []) as any[]) {
        profileMap[String(p.id)] = {
          name: String(p.owner_store_name || p.full_name || '원장님'),
          auth_id: p.auth_id ? String(p.auth_id) : null,
        }
      }
      const trackByAuthId: Record<string, string> = {}
      for (const u of (users || []) as any[]) {
        trackByAuthId[String(u.auth_id)] = String(u.origin_track || '')
      }
      const tierNameMap: Record<string, string> = {}
      for (const t of (tiers || []) as any[]) {
        tierNameMap[String(t.id)] = String(t.tier_name)
      }
      const itemCountMap: Record<string, number> = {}
      for (const it of (items || []) as any[]) {
        const oid = String(it.order_id)
        itemCountMap[oid] = (itemCountMap[oid] || 0) + 1
      }
      const enriched: EnrichedOrder[] = rows.map((r) => {
        const prof = profileMap[String(r.owner_id)]
        const track = prof?.auth_id ? trackByAuthId[prof.auth_id] : ''
        return {
          ...r,
          ownerName: prof?.name || '원장님',
          originTrack: track || null,
          tierName: tierNameMap[String(r.tier_package_id)] || '',
          itemCount: itemCountMap[r.id] || 0,
        }
      })
      setOrders(enriched)
    } finally {
      setLoading(false)
    }
  }, [companyId, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const approve = async (order: EnrichedOrder) => {
    if (!companyId) return
    if (!window.confirm(`${order.ownerName}님 주문을 승인하고 물류로 전달할까요?`)) return
    setApprovingId(order.id)
    try {
      const res = await fetch('/api/brand/tier-orders/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ company_id: companyId, order_id: order.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        showToast('승인 실패')
        return
      }
      showToast('승인 완료, 물류로 전달됐어요')
      await load()
    } finally {
      setApprovingId(null)
    }
  }
  const pending = orders.filter((o) => !o.approved_at)
  const approved = orders.filter((o) => o.approved_at)
  return (
    <div style={{ marginTop: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>발송오더 승인</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
        등급구매 결제완료 건을 확인하고 물류로 전달하세요
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>불러오는 중…</div>
      ) : orders.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>대기중인 발송오더가 없어요</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.map((o) => (
            <div key={o.id} style={{ padding: 14, borderRadius: 12, border: `1px solid ${PURPLE}`, background: 'rgba(123,94,167,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{o.ownerName}</span>
                {o.originTrack === 'A' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(74,141,192,0.2)', color: '#7fb3e0' }}>트랙A</span>}
                {o.originTrack === 'B' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(99,153,34,0.2)', color: '#9dc46a' }}>트랙B</span>}
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'rgba(250,199,117,0.15)', color: '#fac775', marginLeft: 'auto' }}>승인대기</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                {o.tierName} · 담은금액 {Math.trunc(o.amount).toLocaleString()}원 · 품목 {o.itemCount}종
              </div>
              <button
                type="button"
                disabled={approvingId === o.id}
                onClick={() => void approve(o)}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 600, cursor: approvingId === o.id ? 'wait' : 'pointer', opacity: approvingId === o.id ? 0.7 : 1 }}
              >
                {approvingId === o.id ? '처리 중…' : '승인하고 물류로 전달'}
              </button>
            </div>
          ))}
          {approved.map((o) => (
            <div key={o.id} style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{o.ownerName}</span>
                {o.originTrack === 'A' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(74,141,192,0.2)', color: '#7fb3e0' }}>트랙A</span>}
                {o.originTrack === 'B' && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(99,153,34,0.2)', color: '#9dc46a' }}>트랙B</span>}
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'rgba(99,153,34,0.15)', color: '#9dc46a', marginLeft: 'auto' }}>물류전달됨</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                {o.tierName} · 담은금액 {Math.trunc(o.amount).toLocaleString()}원 · 품목 {o.itemCount}종
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
