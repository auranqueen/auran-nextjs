import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

type Body = {
  company_id?: string
  tier_package_id?: string
  id?: string
  item_name?: string
  item_type?: string
  qty?: number
  note?: string
}

const VALID_TYPES = ['부자재', '인증패', '진열장', '기타']

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
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as Body
  const companyId = typeof body.company_id === 'string' ? body.company_id.trim() : ''
  const tierPackageId = typeof body.tier_package_id === 'string' ? body.tier_package_id.trim() : ''
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const itemName = typeof body.item_name === 'string' ? body.item_name.trim() : ''
  const itemType = typeof body.item_type === 'string' ? body.item_type.trim() : ''
  const qty = Math.trunc(Number(body.qty))
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!companyId || !tierPackageId) {
    return NextResponse.json({ ok: false, error: 'missing_ids' }, { status: 400 })
  }
  if (!itemName) {
    return NextResponse.json({ ok: false, error: 'missing_item_name' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(itemType)) {
    return NextResponse.json({ ok: false, error: 'invalid_item_type' }, { status: 400 })
  }
  if (!Number.isFinite(qty) || qty < 1) {
    return NextResponse.json({ ok: false, error: 'invalid_qty' }, { status: 400 })
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
  if (id) {
    const { data: existing } = await supabase
      .from('brand_tier_kit_items')
      .select('id, company_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing?.id || String(existing.company_id) !== companyId) {
      return NextResponse.json({ ok: false, error: 'item_not_found' }, { status: 404 })
    }
    const { data, error } = await db
      .from('brand_tier_kit_items')
      .update({ item_name: itemName.slice(0, 100), item_type: itemType, qty, note: note || null })
      .eq('id', id)
      .select('id, company_id, tier_package_id, item_name, item_type, qty, note, is_active')
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }
  const { data, error } = await db
    .from('brand_tier_kit_items')
    .insert({
      company_id: companyId,
      tier_package_id: tierPackageId,
      item_name: itemName.slice(0, 100),
      item_type: itemType,
      qty,
      note: note || null,
    })
    .select('id, company_id, tier_package_id, item_name, item_type, qty, note, is_active')
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}
