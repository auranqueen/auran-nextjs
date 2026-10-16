import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { assertShowcaseLiveAccess } from '@/lib/live/assertShowcaseLiveAccess'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, owner_id, title, description, thumbnail_url, status, scheduled_at, started_at, ended_at, viewer_count, mux_live_stream_id, mux_rtmp_url, hls_url, created_at, updated_at'

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

// [ANCHOR: live-my-broadcasts]
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('not_logged_in', 401)

  const { data: me } = await supabase.from('profiles').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') return fail('owner_only', 403)

  const svc = tryCreateAdminClient()
  if (!svc) return fail('service_unavailable', 500)

  const [listResult, access] = await Promise.all([
    svc
      .from('oren_live_broadcasts')
      .select(COLUMNS)
      .eq('owner_id', me.id)
      .order('created_at', { ascending: false })
      .limit(50),
    assertShowcaseLiveAccess(svc, { authId: user.id }),
  ])
  const { data, error } = listResult
  if (error) {
    console.error('[live/my-broadcasts] query error', error)
    return fail('internal_error', 500)
  }

  return NextResponse.json(
    {
      ok: true,
      broadcasts: data ?? [],
      showcase: {
        phase: access.phase,
        daysLeft: access.daysLeft,
        locked: access.locked,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
