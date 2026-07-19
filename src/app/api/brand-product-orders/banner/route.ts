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
  let { image_url_mobile, image_url_pc, link_url } = body
  if (!image_url_mobile && !image_url_pc) {
    return NextResponse.json({ ok: false, error: 'image_required' }, { status: 400 })
  }
  // 하나만 올리면 나머지도 같은 이미지로 자동 채움
  if (!image_url_mobile) image_url_mobile = image_url_pc
  if (!image_url_pc) image_url_pc = image_url_mobile
  const { error } = await service
    .from('brand_product_salon_banner')
    .upsert(
      { salon_id: salon.id, image_url_mobile, image_url_pc, link_url: link_url || null, is_active: true },
      { onConflict: 'salon_id' }
    )
  if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
export async function DELETE() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const { data: salon } = await service.from('salons').select('id').eq('owner_id', me.id).maybeSingle()
  if (!salon) return NextResponse.json({ ok: false, error: 'salon_not_found' }, { status: 404 })
  const { error } = await service
    .from('brand_product_salon_banner')
    .update({ is_active: false })
    .eq('salon_id', salon.id)
  if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
