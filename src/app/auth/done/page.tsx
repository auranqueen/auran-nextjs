'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { normalizePosition, positionToDashboardPath, POSITION_STORAGE_KEY } from '@/lib/position'
import { createClient } from '@/lib/supabase/client'

function AuthDoneInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/')
        return
      }
      const fromQuery = normalizePosition(params.get('position'))
      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      const position = fromQuery || stored || 'customer'
      localStorage.setItem(POSITION_STORAGE_KEY, position)
      const redirect = params.get('redirect')
      const safeRedirect = redirect && redirect.startsWith('/') ? redirect : null
      router.replace(safeRedirect || positionToDashboardPath(position))
    })()
  }, [params, router, supabase])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
      로그인 처리 중...
    </div>
  )
}

export default function AuthDonePage() {
  return (
    <Suspense>
      <AuthDoneInner />
    </Suspense>
  )
}

