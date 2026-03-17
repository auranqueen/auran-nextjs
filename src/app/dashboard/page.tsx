'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizePosition, positionToDashboardPath, POSITION_STORAGE_KEY } from '@/lib/position'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      const { data } = await supabase.auth.getUser()
      if (!data.user || !stored) {
        router.replace('/')
        return
      }
      router.replace(positionToDashboardPath(stored))
    })()
  }, [router, supabase])

  return null
}
