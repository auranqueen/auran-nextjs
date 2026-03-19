import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, reason: 'not_logged_in' }, 401)

  const body = await req.json().catch(() => ({}))

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const retailPrice = Number(body?.retail_price)
  const supplyPrice = Number(body?.supply_price || 0)
  const stock = Number(body?.stock || 0)
  const thumbImg = typeof body?.thumb_img === 'string' ? body.thumb_img.trim() : ''
  const detailImgs = Array.isArray(body?.detail_imgs) ? body.detail_imgs.filter((x: any) => typeof x === 'string') : []
  const detailHtml = typeof body?.detail_html === 'string' ? body.detail_html : ''
  const ingredient = typeof body?.ingredient === 'string' ? body.ingredient.trim() : ''
  const category = typeof body?.category === 'string' ? body.category.trim() : null
  const videoUrl = typeof body?.video_url === 'string' ? body.video_url.trim() : null

  if (!name) return json({ ok: false, error: 'missing_name' }, 400)
  if (!Number.isFinite(retailPrice) || retailPrice < 0) return json({ ok: false, error: 'invalid_price' }, 400)
  if (!thumbImg) return json({ ok: false, error: 'missing_thumb' }, 400)
  if (detailImgs.length > 5) return json({ ok: false, error: 'too_many_images' }, 400)

  const client = tryCreateServiceClient() || supabase

  const { data: me } = await client.from('users').select('id,role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return json({ ok: false, error: 'user_row_missing' }, 400)
  if (me.role !== 'brand') return json({ ok: false, error: 'forbidden' }, 403)

  const { data: brand } = await client.from('brands').select('id,status').eq('user_id', me.id).maybeSingle()
  if (!brand?.id) return json({ ok: false, error: 'brand_row_missing' }, 400)

  const { data: created, error } = await client
    .from('products')
    .insert({
      brand_id: brand.id,
      name,
      description: description || null,
      ingredient: ingredient || null,
      detail_html: detailHtml || null,
      retail_price: Math.trunc(retailPrice),
      supply_price: Number.isFinite(supplyPrice) ? Math.trunc(Math.max(0, supplyPrice)) : 0,
      stock: Number.isFinite(stock) ? Math.trunc(Math.max(0, stock)) : 0,
      thumb_img: thumbImg,
      detail_imgs: detailImgs,
      category,
      video_url: videoUrl || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !created?.id) return json({ ok: false, error: error?.message || 'create_failed' }, 500)
  return json({ ok: true, id: created.id })
}

