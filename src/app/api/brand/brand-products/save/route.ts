import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { resolveBrandOriginCountry } from '@/lib/brand/brandOrigin'
import { assertStaffPermission } from '@/lib/brand/assertStaffPermission'
import {
  buildEventBanner,
  stringArrayOrEmpty,
  type BrandProductEventBanner,
} from '@/lib/brand/brandProductTypes'

type Body = {
  id?: string
  brand_id?: string
  staff_id?: string | null
  name?: string
  supply_price?: number
  consumer_price?: number
  description?: string | null
  thumb_img?: string | null
  images?: string[]
  status?: string
  category_id?: string | null
  category?: string | null
  tag?: string | null
  event_banner?: BrandProductEventBanner | null
  ingredient_main?: string | null
  ingredient_full?: string | null
  detail_content?: string | null
  detail_images?: string[]
  skin_concern?: string[]
  skin_type?: string[]
  origin_country?: string
}

async function assertBrandAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  brandId: string,
) {
  const { data: member } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .eq('brand_id', brandId)
    .maybeSingle()

  if (member?.brand_id) return true

  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userPk)
    .maybeSingle()

  return Boolean(owned?.id)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Body
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 })

  const brandId = typeof body.brand_id === 'string' ? body.brand_id.trim() : ''
  if (!brandId) return NextResponse.json({ ok: false, error: 'missing_brand_id' }, { status: 400 })

  const supplyPrice = Math.max(0, Math.trunc(Number(body.supply_price) || 0))
  const consumerPrice = Math.max(0, Math.trunc(Number(body.consumer_price) || 0))
  const status = ['pending', 'active', 'hidden', 'discontinued'].includes(String(body.status))
    ? String(body.status)
    : 'pending'
  if (status === 'active' && consumerPrice <= 0) {
    return NextResponse.json({ ok: false, error: 'consumer_price_required' }, { status: 400 })
  }

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const allowed = await assertBrandAccess(supabase, me.id, brandId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_brand' }, { status: 403 })
  }

  const { data: brandForCompany } = await supabase.from('brands').select('company_id, user_id').eq('id', brandId).maybeSingle()
  const isBrandOwner = brandForCompany?.user_id === me.id
  if (!isBrandOwner) {
    const staffId = typeof body.staff_id === 'string' ? body.staff_id : null
    if (!staffId || !brandForCompany?.company_id) {
      return NextResponse.json({ ok: false, error: 'forbidden_no_permission' }, { status: 403 })
    }
    const hasPermission = await assertStaffPermission(supabase, staffId, brandForCompany.company_id, 'product_manage')
    if (!hasPermission) {
      return NextResponse.json({ ok: false, error: 'forbidden_no_permission' }, { status: 403 })
    }
  }

  const { data: brandRow } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .maybeSingle()

  if (!brandRow?.id) {
    return NextResponse.json({ ok: false, error: 'brand_not_found' }, { status: 404 })
  }

  const originCountry = resolveBrandOriginCountry(brandRow.name)
  const now = new Date().toISOString()

  const row = {
    brand_id: brandRow.id,
    brand_user_id: me.id,
    name: name.slice(0, 100),
    supply_price: supplyPrice,
    consumer_price: consumerPrice,
    origin_country: originCountry,
    status,
    thumb_img: body.thumb_img ?? null,
    images: Array.isArray(body.images) ? body.images.filter((x) => typeof x === 'string') : [],
    description: typeof body.description === 'string' ? body.description.trim() || null : null,
    category_id: body.category_id || null,
    category: typeof body.category === 'string' ? body.category.trim() || null : null,
    tag: typeof body.tag === 'string' ? body.tag.trim() || null : null,
    event_banner: body.event_banner ? buildEventBanner(body.event_banner) : null,
    ingredient_main: typeof body.ingredient_main === 'string' ? body.ingredient_main.trim() || null : null,
    ingredient_full: typeof body.ingredient_full === 'string' ? body.ingredient_full.trim() || null : null,
    detail_content: typeof body.detail_content === 'string' ? body.detail_content || null : null,
    detail_images: stringArrayOrEmpty(body.detail_images),
    skin_concern: stringArrayOrEmpty(body.skin_concern),
    skin_type: stringArrayOrEmpty(body.skin_type),
    updated_at: now,
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  if (body.id) {
    const { data: existing } = await supabase
      .from('brand_products')
      .select('id, brand_user_id, brand_id')
      .eq('id', body.id)
      .maybeSingle()

    // 소유자·product_manage 통과 스태프는 동일 브랜드 제품 수정 가능 (brand_user_id 단독 비교 제거)
    if (!existing?.id || existing.brand_id !== brandRow.id) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }

    const { data, error } = await db
      .from('brand_products')
      .update(row)
      .eq('id', body.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, product: data })
  }

  const { data, error } = await db
    .from('brand_products')
    .insert({ ...row, created_at: now })
    .select('*')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, product: data })
}
