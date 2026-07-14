'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getOwnerStorePeriod,
  type OwnerStorePeriodPhase,
} from '@/lib/subscription/storeTrial'

/** 원장 스토어 이용기간/무료체험 D-day (사이드바·구독 페이지 공용) */
export function useOwnerStorePeriod() {
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<OwnerStorePeriodPhase>('expired')
  const [daysLeft, setDaysLeft] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        if (!cancelled) {
          setPhase('expired')
          setDaysLeft(0)
          setReady(true)
        }
        return
      }

      const { data: urow } = await supabase
        .from('users')
        .select('id, created_at')
        .eq('auth_id', auth.user.id)
        .maybeSingle()

      const ownerId = urow?.id ? String(urow.id) : null
      const createdAt = urow?.created_at ? String(urow.created_at) : null

      let activeSub: { started_at?: string | null; expires_at?: string | null; status?: string | null } | null =
        null
      if (ownerId) {
        const { data: subs } = await supabase
          .from('owner_subscriptions')
          .select('started_at, expires_at, status')
          .eq('owner_id', ownerId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
        activeSub = ((subs as any[]) || [])[0] || null
      }

      const period = getOwnerStorePeriod({ createdAt, activeSub })
      if (!cancelled) {
        setPhase(period.phase)
        setDaysLeft(period.daysLeft)
        setReady(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return { phase, daysLeft, ready }
}
