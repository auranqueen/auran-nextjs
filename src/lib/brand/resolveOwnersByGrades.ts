import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedOwner = { owner_user_id: string; profile_id: string }

export async function resolveOwnersByGrades(
  supabase: SupabaseClient,
  companyId: string,
  targetGrades: string[] | 'all',
): Promise<ResolvedOwner[]> {
  const cid = companyId.trim()
  if (!cid) return []

  const { data: brandRows } = await supabase.from('brands').select('id').eq('company_id', cid)
  const brandIds = ((brandRows || []) as { id: string }[]).map((b) => String(b.id)).filter(Boolean)
  if (brandIds.length === 0) return []

  const ownerMap = new Map<string, ResolvedOwner>()
  for (const brandId of brandIds) {
    const { data: roster } = await supabase.rpc('get_brand_owner_roster', { p_brand_id: brandId })
    for (const r of (roster || []) as Array<{
      owner_user_id?: string
      profile_id?: string | null
      status?: string
    }>) {
      if (String(r.status || '').toLowerCase() !== 'active') continue
      const ownerUserId = String(r.owner_user_id || '').trim()
      const profileId = String(r.profile_id || '').trim()
      if (!ownerUserId || !profileId) continue
      if (!ownerMap.has(ownerUserId)) {
        ownerMap.set(ownerUserId, { owner_user_id: ownerUserId, profile_id: profileId })
      }
    }
  }

  const owners = Array.from(ownerMap.values())
  if (targetGrades === 'all') return owners

  const grades = targetGrades.map((g) => g.trim()).filter(Boolean)
  if (grades.length === 0) return []

  const profileIds = owners.map((o) => o.profile_id)
  if (profileIds.length === 0) return []

  const { data: gradeRows } = await supabase
    .from('brand_owner_grades')
    .select('owner_id, grade')
    .eq('company_id', cid)
    .eq('origin_track', 'A')
    .in('grade', grades)
    .in('owner_id', profileIds)

  const allowed = new Set((gradeRows || []).map((row: { owner_id: string }) => String(row.owner_id)))
  return owners.filter((o) => allowed.has(o.profile_id))
}
