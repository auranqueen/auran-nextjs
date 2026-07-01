'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

type Props = {
  ownerId: string
  customerId: string | null
}

export default function StoreRelationshipCard({ ownerId, customerId }: Props) {
  const [sinceLabel, setSinceLabel] = useState<string | null>(null)
  const [bookingCount, setBookingCount] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ownerId || !customerId) {
      setReady(true)
      return
    }
    let cancelled = false
    const run = async () => {
      const sb = createClient()
      const [{ data: chRows }, { count }] = await Promise.all([
        sb
          .from('chat_channels')
          .select('created_at')
          .eq('owner_id', ownerId)
          .eq('user_id', customerId)
          .eq('channel_type', 'salon')
          .order('created_at', { ascending: true })
          .limit(1),
        sb
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('owner_id', ownerId)
          .eq('customer_id', customerId),
      ])
      if (cancelled) return
      const first = ((chRows as { created_at?: string }[]) || [])[0]?.created_at
      if (first) {
        try {
          const d = new Date(first)
          setSinceLabel(`${d.getFullYear()}년 ${d.getMonth() + 1}월부터`)
        } catch {
          setSinceLabel(null)
        }
      }
      setBookingCount(count ?? 0)
      setReady(true)
    }
    void run()
    return () => { cancelled = true }
  }, [ownerId, customerId])

  if (!ready || !customerId || (!sinceLabel && bookingCount === 0)) return null

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 6 }}>오랜 단골</div>
        <div style={{ fontSize: 14, color: TEXT, marginBottom: 4 }}>
          {sinceLabel ? `${sinceLabel} 함께하고 있어요` : '함께하고 있어요'}
        </div>
        <div style={{ fontSize: 12, color: PURPLE }}>누적 예약 {bookingCount}회</div>
      </div>
    </div>
  )
}
