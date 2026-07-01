'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PURPLE = '#7B5EA7'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

type SalonCard = {
  id: string
  name: string
  area?: string | null
  banner_url?: string | null
}

export default function FavoriteSalonsSection() {
  const router = useRouter()
  const [salons, setSalons] = useState<SalonCard[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const sb = createClient()
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user || cancelled) {
        setReady(true)
        return
      }
      const { data: me } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      if (!me?.id || cancelled) {
        setReady(true)
        return
      }
      const uid = String(me.id)
      const ownerScores = new Map<string, number>()

      const { data: chRows } = await sb
        .from('chat_channels')
        .select('owner_id, last_message_at, created_at')
        .eq('user_id', uid)
        .not('owner_id', 'is', null)
        .order('last_message_at', { ascending: false })
        .limit(20)
      for (const c of (chRows as { owner_id?: string; last_message_at?: string; created_at?: string }[]) || []) {
        const oid = c.owner_id ? String(c.owner_id) : ''
        if (!oid) continue
        const ts = new Date(c.last_message_at || c.created_at || 0).getTime()
        ownerScores.set(oid, Math.max(ownerScores.get(oid) || 0, ts))
      }

      const { data: bkRows } = await sb
        .from('bookings')
        .select('owner_id, booking_date, created_at')
        .eq('customer_id', uid)
        .not('owner_id', 'is', null)
        .order('booking_date', { ascending: false })
        .limit(20)
      for (const b of (bkRows as { owner_id?: string; booking_date?: string; created_at?: string }[]) || []) {
        const oid = b.owner_id ? String(b.owner_id) : ''
        if (!oid) continue
        const ts = new Date(b.booking_date || b.created_at || 0).getTime()
        ownerScores.set(oid, Math.max(ownerScores.get(oid) || 0, ts))
      }

      const ownerIds = Array.from(ownerScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id)

      if (!ownerIds.length || cancelled) {
        setReady(true)
        return
      }

      const { data: salonRows } = await sb
        .from('salons')
        .select('id, name, area, banner_url, owner_id')
        .in('owner_id', ownerIds)
        .eq('status', 'active')
      const list: SalonCard[] = []
      for (const oid of ownerIds) {
        const s = ((salonRows as { id: string; name?: string; area?: string; banner_url?: string; owner_id?: string }[]) || []).find((r) => String(r.owner_id) === oid)
        if (s) list.push({ id: String(s.id), name: String(s.name || '살롱'), area: s.area, banner_url: s.banner_url })
      }
      if (!cancelled) {
        setSalons(list)
        setReady(true)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [])

  if (!ready || salons.length === 0) return null

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 10 }}>즐겨찾는 원장</div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {salons.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => router.push(`/salons/${s.id}`)}
            style={{ flexShrink: 0, width: 140, border: `1px solid ${BORDER}`, borderRadius: 12, background: CARD, padding: 0, cursor: 'pointer', textAlign: 'left', overflow: 'hidden' }}
          >
            <div style={{ height: 72, background: s.banner_url ? `url(${s.banner_url}) center/cover` : 'rgba(123,94,167,0.2)' }} />
            <div style={{ padding: '10px 10px 12px' }}>
              <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>{s.name}</div>
              {s.area ? <div style={{ fontSize: 10, color: TEXT_SUB }}>{s.area}</div> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
