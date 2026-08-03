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
    .limit(1)
  return { allowed: Boolean(owned && owned.length > 0), brandIds }
}
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const productId = typeof body?.product_id === 'string' ? body.product_id.trim() : ''
  const isTierCatalog = Boolean(body?.is_tier_catalog)
  if (!companyId || !productId) {
    return NextResponse.json({ ok: false, error: 'missing_ids' }, { status: 400 })
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
  const { data: product } = await supabase
    .from('brand_products')
    .select('id, brand_id')
    .eq('id', productId)
    .maybeSingle()
  if (!product?.id || !brandIds.includes(String(product.brand_id))) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  const { error } = await db
    .from('brand_products')
    .update({ is_tier_catalog: isTierCatalog })
    .eq('id', productId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}