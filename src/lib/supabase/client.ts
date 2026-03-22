import { createBrowserClient } from '@supabase/ssr'
import type { LockFunc } from '@supabase/auth-js'

/**
 * Web Locks(navigator.locks) + React Strict Mode / 다중 탭에서 세션 락이 풀리지 않으면
 * signInWithOAuth·exchangeCodeForSession 이 영구 대기할 수 있음 → OAuth만 즉시 실행.
 */
const immediateLock: LockFunc = async (_name, _acquireTimeout, fn) => fn()

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      lock: immediateLock,
      lockAcquireTimeout: 2000,
    },
  })
}
