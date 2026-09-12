import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

type Body = {
  company_id?: string
  id?: string
  tier_name?: string
  price?: number
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

function sessionCompanyId(requested: string, allowed: string[]): string | null {
  if (requested && allowed.includes(requested)) return requested
  if (!requested && allowed.length === 1) return allowed[0]
  return null
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
  const requestedCompanyId = typeof body.company_id === 'string' ? body.company_id.trim() : ''
  const packageId = typeof body.id === 'string' ? body.id.trim() : ''
  const tierName = typeof body.tier_name === 'string' ? body.tier_name.trim().slice(0, 50) : ''
  const price = Math.trunc(Number(body.price))

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

  const allowedCompanyIds = await listAccessibleCompanyIds(supabase, me.id)
  if (allowedCompanyIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  const PACKAGE_SELECT = 'id, company_id, tier_name, price, is_active'

  if (packageId) {
    const { data: existing } = await db
      .from('brand_tier_packages')
      .select('id, company_id')
      .eq('id', packageId)
      .maybeSingle()

    const existingCompanyId = existing?.company_id ? String(existing.company_id) : ''
    if (!existing?.id || !allowedCompanyIds.includes(existingCompanyId)) {
      return NextResponse.json({ ok: false, error: 'package_not_found' }, { status: 404 })
    }

    const { data: dup } = await db
      .from('brand_tier_packages')
      .select('id')
      .eq('company_id', existingCompanyId)
      .eq('tier_name', tierName)
      .neq('id', packageId)
      .maybeSingle()
    if (dup?.id) {
      return NextResponse.json({ ok: false, error: 'duplicate_tier_name' }, { status: 409 })
    }

    // commission_rate는 절대 수정·반환하지 않음
    const { data, error } = await db
      .from('brand_tier_packages')
      .update({
        tier_name: tierName,
        price,
      })
      .eq('id', packageId)
      .eq('company_id', existingCompanyId)
      .select(PACKAGE_SELECT)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ ok: false, error: 'duplicate_tier_name' }, { status: 409 })
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, package: data })
  }

  const companyId = sessionCompanyId(requestedCompanyId, allowedCompanyIds)
  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'missing_company_id' }, { status: 400 })
  }

  const { data: dup } = await db
    .from('brand_tier_packages')
    .select('id')
    .eq('company_id', companyId)
    .eq('tier_name', tierName)
    .maybeSingle()
  if (dup?.id) {
    return NextResponse.json({ ok: false, error: 'duplicate_tier_name' }, { status: 409 })
  }

  const { data: brandRows } = await db
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
    .order('name', { ascending: true })
    .limit(1)
  const brandId = brandRows?.[0]?.id ? String(brandRows[0].id) : ''
  if (!brandId) {
    return NextResponse.json({ ok: false, error: 'no_brand' }, { status: 400 })
  }

  // commission_rate는 insert에도 넣지 않음 — DB 기본값만 사용
  const { data, error } = await db
    .from('brand_tier_packages')
    .insert({
      company_id: companyId,
      brand_id: brandId,
      tier_name: tierName,
      price,
      is_active: true,
    })
    .select(PACKAGE_SELECT)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'duplicate_tier_name' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, package: data })
}
