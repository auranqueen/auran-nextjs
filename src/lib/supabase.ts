// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// src/lib/supabase/server.ts
// (서버 컴포넌트 / API Route 용)
// import { createServerClient } from '@supabase/ssr'
// import { cookies } from 'next/headers'
// export function createServerSupabase() {
//   const cookieStore = cookies()
//   return createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     { cookies: { get: (n) => cookieStore.get(n)?.value } }
//   )
// }
