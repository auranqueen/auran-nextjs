'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * PKCE code_verifier 는 로그인 시 localStorage 전용 클라이언트에 저장됨 → 같은 클라이언트로 교환 후
 * 메인 쿠키 세션으로 setSession 동기화.
 */
function AuthExchangeInner() {
  const router = useRouter()
  const params = useSearchParams()
  useEffect(() => {
    const err =
      params.get('error') ||
      params.get('error_description') ||
      ''
    if (err) {
      router.replace('/home')
      return
    }

    const code = params.get('code')
    const role = params.get('role') || 'customer'
    const redirect = params.get('redirect') || ''

    if (!code) {
      router.replace('/home')
      return
    }

    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: exData, error: exErr } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return
      if (exErr || !exData?.session) {
        router.replace('/home')
        return
      }
      let url = `/auth/done?position=${encodeURIComponent(role)}`
      if (redirect.startsWith('/')) url += `&redirect=${encodeURIComponent(redirect)}`
      window.location.replace(url)
    })().catch((e) => {
      console.error('[auth/exchange]', e)
      if (!cancelled) router.replace('/home')
    })

    return () => {
      cancelled = true
    }
  }, [params, router])

  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 14 }}>
      로그인 처리 중…
    </div>
  )
}

export default function AuthExchangePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
          로그인 처리 중…
        </div>
      }
    >
      <AuthExchangeInner />
    </Suspense>
  )
}
