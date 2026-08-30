import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

async function assertCompanyAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  companyId: string,
) {
  const { data: companyBrands } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
  const brandIds = (companyBrands || []).map((b: { id: string }) => b.id)
  if (brandIds.length === 0) return { allowed: false, brandIds: [] as string[] }
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return { allowed: true, brandIds }
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return { allowed: Boolean(owned?.id), brandIds }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const companyId = (req.nextUrl.searchParams.get('company_id') || '').trim()
  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'missing_company' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const { allowed, brandIds } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const db = tryCreateServiceClient() ?? supabase
  const ownerMap = new Map<string, { owner_id: string; name: string; salon_name: string }>()

  for (const brandId of brandIds) {
    const { data: roster } = await db.rpc('get_brand_owner_roster', { p_brand_id: brandId })
    for (const r of (roster || []) as Array<{
      owner_user_id?: string
      owner_name?: string | null
      full_name?: string | null
      owner_store_name?: string | null
      status?: string
    }>) {
      if (String(r.status || '').toLowerCase() !== 'active') continue
      const oid = String(r.owner_user_id || '').trim()
      if (!oid || ownerMap.has(oid)) continue
      ownerMap.set(oid, {
        owner_id: oid,
        name: String(r.full_name || r.owner_name || '').trim() || '원장님',
        salon_name: String(r.owner_store_name || '').trim() || '-',
      })
    }
  }

  const { data: gradeRows } = await db
    .from('brand_owner_grades')
    .select('owner_id')
    .eq('company_id', companyId)
    .eq('origin_track', 'B')
    .eq('payment_status', 'paid')

  const profileIds = Array.from(
    new Set((gradeRows || []).map((g: { owner_id: string }) => String(g.owner_id)).filter(Boolean)),
  )
  if (profileIds.length) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, auth_id, full_name, owner_store_name')
      .in('id', profileIds)
    const authIds = (profiles || []).map((p: { auth_id?: string | null }) => p.auth_id).filter(Boolean) as string[]
    const { data: users } = authIds.length
      ? await db.from('users').select('id, auth_id, name').in('auth_id', authIds)
      : { data: [] as any[] }
    const userByAuth: Record<string, { id: string; name?: string | null }> = {}
    for (const u of users || []) userByAuth[u.auth_id] = u
    for (const p of profiles || []) {
      const u = p.auth_id ? userByAuth[p.auth_id] : null
      if (!u?.id || ownerMap.has(u.id)) continue
      ownerMap.set(u.id, {
        owner_id: u.id,
        name: String(p.full_name || u.name || '').trim() || '원장님',
        salon_name: String(p.owner_store_name || '').trim() || '-',
      })
    }
  }

  const owners = Array.from(ownerMap.values())
  const ownerIds = owners.map((o) => o.owner_id)
  const channelSet = new Set<string>()
  if (ownerIds.length) {
    const { data: chRows } = await db
      .from('brand_chat_channels')
      .select('owner_id')
      .eq('company_id', companyId)
      .in('owner_id', ownerIds)
    for (const c of chRows || []) channelSet.add(String((c as { owner_id: string }).owner_id))
  }

  if (ownerIds.length) {
    const { data: salons } = await db.from('salons').select('owner_id, name').in('owner_id', ownerIds)
    const salonByOwner: Record<string, string> = {}
    for (const s of salons || []) {
      if (s.owner_id && !salonByOwner[s.owner_id]) salonByOwner[s.owner_id] = s.name || ''
    }
    for (const o of owners) {
      if ((!o.salon_name || o.salon_name === '-') && salonByOwner[o.owner_id]) {
        o.salon_name = salonByOwner[o.owner_id]
      }
    }
  }

  owners.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  return NextResponse.json({
    ok: true,
    owners: owners.map((o) => ({
      owner_id: o.owner_id,
      name: o.name,
      salon_name: o.salon_name,
      has_channel: channelSet.has(o.owner_id),
    })),
  })
}