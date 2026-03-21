import { createClient } from '@supabase/supabase-js'

/**
 * Service role — server-only (API routes, scripts). Bypasses RLS.
 * Never import in Client Components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.Supabase_service_key
  if (!url || !key) {
    throw new Error('Missing Supabase service role env (SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export function tryCreateAdminClient() {
  try {
    return createAdminClient()
  } catch {
    return null
  }
}
