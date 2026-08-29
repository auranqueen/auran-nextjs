import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { assertStaffPermission } from '@/lib/brand/assertStaffPermission'

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

  const sessionId = (req.nextUrl.searchParams.get('session_id') || '').trim()
  const staffId = (req.nextUrl.searchParams.get('staff_id') || '').trim()
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: session, error: sessionErr } = await db
    .from('education_sessions')
    .select('id, company_id')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionErr || !session) {
    return NextResponse.json({ ok: false, error: 'session_not_found' }, { status: 404 })
  }

  const companyId = String(session.company_id)
  const { allowed } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const staffAllowed = await assertStaffPermission(supabase, staffId || null, companyId, 'education_manage')
  if (!staffAllowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_permission' }, { status: 403 })
  }

  const { data: apps, error } = await db
    .from('education_applications')
    .select('id, owner_id, applied_at')
    .eq('session_id', sessionId)
    .eq('status', 'applied')
    .order('applied_at', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const ownerIds = Array.from(new Set((apps || []).map((a: { owner_id: string }) => String(a.owner_id))))
  const nameMap: Record<string, { name: string | null; salon_name: string | null }> = {}
  if (ownerIds.length > 0) {
    const { data: users } = await db.from('users').select('id, name, salon_name').in('id', ownerIds)
    for (const u of users || []) {
      const row = u as { id: string; name?: string | null; salon_name?: string | null }
      nameMap[row.id] = { name: row.name ?? null, salon_name: row.salon_name ?? null }
    }
  }

  const applications = (apps || []).map((a: { id: string; owner_id: string; applied_at: string }) => ({
    id: a.id,
    owner_id: a.owner_id,
    applied_at: a.applied_at,
    owner_name: nameMap[a.owner_id]?.name ?? null,
    salon_name: nameMap[a.owner_id]?.salon_name ?? null,
  }))

  return NextResponse.json({ ok: true, applications })
}