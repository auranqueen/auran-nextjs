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
  if (brandIds.length === 0) return false
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return true
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return Boolean(owned?.id)
}
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  if (!id || !companyId) {
    return NextResponse.json({ ok: false, error: 'missing_ids' }, { status: 400 })
  }
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }
  const allowed = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }
  const staffId = typeof body?.staff_id === 'string' ? body.staff_id.trim() : ''
  const staffAllowed = await assertStaffPermission(supabase, staffId || null, companyId, 'marketing_create')
  if (!staffAllowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_permission' }, { status: 403 })
  }
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  const { error } = await db
    .from('hq_forced_campaigns')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)
    .is('owner_id', null)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
