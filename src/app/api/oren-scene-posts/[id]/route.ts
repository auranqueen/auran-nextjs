import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: post, error } = await service
    .from('oren_scene_posts')
    .select(`
      id, content_type, uploader_type, uploader_user_id, video_url, thumbnail_url, highlight_tag, title,
      link_type, booking_id, order_item_id, brand_product_id, product_id, salon_id,
      view_count, like_count, booking_conversion_count, revenue_generated,
      is_published, created_at
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (error || !post) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  let uploader: { id: string; name: string; avatar_url: string | null } | null = null
  if (post.uploader_user_id) {
    const { data: u } = await service
      .from('users')
      .select('id, name, avatar_url')
      .eq('id', post.uploader_user_id)
      .maybeSingle()
    uploader = u
  }

  let salon: { id: string; name: string; avatar_url: string | null } | null = null
  if (post.salon_id) {
    const { data: s } = await service
      .from('salons')
      .select('id, name, avatar_url')
      .eq('id', post.salon_id)
      .maybeSingle()
    salon = s
  }

  let cta: { itemName: string; price: number; targetId: string | null } | null = null
  if (post.link_type === 'brand_product' && post.brand_product_id) {
    const { data: bp } = await service
      .from('brand_products')
      .select('id, name, consumer_price')
      .eq('id', post.brand_product_id)
      .maybeSingle()
    if (bp) cta = { itemName: bp.name, price: Number(bp.consumer_price || 0), targetId: null }
  } else if (post.link_type === 'product' && post.product_id) {
    const { data: p } = await service
      .from('products')
      .select('id, name, retail_price')
      .eq('id', post.product_id)
      .maybeSingle()
    if (p) cta = { itemName: p.name, price: Number(p.retail_price || 0), targetId: post.product_id }
  } else if (post.link_type === 'booking' && post.salon_id) {
    const salonName = salon?.name || '살롱'
    let itemName = `${salonName} 시술`
    let price = 0
    if (post.booking_id) {
      const { data: b } = await service
        .from('bookings')
        .select('service_name, service_price')
        .eq('id', post.booking_id)
        .maybeSingle()
      if (b?.service_name) itemName = b.service_name
      if (b?.service_price) price = Number(b.service_price)
    }
    const targetId = [
      post.salon_id,
      itemName,
      price,
      1,
      0,
      price,
      0,
      price,
      '',
    ].join('|')
    cta = { itemName, price: price || 30000, targetId }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let meId: string | null = null
  if (user) {
    const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    meId = me?.id || null
  }

  let liked = false
  if (meId) {
    const { data: likeRow } = await service
      .from('oren_scene_likes')
      .select('id')
      .eq('scene_post_id', params.id)
      .eq('user_id', meId)
      .maybeSingle()
    liked = !!likeRow?.id
  }

  return NextResponse.json({
    ok: true,
    post,
    uploader,
    salon,
    cta,
    meId,
    liked,
    isOwner: !!(meId && post.uploader_user_id === meId),
  })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 403 })

  const { data: post } = await service
    .from('oren_scene_posts')
    .select('id, uploader_user_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!post || post.uploader_user_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const { error } = await service.from('oren_scene_posts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 403 })

  const { data: post } = await service
    .from('oren_scene_posts')
    .select('id, uploader_user_id')
    .eq('id', params.id)
    .maybeSingle()
  if (!post || post.uploader_user_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ ok: false, error: 'missing_title' }, { status: 400 })
    if (title.length > 80) return NextResponse.json({ ok: false, error: 'title_too_long' }, { status: 400 })
    patch.title = title
  }
  if (Object.prototype.hasOwnProperty.call(body, 'highlight_tag')) {
    const tag =
      body.highlight_tag === null || body.highlight_tag === undefined
        ? null
        : typeof body.highlight_tag === 'string'
          ? body.highlight_tag.trim() || null
          : null
    if (tag && tag.length > 40) {
      return NextResponse.json({ ok: false, error: 'highlight_tag_too_long' }, { status: 400 })
    }
    patch.highlight_tag = tag
  }

  if (!('title' in patch) && !('highlight_tag' in patch)) {
    return NextResponse.json({ ok: false, error: 'no_fields' }, { status: 400 })
  }

  const { data: updated, error } = await service
    .from('oren_scene_posts')
    .update(patch)
    .eq('id', params.id)
    .select('id, title, highlight_tag')
    .single()

  if (error || !updated) {
    return NextResponse.json({ ok: false, error: error?.message || 'update_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, post: updated })
}
