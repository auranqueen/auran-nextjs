import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: rows, error } = await service
    .from('oren_scene_comments')
    .select(`
      id, scene_post_id, author_type, author_user_id, parent_comment_id,
      mentioned_user_id, content, like_count, is_hidden, created_at
    `)
    .eq('scene_post_id', params.id)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const authorIds = Array.from(new Set((rows || []).map((r) => r.author_user_id).filter(Boolean)))
  const mentionIds = Array.from(new Set((rows || []).map((r) => r.mentioned_user_id).filter(Boolean))) as string[]
  const userIds = Array.from(new Set([...authorIds, ...mentionIds]))

  let usersById: Record<string, { id: string; name: string; avatar_url: string | null }> = {}
  if (userIds.length) {
    const { data: users } = await service
      .from('users')
      .select('id, name, avatar_url')
      .in('id', userIds)
    for (const u of users || []) usersById[u.id] = u
  }

  const { data: post } = await service
    .from('oren_scene_posts')
    .select('uploader_user_id, salon_id')
    .eq('id', params.id)
    .maybeSingle()

  let salon: { id: string; name: string } | null = null
  if (post?.salon_id) {
    const { data: s } = await service.from('salons').select('id, name').eq('id', post.salon_id).maybeSingle()
    salon = s
  }

  return NextResponse.json({
    ok: true,
    comments: rows || [],
    usersById,
    uploaderUserId: post?.uploader_user_id || null,
    salon,
  })
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const { data: me } = await service.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 403 })
  if (me.role !== 'owner' && me.role !== 'customer') {
    return NextResponse.json({ ok: false, error: 'role_not_allowed' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) return NextResponse.json({ ok: false, error: 'empty_content' }, { status: 400 })
  const parentId =
    typeof body?.parent_comment_id === 'string' && body.parent_comment_id.trim()
      ? body.parent_comment_id.trim()
      : null
  const mentionedUserId =
    typeof body?.mentioned_user_id === 'string' && body.mentioned_user_id.trim()
      ? body.mentioned_user_id.trim()
      : null

  const { data: post } = await service.from('oren_scene_posts').select('id').eq('id', params.id).maybeSingle()
  if (!post) return NextResponse.json({ ok: false, error: 'post_not_found' }, { status: 404 })

  const { data: row, error } = await service
    .from('oren_scene_comments')
    .insert({
      scene_post_id: params.id,
      author_type: me.role === 'owner' ? 'owner' : 'customer',
      author_user_id: me.id,
      parent_comment_id: parentId,
      mentioned_user_id: mentionedUserId,
      content,
    })
    .select('id, scene_post_id, author_type, author_user_id, parent_comment_id, mentioned_user_id, content, like_count, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, comment: row })
}
