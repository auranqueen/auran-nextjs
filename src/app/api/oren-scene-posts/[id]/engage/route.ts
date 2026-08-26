import { NextRequest, NextResponse } from 'next/server'
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

  const next = Number(post.like_count || 0) + 1
  await service
    .from('oren_scene_posts')
    .update({ like_count: next, updated_at: new Date().toISOString() })
    .eq('id', params.id)
  return NextResponse.json({ ok: true, like_count: next })
}
