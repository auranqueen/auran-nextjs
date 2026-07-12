import type { SupabaseClient } from '@supabase/supabase-js'

type Result = { updated: number; eligible: number; skipped: number }

export async function connectTrackAOwnersToSecondBrand(
  db: SupabaseClient,
  params: { hubBrandId: string; secondBrandName: string },
): Promise<Result> {
  const hubBrandId = params.hubBrandId.trim()
  const secondBrandName = params.secondBrandName.trim()
  if (!hubBrandId || !secondBrandName) {
    return { updated: 0, eligible: 0, skipped: 0 }
  }

  const { data: links, error: linkErr } = await db
    .from('brand_owner_links')
    .select('owner_id')
    .eq('brand_id', hubBrandId)
    .eq('status', 'active')

  if (linkErr) throw new Error(linkErr.message)

  const ownerIds = Array.from(
    new Set((links || []).map((l) => String(l.owner_id)).filter(Boolean)),
  )
  if (!ownerIds.length) return { updated: 0, eligible: 0, skipped: 0 }

  const { data: trackAOwners, error: userErr } = await db
    .from('users')
    .select('id, auth_id')
    .in('id', ownerIds)
    .eq('role', 'owner')
    .eq('origin_track', 'A')

  if (userErr) throw new Error(userErr.message)

  const eligible = trackAOwners?.length ?? 0
  if (!eligible) return { updated: 0, eligible: 0, skipped: ownerIds.length }

  const authIds = (trackAOwners || [])
    .map((u) => String(u.auth_id || ''))
    .filter(Boolean)

  if (!authIds.length) return { updated: 0, eligible: 0, skipped: ownerIds.length }

  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('auth_id, trade_brands')
    .in('auth_id', authIds)

  if (profErr) throw new Error(profErr.message)

  let updated = 0
  for (const p of profiles || []) {
    const authId = String(p.auth_id || '')
    if (!authId) continue

    const current = Array.isArray(p.trade_brands)
      ? p.trade_brands.map(String).filter(Boolean)
      : []

    if (current.includes(secondBrandName)) continue

    const { error } = await db
      .from('profiles')
      .update({ trade_brands: [...current, secondBrandName] })
      .eq('auth_id', authId)

    if (!error) updated += 1
  }

  return {
    updated,
    eligible,
    skipped: ownerIds.length - updated,
  }
}
