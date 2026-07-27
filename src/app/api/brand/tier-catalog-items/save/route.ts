import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
type Body = {
  company_id?: string
  brand_id?: string
  id?: string
  item_name?: string
  item_type?: string
  shop_price?: number
  image_url?: string
  description?: string
}
const VALID_TYPES = ['제품', '기기', '부자재', '기타']
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
  const body = (await req.json().catch(() => ({}))) as Body
  const companyId = typeof body.company_id === 'string' ? body.company_id.trim() : ''
  const brandId = typeof body.brand_id === 'string' ? body.brand_id.trim() : ''
  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const itemName = typeof body.item_name === 'string' ? body.item_name.trim() : ''
  const itemType = typeof body.item_type === 'string' ? body.item_type.trim() : ''
  const shopPrice = Math.trunc(Number(body.shop_price))
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!companyId || !brandId) {
    return NextResponse.json({ ok: false, error: 'missing_ids' }, { status: 400 })
  }
  if (!itemName) {
    return NextResponse.json({ ok: false, error: 'missing_item_name' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(itemType)) {
    return NextResponse.json({ ok: false, error: 'invalid_item_type' }, { status: 400 })
  }
  if (!Number.isFinite(shopPrice) || shopPrice < 0) {
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
  const { allowed, brandIds } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }
  if (!brandIds.includes(brandId)) {
    return NextResponse.json({ ok: false, error: 'brand_not_in_company' }, { status: 400 })
  }
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  if (id) {
    const { data: existing } = await supabase
      .from('brand_tier_catalog_items')
      .select('id, company_id')
      .eq('id', id)
      .maybeSingle()
    if (!existing?.id || String(existing.company_id) !== companyId) {
      return NextResponse.json({ ok: false, error: 'item_not_found' }, { status: 404 })
    }
    const { data, error } = await db
      .from('brand_tier_catalog_items')
      .update({
        brand_id: brandId,
        item_name: itemName.slice(0, 100),
        item_type: itemType,
        shop_price: shopPrice,
        image_url: imageUrl || null,
        description: description.slice(0, 500) || null,
      })
      .eq('id', id)
      .select('id, company_id, brand_id, item_name, item_type, shop_price, image_url, description, is_active')
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }
  const { data, error } = await db
    .from('brand_tier_catalog_items')
    .insert({
      company_id: companyId,
      brand_id: brandId,
      item_name: itemName.slice(0, 100),
      item_type: itemType,
      shop_price: shopPrice,
      image_url: imageUrl || null,
      description: description.slice(0, 500) || null,
    })
    .select('id, company_id, brand_id, item_name, item_type, shop_price, image_url, description, is_active')
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}