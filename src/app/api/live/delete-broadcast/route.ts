import { NextRequest, NextResponse } from 'next/server'
import Mux from '@mux/mux-node'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
})

const ID_RE = /^[1-9]\d*$/

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

// [ANCHOR: live-delete-broadcast]
export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('not_logged_in', 401)

  const { data: me } = await supabase.from('profiles').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') return fail('owner_only', 403)

  const broadcastId = req.nextUrl.searchParams.get('broadcast_id')
  if (!broadcastId) return fail('missing_broadcast_id', 400)
  if (!ID_RE.test(broadcastId)) return fail('invalid_broadcast_id', 400)

  const svc = tryCreateAdminClient()
  if (!svc) return fail('service_unavailable', 500)

  const { data: row, error: findError } = await svc
    .from('oren_live_broadcasts')
    .select('id, status, mux_live_stream_id')
    .eq('id', broadcastId)
    .eq('owner_id', me.id)
    .maybeSingle()
  if (findError) {
    console.error('[live/delete-broadcast] query error', findError)
    return fail('internal_error', 500)
  }
  if (!row) return fail('not_found', 404)
  if (row.status !== 'upcoming') return fail('not_deletable', 409)

  // status 조건을 다시 거는 이유: 조회 직후 웹훅이 live로 바꿨으면 지우지 않기 위해
  const { data: deleted, error: deleteError } = await svc
    .from('oren_live_broadcasts')
    .delete()
    .eq('id', broadcastId)
    .eq('owner_id', me.id)
    .eq('status', 'upcoming')
    .select('id')
  if (deleteError) {
    if (deleteError.code === '23503') return fail('has_related_data', 409)
    console.error('[live/delete-broadcast] delete error', deleteError)
    return fail('internal_error', 500)
  }
  if (!deleted || deleted.length === 0) return fail('not_deletable', 409)

  const streamId = typeof row.mux_live_stream_id === 'string' ? row.mux_live_stream_id : null
  if (streamId) {
    await mux.video.liveStreams.delete(streamId).catch((e) => {
      console.error('Mux 스트림 삭제 실패 (수동 삭제 필요):', streamId, e)
    })
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
