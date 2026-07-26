import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * profile_id → profiles.auth_id → users(name/id) → salons.name
 * Same chain as MonthlyOrderAccordion / ShopOrderRanking (logic unchanged).
 */
export async function resolveOwnerSalonNames(
  supabase: SupabaseClient,
  profileIds: string[],
): Promise<{
  ownerNameByProfileId: Record<string, string>
  salonNameByProfileId: Record<string, string>
}> {
  const ownerNameByProfileId: Record<string, string> = {}
  const salonNameByProfileId: Record<string, string> = {}

  const uniqueIds = Array.from(new Set(profileIds.map((id) => String(id || '')).filter(Boolean)))
  if (uniqueIds.length === 0) {
    return { ownerNameByProfileId, salonNameByProfileId }
  }

  // EXACT same chain body as MonthlyOrderAccordion:
  const profileIdToAuthId: Record<string, string> = {}
  const authIdToUserName: Record<string, string> = {}
  const authIdToUserId: Record<string, string> = {}
  const userIdToSalonName: Record<string, string> = {}

  const { data: profRows } = await supabase
    .from('profiles')
    .select('id, auth_id')
    .in('id', uniqueIds)
  for (const p of profRows || []) {
    if (p.id && p.auth_id) profileIdToAuthId[String(p.id)] = String(p.auth_id)
  }
  const authIds = Array.from(new Set(Object.values(profileIdToAuthId)))
  if (authIds.length) {
    const { data: userRows } = await supabase
      .from('users')
      .select('id, auth_id, name')
      .in('auth_id', authIds)
    for (const u of userRows || []) {
      const aid = String((u as { auth_id?: string }).auth_id || '')
      if (!aid) continue
      authIdToUserName[aid] = String((u as { name?: string }).name || '원장')
      authIdToUserId[aid] = String(u.id)
    }
    const userIds = Array.from(new Set(Object.values(authIdToUserId)))
    if (userIds.length) {
      const { data: salonRows } = await supabase
        .from('salons')
        .select('owner_id, name')
        .in('owner_id', userIds)
      for (const s of salonRows || []) {
        const oid = String((s as { owner_id?: string }).owner_id || '')
        if (oid) userIdToSalonName[oid] = String((s as { name?: string }).name || '')
      }
    }
  }

  // Flatten to by-profileId maps (same defaults as call sites)
  for (const pid of uniqueIds) {
    const authId = profileIdToAuthId[pid] || ''
    const userId = authId ? authIdToUserId[authId] || '' : ''
    if (authId && authIdToUserName[authId]) {
      ownerNameByProfileId[pid] = authIdToUserName[authId]
    }
    if (userId && userIdToSalonName[userId]) {
      salonNameByProfileId[pid] = userIdToSalonName[userId]
    }
  }

  return { ownerNameByProfileId, salonNameByProfileId }
}
