import { createBrowserClient } from '@supabase/ssr'
import type { LockFunc } from '@supabase/auth-js'
import type { SupabaseClient } from '@supabase/supabase-js'
/**
 * Web Locks(navigator.locks) + React Strict Mode / 다중 탭에서 세션 락이 풀리지 않으면
 * signInWithOAuth·exchangeCodeForSession 이 영구 대기할 수 있음 → OAuth만 즉시 실행.
 */
const immediateLock: LockFunc = async (_name, _acquireTimeout, fn) => fn()
let cachedClient: SupabaseClient | null = null
/**
 * 싱글턴: 브라우저 세션 안에서 항상 같은 인스턴스를 반환.
 * (React 컴포넌트의 useEffect/useCallback 의존성 배열에 supabase를 넣어도
 *  매 렌더마다 새 인스턴스가 생겨 무한 재실행되는 문제를 원천 차단)
 */
export function createClient() {
  if (cachedClient) return cachedClient
  cachedClient = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      lock: immediateLock,
      lockAcquireTimeout: 2000,
    },
  })
  return cachedClient
}
