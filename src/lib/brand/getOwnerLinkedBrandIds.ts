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

/** active 연결은 없고 pending만 있을 때 브랜드명 목록 (안내 문구용) */
export async function getOwnerPendingOnlyBrandNames(
  supabase: SupabaseClient,
  authId: string,
): Promise<string[]> {
  const activeIds = await getOwnerLinkedBrandIds(supabase, authId)
  if (activeIds.length > 0) return []

  const pendingIds = await getOwnerLinkedBrandIds(supabase, authId, { includePending: true })
  if (pendingIds.length === 0) return []

  const { data: brandRows } = await supabase
    .from('brands')
    .select('id, name')
    .in('id', pendingIds)

  return (brandRows || [])
    .map((b: { name?: string | null }) => String(b.name || '').trim())
    .filter(Boolean)
}

export function formatPendingApprovalNotice(brandNames: string[]): string {
  if (brandNames.length === 0) return ''
  const label = brandNames.join(', ')
  return `${label} 브랜드와 연결 승인 대기 중이에요. 조금만 기달려주세요`
}
