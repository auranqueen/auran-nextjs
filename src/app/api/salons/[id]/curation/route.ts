import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: banner } = await service
    .from('brand_product_salon_banner')
    .select('image_url_mobile, image_url_pc, link_url')
    .eq('salon_id', params.id)
    .eq('is_active', true)
    .maybeSingle()
  const { data: curationRows } = await service
    .from('brand_product_salon_display')
    .select('brand_product_id, display_order')
    .eq('salon_id', params.id)
    .eq('is_featured', true)
    .order('display_order', { ascending: true })
  const productIds = (curationRows || []).map(r => r.brand_product_id)
  const { data: products } = productIds.length > 0
    ? await service
        .from('brand_products')
        .select('id, name, thumb_img, consumer_price')
        .in('id', productIds)
        .eq('status', 'active')
    : { data: [] }
  const orderedProducts = productIds
    .map(id => (products || []).find(p => p.id === id))
    .filter(Boolean)
  return NextResponse.json({ ok: true, banner: banner || null, products: orderedProducts })
}
