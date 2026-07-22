'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

interface Props {
  brandId: string
  onClose: () => void
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
          .select('id, total_amount, status, created_at, owner_name, salon_name, profile_id, profiles(full_name)')
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

      const listA = (monthRows || []).map((o: any) => {
        const profileRef = o.profiles
        const profileName = Array.isArray(profileRef) ? profileRef[0]?.full_name : profileRef?.full_name
        return {
          id: `A-${o.id}`,
          created_at: o.created_at,
          owner_name: profileName || o.owner_name || '원장님',
          salon_name: o.salon_name ? String(o.salon_name) : null,
          amount: Math.trunc(Number(o.total_amount) || 0),
          status: o.status || 'pending',
          track: 'A' as const,
        }
      })

      // 트랙B: profile_id → profiles.auth_id → users.name / users.id → salons.name
      const rawHqOrders = hqMonthRows || []
      const hqProfileIds = Array.from(
        new Set(rawHqOrders.map((o: { profile_id?: string }) => String(o.profile_id || '')).filter(Boolean)),
      )
      const profileIdToAuthId: Record<string, string> = {}
      const authIdToUserName: Record<string, string> = {}
      const authIdToUserId: Record<string, string> = {}
      const userIdToSalonName: Record<string, string> = {}
      if (hqProfileIds.length) {
        const { data: profRows } = await supabase
          .from('profiles')
          .select('id, auth_id')
          .in('id', hqProfileIds)
        for (const p of profRows || []) {
          if (p.id && p.auth_id) profileIdToAuthId[String(p.id)] = String(p.auth_id)
        }
        const authIds = Array.from(new Set(Object.values(profileIdToAuthId)))
        if (authIds.length) {
          const { data: userRows } = await supabase
            .from('users')
            .select('id, auth_id, name')
            .in('auth_id', authIds)
          for (const u of userRows || []) {
            const aid = String((u as { auth_id?: string }).auth_id || '')
            if (!aid) continue
            authIdToUserName[aid] = String((u as { name?: string }).name || '원장')
            authIdToUserId[aid] = String(u.id)
          }
          const userIds = Array.from(new Set(Object.values(authIdToUserId)))
          if (userIds.length) {
            const { data: salonRows } = await supabase
              .from('salons')
              .select('owner_id, name')
              .in('owner_id', userIds)
            for (const s of salonRows || []) {
              const oid = String((s as { owner_id?: string }).owner_id || '')
              if (oid) userIdToSalonName[oid] = String((s as { name?: string }).name || '')
            }
          }
        }
      }

      const listB = rawHqOrders.map((o: any) => {
        const pid = String(o.profile_id || '')
        const authId = profileIdToAuthId[pid] || ''
        const userId = authId ? authIdToUserId[authId] || '' : ''
        return {
          id: `B-${o.id}`,
          created_at: o.ordered_at || o.created_at,
          owner_name: (authId && authIdToUserName[authId]) || '원장',
          salon_name: (userId && userIdToSalonName[userId]) || null,
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
                <span style={{ color: '#fff', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.salon_name || '살롱'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.owner_name || '원장'}
                </span>
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
