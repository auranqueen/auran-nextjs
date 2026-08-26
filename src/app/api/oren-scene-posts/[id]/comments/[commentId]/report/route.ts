import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: { id: string; commentId: string } }

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'inappropriate'

  const { data: comment } = await service
    .from('oren_scene_comments')
    .select('id, scene_post_id')
    .eq('id', params.commentId)
    .eq('scene_post_id', params.id)
    .maybeSingle()
  if (!comment) return NextResponse.json({ ok: false, error: 'comment_not_found' }, { status: 404 })

  const { error } = await service.from('oren_scene_comment_reports').insert({
    comment_id: params.commentId,
    reporter_user_id: me.id,
    reason,
  })
  if (error) {
    if (String(error.message || '').toLowerCase().includes('duplicate') || error.code === '23505') {
      return NextResponse.json({ ok: false, error: 'already_reported' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
