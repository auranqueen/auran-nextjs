import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SerializeOptions } from 'cookie'

type CookieToSet = { name: string; value: string; options: SerializeOptions }

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 등 쿠키 쓰기 불가 시 무시 (Route Handler에서 재시도)
          }
        },
      },
    }
  )
}
