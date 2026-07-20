import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const { data: salon } = await service.from('salons').select('id').eq('owner_id', me.id).maybeSingle()
  if (!salon) return NextResponse.json({ ok: false, error: 'salon_not_found' }, { status: 404 })
  const body = await req.json()
  const { brand_product_id, featured } = body
  if (!brand_product_id || typeof featured !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
  const { data: product } = await service
    .from('brand_products')
    .select('id, brand_id')
    .eq('id', brand_product_id)
    .maybeSingle()
  if (!product) return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  const { data: link } = await service
    .from('brand_owner_links')
    .select('id')
    .eq('owner_id', me.id)
    .eq('brand_id', product.brand_id)
    .eq('status', 'active')
    .maybeSingle()
  if (!link) return NextResponse.json({ ok: false, error: 'brand_not_linked' }, { status: 403 })
  if (featured) {
    const { count } = await service
      .from('brand_product_salon_display')
      .select('id', { count: 'exact', head: true })
      .eq('salon_id', salon.id)
      .eq('is_featured', true)
    if ((count || 0) >= 8) {
      return NextResponse.json({ ok: false, error: 'curation_limit_reached' }, { status: 400 })
    }
    const { error } = await service
      .from('brand_product_salon_display')
      .upsert(
        { salon_id: salon.id, brand_product_id, is_featured: true, display_order: count || 0 },
        { onConflict: 'salon_id,brand_product_id' }
      )
    if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  } else {
    const { error } = await service
      .from('brand_product_salon_display')
      .update({ is_featured: false })
      .eq('salon_id', salon.id)
      .eq('brand_product_id', brand_product_id)
    if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
