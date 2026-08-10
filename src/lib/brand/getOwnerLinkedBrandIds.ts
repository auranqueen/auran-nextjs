import type { SupabaseClient } from '@supabase/supabase-js'

export type GetOwnerLinkedBrandIdsOptions = {
  /** true면 active + pending (보기 전용). 기본 false = active만 */
  includePending?: boolean
}

/**
 * 원장 본인의 제휴 브랜드 ID 목록.
 * A: brand_owner_links.owner_id = users.id
 * B: brand_owner_grades(paid) → company_id → brands.id (형제 전체)
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
  const idSet = new Set<string>()

  if (userId) {
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
    for (const r of links || []) {
      const bid = String((r as { brand_id: string }).brand_id || '')
      if (bid) idSet.add(bid)
    }
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', id)
    .maybeSingle()

  const profileId = profileRow?.id ? String(profileRow.id) : ''
  if (profileId) {
    const { data: gradeRows } = await supabase
      .from('brand_owner_grades')
      .select('company_id')
      .eq('owner_id', profileId)
      .eq('origin_track', 'B')
      .eq('payment_status', 'paid')

    const companyIds = Array.from(
      new Set((gradeRows || []).map((r: { company_id: string }) => String(r.company_id)).filter(Boolean)),
    )

    if (companyIds.length) {
      const { data: companyBrands } = await supabase
        .from('brands')
        .select('id')
        .in('company_id', companyIds)

      for (const b of companyBrands || []) {
        const bid = String((b as { id: string }).id || '')
        if (bid) idSet.add(bid)
      }
    }
  }

  return Array.from(idSet)
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
