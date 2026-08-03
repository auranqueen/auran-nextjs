import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

type Body = {
  company_id?: string
  id?: string
  tier_name?: string
  price?: number
}

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
    .limit(1)

  return Boolean(owned && owned.length > 0)
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
  const companyId = typeof body.company_id === 'string' ? body.company_id.trim() : ''
  const packageId = typeof body.id === 'string' ? body.id.trim() : ''
  const tierName = typeof body.tier_name === 'string' ? body.tier_name.trim() : ''
  const price = Math.trunc(Number(body.price))

  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'missing_company_id' }, { status: 400 })
  }
  if (!packageId) {
    return NextResponse.json({ ok: false, error: 'missing_package_id' }, { status: 400 })
  }
  if (!tierName) {
    return NextResponse.json({ ok: false, error: 'missing_tier_name' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 1000) {
    return NextResponse.json({ ok: false, error: 'invalid_price' }, { status: 400 })
  }

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const allowed = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const { data: existing } = await supabase
    .from('brand_tier_packages')
    .select('id, company_id')
    .eq('id', packageId)
    .maybeSingle()

  if (!existing?.id || String(existing.company_id) !== companyId) {
    return NextResponse.json({ ok: false, error: 'package_not_found' }, { status: 404 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  // commission_rate는 절대 수정·반환하지 않음
  const { data, error } = await db
    .from('brand_tier_packages')
    .update({
      tier_name: tierName.slice(0, 50),
      price,
    })
    .eq('id', packageId)
    .eq('company_id', companyId)
    .select('id, company_id, tier_name, price, is_active')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, package: data })
}
