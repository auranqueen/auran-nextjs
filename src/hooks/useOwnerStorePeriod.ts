'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getOwnerLayerPeriod,
  pickLayerActiveSub,
  resolveTrialStart,
  type OwnerStorePeriod,
  type OwnerStorePeriodPhase,
  type OwnerSubLayer,
} from '@/lib/subscription/storeTrial'

const EMPTY: OwnerStorePeriod = { phase: 'expired', daysLeft: 0 }

type Options = {
  /** 미지정 시 phase/daysLeft는 store 기준 (기존 사이드바·배너 호환) */
  layer?: OwnerSubLayer
}

/** 원장 레이어별 이용기간/무료체험 D-day */
export function useOwnerStorePeriod(options?: Options) {
  const layer: OwnerSubLayer = options?.layer ?? 'store'
  const supabase = useMemo(() => createClient(), [])
  const [storePeriod, setStorePeriod] = useState<OwnerStorePeriod>(EMPTY)
  const [showcasePeriod, setShowcasePeriod] = useState<OwnerStorePeriod>(EMPTY)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        if (!cancelled) {
          setStorePeriod(EMPTY)
          setShowcasePeriod(EMPTY)
          setReady(true)
        }
        return
      }

      const { data: urow } = await supabase
        .from('users')
        .select('id, created_at, store_trial_started_at')
        .eq('auth_id', auth.user.id)
        .maybeSingle()

      const ownerId = urow?.id ? String(urow.id) : null
      const trialStart = resolveTrialStart(
        (urow as { store_trial_started_at?: string | null } | null)?.store_trial_started_at,
        urow?.created_at ? String(urow.created_at) : null,
      )

      let subs: {
        plan?: string | null
        started_at?: string | null
        expires_at?: string | null
        status?: string | null
      }[] = []

      if (ownerId) {
        const { data } = await supabase
          .from('owner_subscriptions')
          .select('plan, started_at, expires_at, status')
          .eq('owner_id', ownerId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
        subs = ((data as any[]) || []) as typeof subs
      }

      const store = getOwnerLayerPeriod({
        trialStart,
        activeSubForLayer: pickLayerActiveSub(subs, 'store'),
      })
      const showcase = getOwnerLayerPeriod({
        trialStart,
        activeSubForLayer: pickLayerActiveSub(subs, 'showcase'),
      })

      if (!cancelled) {
        setStorePeriod(store)
        setShowcasePeriod(showcase)
        setReady(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const primary = layer === 'showcase' ? showcasePeriod : storePeriod

  return {
    storePeriod,
    showcasePeriod,
    ready,
    /** 하위호환 / layer 옵션 반영 */
    phase: primary.phase as OwnerStorePeriodPhase,
    daysLeft: primary.daysLeft,
  }
}
