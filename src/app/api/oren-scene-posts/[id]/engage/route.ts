import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Ctx) {
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const body = await req.json().catch(() => ({}))
  const action = body?.action === 'like' ? 'like' : 'view'

  const { data: post } = await service
    .from('oren_scene_posts')
    .select('id, view_count, like_count')
    .eq('id', params.id)
    .maybeSingle()
  if (!post) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  if (action === 'view') {
    const next = Number(post.view_count || 0) + 1
    await service
      .from('oren_scene_posts')
      .update({ view_count: next, updated_at: new Date().toISOString() })
      .eq('id', params.id)
    return NextResponse.json({ ok: true, view_count: next })
  }

  // like toggle — requires login
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 403 })

  const { data: existing } = await service
    .from('oren_scene_likes')
    .select('id')
    .eq('scene_post_id', params.id)
    .eq('user_id', me.id)
    .maybeSingle()

  if (existing?.id) {
    await service.from('oren_scene_likes').delete().eq('id', existing.id)
    const next = Math.max(0, Number(post.like_count || 0) - 1)
    await service
      .from('oren_scene_posts')
      .update({ like_count: next, updated_at: new Date().toISOString() })
      .eq('id', params.id)
    return NextResponse.json({ ok: true, liked: false, like_count: next })
  }

  const { error: insertErr } = await service.from('oren_scene_likes').insert({
    scene_post_id: params.id,
    user_id: me.id,
  })

  if (insertErr) {
    // UNIQUE race: treat as already liked — no count bump
    if (String(insertErr.code) === '23505' || /duplicate|unique/i.test(insertErr.message || '')) {
      return NextResponse.json({
        ok: true,
        liked: true,
        like_count: Number(post.like_count || 0),
        already: true,
      })
    }
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 })
  }

  const next = Number(post.like_count || 0) + 1
  await service
    .from('oren_scene_posts')
    .update({ like_count: next, updated_at: new Date().toISOString() })
    .eq('id', params.id)
  return NextResponse.json({ ok: true, liked: true, like_count: next })
}
