import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

// [ANCHOR: live-stream-key]
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('not_logged_in', 401)

  const { data: me } = await supabase.from('profiles').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') return fail('owner_only', 403)

  const broadcastId = req.nextUrl.searchParams.get('broadcast_id')
  if (!broadcastId) return fail('missing_broadcast_id', 400)
  if (!UUID_RE.test(broadcastId)) return fail('invalid_broadcast_id', 400)

  const svc = tryCreateAdminClient()
  if (!svc) return fail('service_unavailable', 500)

  const { data, error } = await svc
    .from('oren_live_broadcasts')
    .select('mux_rtmp_url, mux_rtmp_key')
    .eq('id', broadcastId)
    .eq('owner_id', me.id)
    .maybeSingle()
  if (error) return fail(error.message, 500)
  if (!data) return fail('not_found', 404)
  if (typeof data.mux_rtmp_key !== 'string' || typeof data.mux_rtmp_url !== 'string') {
    return fail('stream_key_missing', 404)
  }

  return NextResponse.json(
    { ok: true, rtmp_url: data.mux_rtmp_url, rtmp_key: data.mux_rtmp_key },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
