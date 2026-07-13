import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedOwnerIds = {
  userId: string
  profileId: string
}

/** auth_id → users.id + profiles.id (brand_owner_links.owner_id = userId) */
export async function resolveOwnerIds(
  supabase: SupabaseClient,
  authId: string,
): Promise<ResolvedOwnerIds | null> {
  const id = authId.trim()
  if (!id) return null

  const [{ data: userRow }, { data: profileRow }] = await Promise.all([
    supabase.from('users').select('id').eq('auth_id', id).maybeSingle(),
    supabase.from('profiles').select('id').eq('auth_id', id).maybeSingle(),
  ])

  const userId = userRow?.id ? String(userRow.id) : ''
  const profileId = profileRow?.id ? String(profileRow.id) : ''
  if (!userId || !profileId) return null

  return { userId, profileId }
}
