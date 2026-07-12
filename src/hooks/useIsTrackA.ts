'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** users.origin_track === 'A' 여부 (원장 브랜드 발주 등 트랙A 전용 UI 게이트) */
export function useIsTrackA() {
  const supabase = useMemo(() => createClient(), [])
  const [isTrackA, setIsTrackA] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        if (!cancelled) {
          setIsTrackA(false)
          setReady(true)
        }
        return
      }

      const { data } = await supabase
        .from('users')
        .select('origin_track')
        .eq('auth_id', auth.user.id)
        .maybeSingle()

      if (!cancelled) {
        setIsTrackA(data?.origin_track === 'A')
        setReady(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [supabase])

  return { isTrackA, ready }
}
