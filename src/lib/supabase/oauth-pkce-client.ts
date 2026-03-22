'use client'

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

/** GoTrue PKCE 저장 키 — getOAuthPkceClient() 와 동일해야 exchangeCodeForSession 이 읽음 */
export const OAUTH_PKCE_STORAGE_KEY = 'auran.oauth.pkce'

let oauthClient: SupabaseClient | null = null

const immediateLock = async <R,>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn()

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(): string {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  return base64UrlEncode(a.buffer)
}

async function sha256Base64Url(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(hash)
}

/**
 * signInWithOAuth 는 환경에 따라 영구 대기할 수 있어,
 * PKCE + /auth/v1/authorize URL 을 직접 만들고 즉시 이동한다.
 */
export async function navigateToSupabaseOAuthRedirect(params: {
  provider: 'kakao' | 'google'
  redirectTo: string
  scopes?: string
}): Promise<void> {
  if (typeof window === 'undefined') throw new Error('browser-only')

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!rawUrl || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.')
  }

  const base = rawUrl.replace(/\/$/, '')
  const verifier = randomVerifier()
  const challenge = await sha256Base64Url(verifier)
  const verifierKey = `${OAUTH_PKCE_STORAGE_KEY}-code-verifier`

  try {
    window.localStorage.setItem(verifierKey, verifier)
  } catch {
    throw new Error('로컬 저장소를 사용할 수 없습니다. 사생활 보호 모드를 끄고 다시 시도해주세요.')
  }

  const u = new URL(`${base}/auth/v1/authorize`)
  u.searchParams.set('provider', params.provider)
  u.searchParams.set('redirect_to', params.redirectTo)
  u.searchParams.set('code_challenge', challenge)
  u.searchParams.set('code_challenge_method', 's256')
  u.searchParams.set('apikey', anon)
  if (params.scopes) u.searchParams.set('scopes', params.scopes)

  const target = u.toString()
  console.log('[oauth] navigate authorize', { provider: params.provider, origin: base })
  window.location.replace(target)
}

/**
 * 카카오/구글 OAuth + PKCE 교환 전용 클라이언트 (code_verifier 는 위와 동일 키의 localStorage).
 */
export function getOAuthPkceClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getOAuthPkceClient is browser-only')
  }
  if (oauthClient) return oauthClient
  oauthClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        storage: window.localStorage,
        storageKey: OAUTH_PKCE_STORAGE_KEY,
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        lock: immediateLock,
      },
    }
  )
  return oauthClient
}

/** PKCE 교환 후 메인 앱(SSR 쿠키 세션)과 동기화 */
export async function syncOAuthSessionToMain(session: {
  access_token: string
  refresh_token: string
}): Promise<void> {
  const { createClient } = await import('@/lib/supabase/client')
  const main = createClient()
  const { error } = await main.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })
  if (error) throw error
}
