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

  let primaryOwners = Array.from(ownerMap.values())
  if (targetGrades !== 'all') {
    const grades = targetGrades.map((g) => g.trim()).filter(Boolean)
    if (grades.length === 0) return []
    const profileIds = primaryOwners.map((o) => o.profile_id)
    if (profileIds.length > 0) {
      const { data: gradeRows } = await supabase
        .from('brand_owner_grades')
        .select('owner_id, grade')
        .eq('company_id', cid)
        .eq('origin_track', 'A')
        .in('grade', grades)
        .in('owner_id', profileIds)
      const allowed = new Set((gradeRows || []).map((row: { owner_id: string }) => String(row.owner_id)))
      primaryOwners = primaryOwners.filter((o) => allowed.has(o.profile_id))
    } else {
      primaryOwners = []
    }
  }

  const existingProfileIds = new Set(primaryOwners.map((o) => o.profile_id))

  let gradeQuery = supabase
    .from('brand_owner_grades')
    .select('owner_id')
    .eq('company_id', cid)
    .eq('origin_track', 'A')

  if (targetGrades !== 'all') {
    const grades = targetGrades.map((g) => g.trim()).filter(Boolean)
    gradeQuery = gradeQuery.in('grade', grades)
  }

  const { data: gradeOnlyRows } = await gradeQuery
  const extraProfileIds = Array.from(
    new Set(
      (gradeOnlyRows || [])
        .map((row: { owner_id: string }) => String(row.owner_id || '').trim())
        .filter((id) => id && !existingProfileIds.has(id)),
    ),
  )

  const extraOwners: ResolvedOwner[] = []
  if (extraProfileIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, auth_id')
      .in('id', extraProfileIds)

    const authIds = Array.from(
      new Set(
        (profileRows || [])
          .map((p: { auth_id?: string | null }) => String(p.auth_id || '').trim())
          .filter(Boolean),
      ),
    )

    const authToUserId = new Map<string, string>()
    if (authIds.length > 0) {
      const { data: userRows } = await supabase
        .from('users')
        .select('id, auth_id')
        .in('auth_id', authIds)
      for (const u of userRows || []) {
        const authId = String((u as { auth_id?: string }).auth_id || '').trim()
        const userId = String((u as { id?: string }).id || '').trim()
        if (authId && userId) authToUserId.set(authId, userId)
      }
    }

    for (const p of profileRows || []) {
      const profileId = String((p as { id?: string }).id || '').trim()
      const authId = String((p as { auth_id?: string | null }).auth_id || '').trim()
      const ownerUserId = authId ? authToUserId.get(authId) : undefined
      if (profileId && ownerUserId) {
        extraOwners.push({ owner_user_id: ownerUserId, profile_id: profileId })
      }
    }
  }

  const byProfile = new Map<string, ResolvedOwner>()
  for (const o of [...primaryOwners, ...extraOwners]) {
    if (!byProfile.has(o.profile_id)) byProfile.set(o.profile_id, o)
  }
  return Array.from(byProfile.values())
}
