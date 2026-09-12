import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

type Body = {
  company_id?: string
  id?: string
}

type SupabaseServer = ReturnType<typeof createClient>

async function listAccessibleCompanyIds(supabase: SupabaseServer, userPk: string): Promise<string[]> {
  const { data: owned } = await supabase.from('brands').select('company_id').eq('user_id', userPk)
  const { data: memberRows } = await supabase.from('brand_members').select('brand_id').eq('user_id', userPk)
  const memberBrandIds = (memberRows || []).map((r: { brand_id: string }) => String(r.brand_id)).filter(Boolean)
  let memberCompanies: { company_id?: string | null }[] = []
  if (memberBrandIds.length > 0) {
    const { data } = await supabase.from('brands').select('company_id').in('id', memberBrandIds)
    memberCompanies = (data || []) as { company_id?: string | null }[]
  }
  const ids = new Set<string>()
  for (const row of [...(owned || []), ...memberCompanies] as { company_id?: string | null }[]) {
    if (row.company_id) ids.add(String(row.company_id))
  }
  return Array.from(ids)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Body
  const packageId = typeof body.id === 'string' ? body.id.trim() : ''
  if (!packageId) {
    return NextResponse.json({ ok: false, error: 'missing_package_id' }, { status: 400 })
  }

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const allowedCompanyIds = await listAccessibleCompanyIds(supabase, me.id)
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: existing } = await db
    .from('brand_tier_packages')
    .select('id, company_id')
    .eq('id', packageId)
    .maybeSingle()

  const companyId = existing?.company_id ? String(existing.company_id) : ''
  if (!existing?.id || !companyId || !allowedCompanyIds.includes(companyId)) {
    return NextResponse.json({ ok: false, error: 'package_not_found' }, { status: 404 })
  }

  const { count: assignedCount } = await db
    .from('brand_owner_grades')
    .select('*', { count: 'exact', head: true })
    .eq('tier_package_id', packageId)

  const { count: orderCount } = await db
    .from('brand_tier_orders')
    .select('*', { count: 'exact', head: true })
    .eq('tier_package_id', packageId)

  const inUse = (assignedCount || 0) > 0 || (orderCount || 0) > 0
  if (inUse) {
    const { error } = await db
      .from('brand_tier_packages')
      .update({ is_active: false })
      .eq('id', packageId)
      .eq('company_id', companyId)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, action: 'deactivated' as const })
  }

  await db.from('brand_tier_kit_items').delete().eq('tier_package_id', packageId).eq('company_id', companyId)
  await db.from('brand_tier_promo_rules').delete().eq('tier_package_id', packageId)

  const { error } = await db
    .from('brand_tier_packages')
    .delete()
    .eq('id', packageId)
    .eq('company_id', companyId)
  if (error) {
    if (error.code === '23503') {
      const { error: deactErr } = await db
        .from('brand_tier_packages')
        .update({ is_active: false })
        .eq('id', packageId)
        .eq('company_id', companyId)
      if (deactErr) {
        return NextResponse.json({ ok: false, error: deactErr.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, action: 'deactivated' as const })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action: 'deleted' as const })
}
