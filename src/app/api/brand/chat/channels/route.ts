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
  if (brandIds.length === 0) return { allowed: false }
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return { allowed: true }
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return { allowed: Boolean(owned?.id) }
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

  const { allowed } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const db = tryCreateServiceClient() ?? supabase

  const { data: channels, error } = await db
    .from('brand_chat_channels')
    .select('id, company_id, owner_id, last_message, last_message_at, unread_by_brand, unread_by_owner')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const list = channels || []
  const ownerIds = list.map((c: { owner_id: string }) => c.owner_id).filter(Boolean)
  if (ownerIds.length === 0) {
    return NextResponse.json({ ok: true, channels: [] })
  }

  const { data: users } = await db.from('users').select('id, name, auth_id').in('id', ownerIds)
  const authIds = (users || []).map((u: { auth_id?: string | null }) => u.auth_id).filter(Boolean) as string[]
  const { data: profiles } = authIds.length
    ? await db.from('profiles').select('id, auth_id, full_name, owner_store_name').in('auth_id', authIds)
    : { data: [] as any[] }
  const { data: salons } = await db.from('salons').select('owner_id, name').in('owner_id', ownerIds)

  const profileByAuth: Record<string, any> = {}
  for (const p of profiles || []) profileByAuth[p.auth_id] = p
  const userById: Record<string, any> = {}
  for (const u of users || []) userById[u.id] = u
  const salonByOwner: Record<string, string> = {}
  for (const s of salons || []) {
    if (s.owner_id && !salonByOwner[s.owner_id]) salonByOwner[s.owner_id] = s.name || ''
  }

  const profileIds = (profiles || []).map((p: { id: string }) => p.id)
  const [{ data: grades }, { data: arete }, { data: points }] = await Promise.all([
    profileIds.length
      ? db.from('brand_owner_grades').select('owner_id, grade').eq('company_id', companyId).in('owner_id', profileIds)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length
      ? db.from('brand_arete_members').select('owner_id').eq('company_id', companyId).eq('status', 'active').in('owner_id', profileIds)
      : Promise.resolve({ data: [] as any[] }),
    profileIds.length
      ? db.from('brand_points').select('owner_id, track, balance').eq('company_id', companyId).in('owner_id', profileIds).in('track', ['REWARD', 'ARETE'])
      : Promise.resolve({ data: [] as any[] }),
  ])

  const gradeMap: Record<string, string> = {}
  for (const g of grades || []) gradeMap[g.owner_id] = g.grade
  const areteSet = new Set((arete || []).map((a: { owner_id: string }) => a.owner_id))
  const rewardMap: Record<string, number> = {}
  const aretePtMap: Record<string, number> = {}
  for (const p of points || []) {
    if (p.track === 'REWARD') rewardMap[p.owner_id] = Number(p.balance || 0)
    if (p.track === 'ARETE') aretePtMap[p.owner_id] = Number(p.balance || 0)
  }

  const enriched = list.map((ch: any) => {
    const u = userById[ch.owner_id]
    const prof = u?.auth_id ? profileByAuth[u.auth_id] : null
    const pid = prof?.id || ''
    return {
      id: ch.id,
      company_id: ch.company_id,
      owner_id: ch.owner_id,
      profile_id: pid || null,
      last_message: ch.last_message,
      last_message_at: ch.last_message_at,
      unread_by_brand: Number(ch.unread_by_brand || 0),
      unread_by_owner: Number(ch.unread_by_owner || 0),
      owner_name: prof?.full_name || u?.name || '원장님',
      salon_name: salonByOwner[ch.owner_id] || prof?.owner_store_name || '-',
      grade: pid ? gradeMap[pid] || null : null,
      is_arete: pid ? areteSet.has(pid) : false,
      reward_points: pid ? rewardMap[pid] || 0 : 0,
      arete_points: pid ? aretePtMap[pid] || 0 : 0,
    }
  })

  return NextResponse.json({ ok: true, channels: enriched })
}
