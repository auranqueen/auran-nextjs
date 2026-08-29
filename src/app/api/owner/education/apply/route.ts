import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sessionId = typeof body?.session_id === 'string' ? body.session_id.trim() : ''
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: session, error: sessionErr } = await db
    .from('education_sessions')
    .select('id, capacity')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionErr || !session) {
    return NextResponse.json({ ok: false, error: 'session_not_found' }, { status: 404 })
  }

  const capacity =
    session.capacity != null && session.capacity !== ''
      ? Math.trunc(Number(session.capacity))
      : null

  if (capacity != null && Number.isFinite(capacity) && capacity > 0) {
    const { count, error: countErr } = await db
      .from('education_applications')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('status', 'applied')

    if (countErr) {
      return NextResponse.json({ ok: false, error: countErr.message }, { status: 500 })
    }
    if ((count ?? 0) >= capacity) {
      return NextResponse.json({ ok: false, error: 'capacity_full' }, { status: 409 })
    }
  }

  const { error: insertErr } = await db.from('education_applications').insert({
    session_id: sessionId,
    owner_id: me.id,
    status: 'applied',
  })

  if (insertErr) {
    const code = String((insertErr as { code?: string }).code || '')
    const msg = String(insertErr.message || '')
    if (code === '23505' || /duplicate|unique/i.test(msg)) {
      return NextResponse.json({ ok: true, already_applied: true })
    }
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}