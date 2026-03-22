'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getOAuthPkceClient, syncOAuthSessionToMain } from '@/lib/supabase/oauth-pkce-client'

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
      router.replace(`/login?error=${encodeURIComponent(err)}`)
      return
    }

    const code = params.get('code')
    const role = params.get('role') || 'customer'
    const redirect = params.get('redirect') || ''

    if (!code) {
      router.replace('/login?error=auth_failed')
      return
    }

    let cancelled = false
    ;(async () => {
      const oauth = getOAuthPkceClient()
      const { data: exData, error: exErr } = await oauth.auth.exchangeCodeForSession(code)
      if (cancelled) return
      if (exErr) {
        console.error('[auth/exchange] exchangeCodeForSession:', exErr)
        router.replace(`/login?error=${encodeURIComponent(exErr.message || 'auth_failed')}`)
        return
      }
      const session = exData?.session
      if (!session?.access_token || !session.refresh_token) {
        console.error('[auth/exchange] 세션 없음', exData)
        router.replace('/login?error=auth_failed')
        return
      }
      try {
        await syncOAuthSessionToMain({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
      } catch (syncErr) {
        console.error('[auth/exchange] syncOAuthSessionToMain:', syncErr)
        router.replace('/login?error=auth_failed')
        return
      }

      const qs = new URLSearchParams({ position: role })
      if (redirect.startsWith('/')) qs.set('redirect', redirect)
      const res = await fetch(`/api/auth/callback/complete?${qs.toString()}`, { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[auth/exchange] callback/complete:', j)
        router.replace('/login?error=auth_failed')
        return
      }
      const pos = typeof j.position === 'string' ? j.position : role
      let url = `/auth/done?position=${encodeURIComponent(pos)}`
      if (redirect.startsWith('/')) url += `&redirect=${encodeURIComponent(redirect)}`
      window.location.replace(url)
    })().catch((e) => {
      console.error('[auth/exchange]', e)
      if (!cancelled) router.replace('/login?error=auth_failed')
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
