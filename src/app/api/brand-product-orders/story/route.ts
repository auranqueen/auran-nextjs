import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

type StoryType = 'treatment' | 'homecare'

async function requireOwnerSalon(): Promise<
  | { ok: true; service: SupabaseClient; salonId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }) }
  const service = tryCreateAdminClient()
  if (!service) return { ok: false, response: NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 }) }
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return { ok: false, response: NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 }) }
  const { data: salon } = await service.from('salons').select('id').eq('owner_id', me.id).maybeSingle()
  if (!salon) return { ok: false, response: NextResponse.json({ ok: false, error: 'salon_not_found' }, { status: 404 }) }
  return { ok: true, service, salonId: String(salon.id) }
}

async function replaceStoryProducts(service: SupabaseClient, storyId: string, productIds: string[]) {
  const { error: delErr } = await service.from('brand_product_salon_story_products').delete().eq('story_id', storyId)
  if (delErr) return delErr
  if (!productIds.length) return null
  const rows = productIds.map((brand_product_id, display_order) => ({
    story_id: storyId,
    brand_product_id,
    display_order,
  }))
  const { error } = await service.from('brand_product_salon_story_products').insert(rows)
  return error
}

export async function GET() {
  const gate = await requireOwnerSalon()
  if (!gate.ok) return gate.response

  const { data, error } = await gate.service
    .from('brand_product_salon_story')
    .select(
      `
      id, salon_id, story_type, title, content,
      banner_image_url_pc, banner_image_url_mobile, is_published,
      created_at, updated_at,
      brand_product_salon_story_products(brand_product_id, display_order)
    `,
    )
    .eq('salon_id', gate.salonId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: 'list_failed' }, { status: 500 })

  const stories = ((data as any[]) || []).map((row) => {
    const links = Array.isArray(row.brand_product_salon_story_products)
      ? [...row.brand_product_salon_story_products].sort(
          (a: { display_order?: number }, b: { display_order?: number }) =>
            Number(a.display_order || 0) - Number(b.display_order || 0),
        )
      : []
    const { brand_product_salon_story_products: _omit, ...rest } = row
    return {
      ...rest,
      product_ids: links.map((l: { brand_product_id: string }) => String(l.brand_product_id)),
    }
  })

  return NextResponse.json({ ok: true, stories })
}

export async function POST(req: Request) {
  const gate = await requireOwnerSalon()
  if (!gate.ok) return gate.response

  const body = await req.json()
  const storyType = body.story_type as StoryType
  const title = String(body.title || '').trim()
  const content = String(body.content || '')
  const bannerPc = body.banner_image_url_pc ? String(body.banner_image_url_pc) : null
  const bannerMobile = body.banner_image_url_mobile ? String(body.banner_image_url_mobile) : null
  const productIds: string[] = Array.isArray(body.product_ids) ? body.product_ids.map(String) : []
  const isPublished = Boolean(body.is_published)

  if (body.salon_id && String(body.salon_id) !== gate.salonId) {
    return NextResponse.json({ ok: false, error: 'salon_mismatch' }, { status: 403 })
  }
  if (storyType !== 'treatment' && storyType !== 'homecare') {
    return NextResponse.json({ ok: false, error: 'invalid_story_type' }, { status: 400 })
  }
  if (!title) return NextResponse.json({ ok: false, error: 'title_required' }, { status: 400 })

  const { data: story, error } = await gate.service
    .from('brand_product_salon_story')
    .insert({
      salon_id: gate.salonId,
      story_type: storyType,
      title,
      content,
      banner_image_url_pc: bannerPc || bannerMobile,
      banner_image_url_mobile: bannerMobile || bannerPc,
      is_published: isPublished,
    })
    .select('id')
    .single()

  if (error || !story) return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })

  if (storyType === 'homecare') {
    const pErr = await replaceStoryProducts(gate.service, String(story.id), productIds)
    if (pErr) return NextResponse.json({ ok: false, error: 'products_insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: story.id })
}

export async function PATCH(req: Request) {
  const gate = await requireOwnerSalon()
  if (!gate.ok) return gate.response

  const body = await req.json()
  const id = String(body.id || '')
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { data: existing } = await gate.service
    .from('brand_product_salon_story')
    .select('id, story_type')
    .eq('id', id)
    .eq('salon_id', gate.salonId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title != null) patch.title = String(body.title).trim()
  if (body.content != null) patch.content = String(body.content)
  if (body.banner_image_url_pc != null) patch.banner_image_url_pc = body.banner_image_url_pc || null
  if (body.banner_image_url_mobile != null) patch.banner_image_url_mobile = body.banner_image_url_mobile || null
  if (typeof body.is_published === 'boolean') patch.is_published = body.is_published
  if (body.story_type === 'treatment' || body.story_type === 'homecare') patch.story_type = body.story_type

  const { error } = await gate.service
    .from('brand_product_salon_story')
    .update(patch)
    .eq('id', id)
    .eq('salon_id', gate.salonId)
  if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })

  const effectiveType = ((patch.story_type as StoryType) || existing.story_type) as StoryType
  if (Array.isArray(body.product_ids)) {
    if (effectiveType === 'homecare') {
      const pErr = await replaceStoryProducts(gate.service, id, body.product_ids.map(String))
      if (pErr) return NextResponse.json({ ok: false, error: 'products_replace_failed' }, { status: 500 })
    } else {
      await gate.service.from('brand_product_salon_story_products').delete().eq('story_id', id)
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const gate = await requireOwnerSalon()
  if (!gate.ok) return gate.response

  let id = new URL(req.url).searchParams.get('id') || ''
  if (!id) {
    try {
      const body = await req.json()
      id = String(body?.id || '')
    } catch {
      /* no body */
    }
  }
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { data: existing } = await gate.service
    .from('brand_product_salon_story')
    .select('id')
    .eq('id', id)
    .eq('salon_id', gate.salonId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const { error } = await gate.service
    .from('brand_product_salon_story')
    .delete()
    .eq('id', id)
    .eq('salon_id', gate.salonId)
  if (error) return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
