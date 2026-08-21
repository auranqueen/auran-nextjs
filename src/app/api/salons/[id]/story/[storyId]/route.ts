import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: { id: string; storyId: string } },
) {
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const salonId = params.id
  const storyId = params.storyId

  const { data: story, error } = await service
    .from('brand_product_salon_story')
    .select(
      'id, salon_id, story_type, title, content, banner_image_url_pc, banner_image_url_mobile, is_published, created_at, updated_at',
    )
    .eq('id', storyId)
    .eq('salon_id', salonId)
    .eq('is_published', true)
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 500 })
  if (!story) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const { data: salon } = await service.from('salons').select('id, name').eq('id', salonId).maybeSingle()

  let products: Array<{
    id: string
    brand_id: string
    name: string
    thumb_img: string | null
    consumer_price: number | null
    customer_toast_rate: number | null
  }> = []

  if (story.story_type === 'homecare') {
    const { data: links } = await service
      .from('brand_product_salon_story_products')
      .select('brand_product_id, display_order')
      .eq('story_id', storyId)
      .order('display_order', { ascending: true })

    const productIds = ((links as any[]) || []).map((l) => String(l.brand_product_id)).filter(Boolean)
    if (productIds.length) {
      const { data: rows } = await service
        .from('brand_products')
        .select('id, brand_id, name, thumb_img, consumer_price, customer_toast_rate')
        .in('id', productIds)
        .eq('status', 'active')

      products = productIds
        .map((pid) => ((rows as any[]) || []).find((r) => String(r.id) === pid))
        .filter(Boolean)
        .map((r: any) => ({
          id: String(r.id),
          brand_id: String(r.brand_id),
          name: String(r.name || ''),
          thumb_img: r.thumb_img ?? null,
          consumer_price: r.consumer_price != null ? Number(r.consumer_price) : null,
          customer_toast_rate: r.customer_toast_rate != null ? Number(r.customer_toast_rate) : null,
        }))
    }
  }

  return NextResponse.json({
    ok: true,
    story,
    salon: salon ? { id: String(salon.id), name: String(salon.name || '살롱') } : { id: salonId, name: '살롱' },
    products,
  })
}
