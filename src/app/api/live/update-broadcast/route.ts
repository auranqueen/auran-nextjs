import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const COLUMNS = 'id, title, description, scheduled_at, status, updated_at'

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

// [ANCHOR: live-update-broadcast]
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail('not_logged_in', 401)

  const { data: me } = await supabase.from('profiles').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') return fail('owner_only', 403)

  const { id, title, description, scheduled_at, thumbnail_url } = await req.json().catch(() => ({}))
  const broadcastId = typeof id === 'number' ? id : typeof id === 'string' && /^[1-9]\d*$/.test(id) ? Number(id) : NaN
  if (!Number.isSafeInteger(broadcastId) || broadcastId <= 0) return fail('invalid_broadcast_id', 400)

  const svc = tryCreateAdminClient()
  if (!svc) return fail('service_unavailable', 500)

  const { data: row, error: findError } = await svc
    .from('oren_live_broadcasts')
    .select('id, status')
    .eq('id', broadcastId)
    .eq('owner_id', me.id)
    .maybeSingle()
  if (findError) {
    console.error('[live/update-broadcast] query error', findError)
    return fail('internal_error', 500)
  }
  if (!row) return fail('not_found', 404)
  if (row.status !== 'upcoming') return fail('not_editable', 409)

  if (typeof title !== 'string' || title.trim() === '') return fail('title_required', 400)

  const patch: Record<string, string | null> = { title: title.trim(), updated_at: new Date().toISOString() }
  if (description !== undefined) {
    patch.description = typeof description === 'string' && description.trim() ? description.trim() : null
  }
  if (scheduled_at !== undefined && scheduled_at !== null && scheduled_at !== '') {
    const t = typeof scheduled_at === 'string' ? Date.parse(scheduled_at) : NaN
    if (Number.isNaN(t)) return fail('invalid_scheduled_at', 400)
    if (t < Date.now()) return fail('past_time', 400)
    patch.scheduled_at = new Date(t).toISOString()
  }
  if (typeof thumbnail_url === 'string' && thumbnail_url.startsWith('https://')) {
    patch.thumbnail_url = thumbnail_url
  }

  // status 조건을 다시 거는 이유: 조회 직후 웹훅이 live로 바꿨으면 수정하지 않기 위해
  const { data: updated, error: updateError } = await svc
    .from('oren_live_broadcasts')
    .update(patch)
    .eq('id', broadcastId)
    .eq('owner_id', me.id)
    .eq('status', 'upcoming')
    .select(COLUMNS)
  if (updateError) {
    console.error('[live/update-broadcast] update error', updateError)
    return fail('internal_error', 500)
  }
  if (!updated || updated.length === 0) return fail('not_editable', 409)

  return NextResponse.json({ ok: true, broadcast: updated[0] }, { headers: { 'Cache-Control': 'no-store' } })
}
