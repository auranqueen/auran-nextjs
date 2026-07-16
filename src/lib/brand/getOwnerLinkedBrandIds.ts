import type { SupabaseClient } from '@supabase/supabase-js'

export type GetOwnerLinkedBrandIdsOptions = {
  /** true면 active + pending (보기 전용). 기본 false = active만 */
  includePending?: boolean
}

/**
 * 원장 본인의 제휴 브랜드 ID 목록.
 * brand_owner_links.owner_id = users.id (profiles.id 아님)
 */
export async function getOwnerLinkedBrandIds(
  supabase: SupabaseClient,
  authId: string,
  options?: GetOwnerLinkedBrandIdsOptions,
): Promise<string[]> {
  const id = authId.trim()
  if (!id) return []

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', id)
    .maybeSingle()

  const userId = userRow?.id ? String(userRow.id) : ''
  if (!userId) return []

  let query = supabase
    .from('brand_owner_links')
    .select('brand_id')
    .eq('owner_id', userId)

  if (options?.includePending) {
    query = query.in('status', ['active', 'pending'])
  } else {
    query = query.eq('status', 'active')
  }

  const { data: links } = await query

  return Array.from(
    new Set((links || []).map((r: { brand_id: string }) => String(r.brand_id)).filter(Boolean)),
  )
}
