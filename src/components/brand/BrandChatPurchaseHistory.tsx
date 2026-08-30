'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  ownerId: string
  companyId: string
  onClose: () => void
}

const TEXT = 'rgba(255,255,255,0.75)'
const SUB = 'rgba(255,255,255,0.35)'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'

type OrderRow = {
  id: string
  created_at: string
  total_amount: number | null
  status: string | null
  items: any
}

export default function BrandChatPurchaseHistory({ ownerId, companyId, onClose }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [grade, setGrade] = useState<string | null>(null)
  const [isArete, setIsArete] = useState(false)
  const [reward, setReward] = useState(0)
  const [aretePts, setAretePts] = useState(0)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [name, setName] = useState('원장님')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const { data: user } = await supabase.from('users').select('id, name, auth_id').eq('id', ownerId).maybeSingle()
      if (!user?.auth_id) {
        if (!cancelled) setLoading(false)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('auth_id', user.auth_id)
        .maybeSingle()
      const profileId = profile?.id
      if (!cancelled) setName(profile?.full_name || user.name || '원장님')
      if (!profileId) {
        if (!cancelled) setLoading(false)
        return
      }

      const { data: companyBrands } = await supabase.from('brands').select('id').eq('company_id', companyId)
      const ids = (companyBrands || []).map((b: { id: string }) => b.id)

      const [{ data: g }, { data: a }, { data: pts }, { data: ords }] = await Promise.all([
        supabase.from('brand_owner_grades').select('grade').eq('company_id', companyId).eq('owner_id', profileId).limit(1).maybeSingle(),
        supabase.from('brand_arete_members').select('owner_id').eq('company_id', companyId).eq('owner_id', profileId).eq('status', 'active').maybeSingle(),
        supabase.from('brand_points').select('track, balance').eq('company_id', companyId).eq('owner_id', profileId).in('track', ['REWARD', 'ARETE']),
        ids.length
          ? supabase
            .from('brand_orders')
            .select('id, created_at, total_amount, status, items')
            .eq('profile_id', profileId)
            .in('brand_id', ids)
            .order('created_at', { ascending: false })
            .limit(20)
          : Promise.resolve({ data: [] as OrderRow[] }),
      ])

      if (cancelled) return
      setGrade((g as { grade?: string } | null)?.grade || null)
      setIsArete(Boolean(a))
      let r = 0
      let ap = 0
      for (const p of pts || []) {
        if ((p as { track: string }).track === 'REWARD') r = Number((p as { balance: number }).balance || 0)
        if ((p as { track: string }).track === 'ARETE') ap = Number((p as { balance: number }).balance || 0)
      }
      setReward(r)
      setAretePts(ap)
      setOrders((ords || []) as OrderRow[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId, companyId, supabase])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, maxHeight: '80vh', overflowY: 'auto',
          background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, color: TEXT, fontWeight: 700 }}>{name} 구매이력</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {grade && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: `0.5px solid ${GOLD}`, color: GOLD }}>{grade}</span>}
              {isArete && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'rgba(123,94,167,0.25)', color: '#c4a7e7' }}>아레테</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', color: SUB, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>적립금</div>
            <div style={{ fontSize: 16, color: GOLD, fontWeight: 700 }}>{reward.toLocaleString()}P</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 10, color: SUB, marginBottom: 4 }}>아레테포인트</div>
            <div style={{ fontSize: 16, color: PURPLE, fontWeight: 700 }}>{aretePts.toLocaleString()}P</div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>최근 주문</div>
        {loading ? (
          <div style={{ color: SUB, fontSize: 12, textAlign: 'center', padding: 16 }}>불러오는 중…</div>
        ) : orders.length === 0 ? (
          <div style={{ color: SUB, fontSize: 12, textAlign: 'center', padding: 16 }}>주문 내역 없음</div>
        ) : (
          orders.map((o, i) => {
            const items = Array.isArray(o.items) ? o.items : []
            const label = items[0]?.name
              ? (items.length > 1 ? `${items[0].name} 외 ${items.length - 1}` : items[0].name)
              : '주문'
            return (
              <div
                key={o.id}
                style={{
                  display: 'flex', gap: 8, padding: '8px 0',
                  borderBottom: i < orders.length - 1 ? '0.5px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                  <div style={{ fontSize: 10, color: SUB }}>{new Date(o.created_at).toLocaleDateString('ko-KR')} · {o.status || '-'}</div>
                </div>
                <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, flexShrink: 0 }}>
                  {(o.total_amount || 0).toLocaleString()}원
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
