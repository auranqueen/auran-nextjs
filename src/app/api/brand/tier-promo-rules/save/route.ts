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
  const { data: member } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .maybeSingle()
  if (member?.brand_id) return { allowed: true, brandIds }
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return { allowed: Boolean(owned?.id), brandIds }
}
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const tierPackageId = typeof body?.tier_package_id === 'string' ? body.tier_package_id.trim() : ''
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id.trim() : ''
  const minQty = Math.trunc(Number(body?.min_qty))
  const bonusQty = Math.trunc(Number(body?.bonus_qty))
  if (!companyId || !tierPackageId || !brandId) {
    return NextResponse.json({ ok: false, error: 'missing_ids' }, { status: 400 })
  }
  if (!Number.isFinite(minQty) || minQty < 1) {
    return NextResponse.json({ ok: false, error: 'invalid_min_qty' }, { status: 400 })
  }
  if (!Number.isFinite(bonusQty) || bonusQty < 1) {
    return NextResponse.json({ ok: false, error: 'invalid_bonus_qty' }, { status: 400 })
  }
  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }
  const { allowed, brandIds } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }
  if (!brandIds.includes(brandId)) {
    return NextResponse.json({ ok: false, error: 'brand_not_in_company' }, { status: 400 })
  }
  const { data: pkg } = await supabase
    .from('brand_tier_packages')
    .select('id, company_id')
    .eq('id', tierPackageId)
    .maybeSingle()
  if (!pkg?.id || String(pkg.company_id) !== companyId) {
    return NextResponse.json({ ok: false, error: 'tier_package_not_found' }, { status: 404 })
  }
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  const { data, error } = await db
    .from('brand_tier_promo_rules')
    .upsert(
      {
        company_id: companyId,
        tier_package_id: tierPackageId,
        brand_id: brandId,
        min_qty: minQty,
        bonus_qty: bonusQty,
      },
      { onConflict: 'tier_package_id,brand_id' },
    )
    .select('id, tier_package_id, brand_id, min_qty, bonus_qty, is_active')
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rule: data })
}
