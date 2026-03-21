'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * 앱 전역: 세션 복원·토큰 갱신 구독. 로그아웃 시 로그인으로 이동.
 */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    void supabase.auth.getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_OUT') {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          router.replace('/login')
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  return <>{children}</>
}
