'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useOwnerBookingRealtime(ownerId: string, onRefresh: () => void) {
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!ownerId) return
    const sb = createClient()
    const ch = sb
      .channel(`owner-bookings-${ownerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bookings', filter: `owner_id=eq.${ownerId}` },
        () => {
          onRefreshRef.current()
        },
      )
      .subscribe()
    return () => {
      void sb.removeChannel(ch)
    }
  }, [ownerId])
}
