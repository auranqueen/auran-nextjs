import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

type ContentType = 'verified' | 'free' | 'owner'
type LinkType = 'booking' | 'brand_product' | 'product' | 'none'

type Body = {
  content_type?: string
  salon_id?: string | null
  video_url?: string
  link_type?: string
  booking_id?: string | null
  order_item_id?: string | null
  brand_product_id?: string | null
  product_id?: string | null
  title?: string | null
  highlight_tag?: string | null
}

const CONTENT_TYPES: ContentType[] = ['verified', 'free', 'owner']
const OWNER_LINK_TYPES: LinkType[] = ['booking', 'brand_product', 'none']
const FREE_LINK_TYPES: LinkType[] = ['brand_product', 'product', 'none']
const VERIFIED_ORDER_STATUSES = ['배송완료', '구매확정'] as const

function parseOptionalId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Body

  const videoUrl = typeof body.video_url === 'string' ? body.video_url.trim() : ''
  if (!videoUrl) {
    return NextResponse.json({ ok: false, error: 'missing_video_url' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    return NextResponse.json({ ok: false, error: 'missing_title' }, { status: 400 })
  }
  if (title.length > 80) {
    return NextResponse.json({ ok: false, error: 'title_too_long' }, { status: 400 })
  }

  let highlightTag: string | null = null
  if (body.highlight_tag !== undefined && body.highlight_tag !== null) {
    const raw = typeof body.highlight_tag === 'string' ? body.highlight_tag.trim() : ''
    if (raw.length > 40) {
      return NextResponse.json({ ok: false, error: 'highlight_tag_too_long' }, { status: 400 })
    }
    highlightTag = raw || null
  }

  const contentTypeRaw = typeof body.content_type === 'string' ? body.content_type.trim() : 'verified'
  if (!CONTENT_TYPES.includes(contentTypeRaw as ContentType)) {
    return NextResponse.json({ ok: false, error: 'invalid_content_type' }, { status: 400 })
  }
  const contentType = contentTypeRaw as ContentType

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!me?.id) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const row: Record<string, unknown> = {
    content_type: contentType,
    video_url: videoUrl,
    title,
    highlight_tag: highlightTag,
    created_at: now,
    updated_at: now,
  }

  /** verified 제품구매 업로드 시 배송완료 → 구매확정 전환용 */
  let confirmOrderId: string | null = null
  /** 트랙A 주문 조회/확정용 service (order_item 분기에서만 설정) */
  let orderService: NonNullable<ReturnType<typeof tryCreateServiceClient>> | null = null

  if (contentType === 'verified') {
    if (me.role !== 'customer') {
      return NextResponse.json({ ok: false, error: 'customer_only' }, { status: 403 })
    }

    const bookingId = parseOptionalId(body.booking_id)
    const orderItemId = parseOptionalId(body.order_item_id)

    if (!bookingId && !orderItemId) {
      return NextResponse.json({ ok: false, error: 'missing_booking_or_order_item' }, { status: 400 })
    }
    if (bookingId && orderItemId) {
      return NextResponse.json({ ok: false, error: 'booking_and_order_item_exclusive' }, { status: 400 })
    }

    if (bookingId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, salon_id, customer_id, status')
        .eq('id', bookingId)
        .maybeSingle()

      if (!booking?.id || !booking.salon_id) {
        return NextResponse.json({ ok: false, error: 'booking_not_found' }, { status: 400 })
      }
      if (booking.customer_id !== me.id) {
        return NextResponse.json({ ok: false, error: 'forbidden_booking' }, { status: 403 })
      }
      if (booking.status !== 'completed') {
        return NextResponse.json({ ok: false, error: 'booking_not_completed' }, { status: 400 })
      }

      // CTA 자동: 예약 증거 → booking
      row.uploader_type = 'customer'
      row.uploader_user_id = me.id
      row.salon_id = booking.salon_id
      row.booking_id = booking.id
      row.order_item_id = null
      row.link_type = 'booking'
      row.brand_product_id = null
      row.product_id = null
    } else {
      // 트랙A 고객 API(my-orders/confirm)와 동일: RLS 우회 service로만 주문·라인 조회
      const service = tryCreateServiceClient()
      if (!service) {
        return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
      }
      orderService = service

      const { data: item } = await service
        .from('brand_product_order_items')
        .select('id, order_id, brand_product_id')
        .eq('id', orderItemId!)
        .maybeSingle()

      if (!item?.id || !item.order_id || !item.brand_product_id) {
        return NextResponse.json({ ok: false, error: 'order_item_not_found' }, { status: 400 })
      }

      const { data: order } = await service
        .from('brand_product_orders')
        .select('id, customer_id, salon_id, status')
        .eq('id', item.order_id)
        .maybeSingle()

      if (!order?.id || !order.salon_id) {
        return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 400 })
      }
      // RLS 우회 시 유일한 소유권 검증
      if (order.customer_id !== me.id) {
        return NextResponse.json({ ok: false, error: 'forbidden_order' }, { status: 403 })
      }
      if (!VERIFIED_ORDER_STATUSES.includes(order.status as (typeof VERIFIED_ORDER_STATUSES)[number])) {
        return NextResponse.json({ ok: false, error: 'order_not_eligible' }, { status: 400 })
      }

      // CTA 자동: 주문라인 증거 → brand_product
      row.uploader_type = 'customer'
      row.uploader_user_id = me.id
      row.salon_id = order.salon_id
      row.booking_id = null
      row.order_item_id = item.id
      row.link_type = 'brand_product'
      row.brand_product_id = item.brand_product_id
      row.product_id = null

      if (order.status === '배송완료') {
        confirmOrderId = order.id
      }
    }
  } else if (contentType === 'free') {
    if (me.role !== 'customer') {
      return NextResponse.json({ ok: false, error: 'customer_only' }, { status: 403 })
    }

    const linkTypeRaw = typeof body.link_type === 'string' ? body.link_type.trim() : 'none'
    if (!FREE_LINK_TYPES.includes(linkTypeRaw as LinkType)) {
      return NextResponse.json({ ok: false, error: 'invalid_link_type_for_free' }, { status: 400 })
    }
    const linkType = linkTypeRaw as LinkType

    if (parseOptionalId(body.booking_id) || parseOptionalId(body.order_item_id)) {
      return NextResponse.json({ ok: false, error: 'evidence_not_allowed_for_free' }, { status: 400 })
    }

    const brandProductId = parseOptionalId(body.brand_product_id)
    const productId = parseOptionalId(body.product_id)
    if (linkType === 'brand_product') {
      if (!brandProductId) {
        return NextResponse.json({ ok: false, error: 'missing_brand_product_id' }, { status: 400 })
      }
      if (productId) {
        return NextResponse.json({ ok: false, error: 'invalid_link_fields' }, { status: 400 })
      }
    } else if (linkType === 'product') {
      if (!productId) {
        return NextResponse.json({ ok: false, error: 'missing_product_id' }, { status: 400 })
      }
      if (brandProductId) {
        return NextResponse.json({ ok: false, error: 'invalid_link_fields' }, { status: 400 })
      }
    } else if (brandProductId || productId) {
      return NextResponse.json({ ok: false, error: 'invalid_link_fields' }, { status: 400 })
    }

    const salonId = parseOptionalId(body.salon_id)
    if (salonId) {
      const { data: salon } = await supabase
        .from('salons')
        .select('id')
        .eq('id', salonId)
        .maybeSingle()
      if (!salon?.id) {
        return NextResponse.json({ ok: false, error: 'salon_not_found' }, { status: 400 })
      }
    }

    row.uploader_type = 'customer'
    row.uploader_user_id = me.id
    row.salon_id = salonId
    row.booking_id = null
    row.order_item_id = null
    row.link_type = linkType
    row.brand_product_id = linkType === 'brand_product' ? brandProductId : null
    row.product_id = linkType === 'product' ? productId : null
  } else {
    if (me.role !== 'owner') {
      return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
    }

    const salonId = parseOptionalId(body.salon_id)
    if (!salonId) {
      return NextResponse.json({ ok: false, error: 'missing_salon_id' }, { status: 400 })
    }

    const { data: salon } = await supabase
      .from('salons')
      .select('id')
      .eq('id', salonId)
      .eq('owner_id', me.id)
      .maybeSingle()

    if (!salon?.id) {
      return NextResponse.json({ ok: false, error: 'forbidden_salon' }, { status: 403 })
    }

    const linkTypeRaw = typeof body.link_type === 'string' ? body.link_type.trim() : 'none'
    if (!OWNER_LINK_TYPES.includes(linkTypeRaw as LinkType)) {
      return NextResponse.json({ ok: false, error: 'invalid_link_type_for_owner' }, { status: 400 })
    }
    const linkType = linkTypeRaw as LinkType

    const brandProductId = parseOptionalId(body.brand_product_id)
    const productId = parseOptionalId(body.product_id)

    if (linkType === 'brand_product') {
      if (!brandProductId) {
        return NextResponse.json({ ok: false, error: 'missing_brand_product_id' }, { status: 400 })
      }
      if (productId) {
        return NextResponse.json({ ok: false, error: 'invalid_link_fields' }, { status: 400 })
      }
    } else if (linkType === 'booking' || linkType === 'none') {
      // salon-level booking CTA or no CTA — no product/booking evidence ids
      if (brandProductId || productId) {
        return NextResponse.json({ ok: false, error: 'invalid_link_fields' }, { status: 400 })
      }
    } else if (brandProductId || productId) {
      return NextResponse.json({ ok: false, error: 'invalid_link_fields' }, { status: 400 })
    }

    if (parseOptionalId(body.booking_id) || parseOptionalId(body.order_item_id)) {
      return NextResponse.json({ ok: false, error: 'evidence_not_allowed_for_owner_content' }, { status: 400 })
    }

    row.uploader_type = 'owner'
    row.uploader_user_id = me.id
    row.salon_id = salonId
    row.booking_id = null
    row.order_item_id = null
    row.link_type = linkType
    row.brand_product_id = linkType === 'brand_product' ? brandProductId : null
    row.product_id = null
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data, error } = await db
    .from('oren_scene_posts')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // 릴스 업로드 = 구매확정 (배송완료였던 주문만; confirm API와 동일 — service only)
  if (confirmOrderId && orderService) {
    await orderService
      .from('brand_product_orders')
      .update({ status: '구매확정', confirmed_at: new Date().toISOString() })
      .eq('id', confirmOrderId)
      .eq('status', '배송완료')
  }

  return NextResponse.json({ ok: true, post: data })
}
