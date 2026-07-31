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
  const id = typeof body?.id === 'string' ? body.id.trim() : null
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const badgeText = typeof body?.badge_text === 'string' ? body.badge_text.trim() : null
  const campaignType = typeof body?.campaign_type === 'string' ? body.campaign_type.trim() : ''
  const targetProductIds = Array.isArray(body?.target_product_ids) ? body.target_product_ids.map(String) : []
  const buyQty = body?.buy_qty != null ? Math.trunc(Number(body.buy_qty)) : null
  const bonusQty = body?.bonus_qty != null ? Math.trunc(Number(body.bonus_qty)) : null
  const giftProductId = typeof body?.gift_product_id === 'string' ? body.gift_product_id.trim() : null
  const discountPct = body?.discount_pct != null ? Number(body.discount_pct) : null
  const startAt = typeof body?.start_at === 'string' ? body.start_at : null
  const endAt = typeof body?.end_at === 'string' ? body.end_at : null
  const tiers = Array.isArray(body?.tiers)
    ? body.tiers
        .map((t: any) => ({
          min_qty: Math.trunc(Number(t?.min_qty)) || 0,
          discount_pct: t?.discount_pct != null && t.discount_pct !== '' ? Number(t.discount_pct) : null,
          discount_amount: t?.discount_amount != null && t.discount_amount !== '' ? Math.trunc(Number(t.discount_amount)) : null,
        }))
        .filter((t: any) => t.min_qty > 0 && (t.discount_pct != null || t.discount_amount != null))
    : []
  if (!companyId) return NextResponse.json({ ok: false, error: 'missing_company' }, { status: 400 })
  if (!title) return NextResponse.json({ ok: false, error: 'title_required' }, { status: 400 })
  if (!['bundle', 'gift', 'discount'].includes(campaignType)) {
    return NextResponse.json({ ok: false, error: 'invalid_campaign_type' }, { status: 400 })
  }
  if (targetProductIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'no_products' }, { status: 400 })
  }
  if (!startAt || !endAt) {
    return NextResponse.json({ ok: false, error: 'dates_required' }, { status: 400 })
  }
  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }
  const { allowed, brandIds } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  const { data: productRows } = await db.from('brand_products').select('id, brand_id').in('id', targetProductIds)
  if (!productRows || productRows.length !== targetProductIds.length) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }
  const invalidProduct = productRows.some((p) => !brandIds.includes(String(p.brand_id)))
  if (invalidProduct) {
    return NextResponse.json({ ok: false, error: 'product_outside_company' }, { status: 400 })
  }
  const row: Record<string, unknown> = {
    company_id: companyId,
    owner_id: null,
    title,
    badge_text: badgeText,
    campaign_type: campaignType,
    target_product_ids: targetProductIds,
    buy_qty: buyQty,
    bonus_qty: bonusQty,
    gift_product_id: giftProductId,
    discount_pct: discountPct,
    apply_to_members: false,
    start_at: startAt,
    end_at: endAt,
    is_active: true,
  }
  if (id) row.id = id
  const { data, error } = await db
    .from('hq_forced_campaigns')
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .single()
  if (error || !data?.id) {
    return NextResponse.json({ ok: false, error: error?.message || 'save_failed' }, { status: 500 })
  }
  await db.from('hq_forced_campaign_tiers').delete().eq('campaign_id', data.id)
  if (tiers.length > 0) {
    await db.from('hq_forced_campaign_tiers').insert(
      tiers.map((t: any) => ({ campaign_id: data.id, min_qty: t.min_qty, discount_pct: t.discount_pct, discount_amount: t.discount_amount })),
    )
  }
  return NextResponse.json({ ok: true, id: data.id })
}
