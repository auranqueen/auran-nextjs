'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD = '#C9A96E'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

type Props = {
  ownerId: string
  customerId: string | null
}

type RepurchaseItem = {
  label: string
  remaining: number
}

export default function StoreRepurchaseCard({ ownerId, customerId }: Props) {
  const [item, setItem] = useState<RepurchaseItem | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!ownerId || !customerId) {
      setReady(true)
      return
    }
    let cancelled = false
    const run = async () => {
      const sb = createClient()
      const { data: salon } = await sb.from('salons').select('id').eq('owner_id', ownerId).maybeSingle()
      if (!salon?.id || cancelled) {
        setReady(true)
        return
      }
      const { data: rows } = await sb
        .from('purchases')
        .select('service_name, used_sessions, total_sessions')
        .eq('customer_id', customerId)
        .eq('salon_id', salon.id)
        .order('purchased_at', { ascending: false })
      if (cancelled) return
      let pick: RepurchaseItem | null = null
      for (const r of (rows as { service_name?: string; used_sessions?: number; total_sessions?: number }[]) || []) {
        const total = Number(r.total_sessions || 0)
        const used = Number(r.used_sessions || 0)
        if (total <= 0) continue
        const remaining = total - used
        if (remaining <= 1 && remaining >= 0) {
          pick = { label: String(r.service_name || '관리권'), remaining }
          break
        }
      }
      setItem(pick)
      setReady(true)
    }
    void run()
    return () => { cancelled = true }
  }, [ownerId, customerId])

  if (!ready || !item) return null

  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 6 }}>소진 임박</div>
        <div style={{ fontSize: 14, color: TEXT, marginBottom: 4 }}>{item.label}</div>
        <div style={{ fontSize: 12, color: GOLD }}>남은 횟수 {item.remaining}회 · 재구매를 추천해요</div>
      </div>
    </div>
  )
}
