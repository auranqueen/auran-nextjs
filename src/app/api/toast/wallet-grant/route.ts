import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

function json(body: { ok: boolean; skipped?: boolean; error?: string }, status = 200) {
  return NextResponse.json(body, { status })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401)

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()
  const role = (me as { role?: string } | null)?.role || ''
  if (role !== 'admin' && role !== 'super_admin') {
    return json({ ok: false, error: 'forbidden' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const walletRequestId = typeof body?.walletRequestId === 'string' ? body.walletRequestId.trim() : ''
  if (!walletRequestId) return json({ ok: false, error: 'missing_walletRequestId' }, 400)

  const svc = tryCreateAdminClient()
  if (!svc) return json({ ok: false, error: 'service_unavailable' }, 500)

  try {
    const { data: intent } = await svc
      .from('payment_intents')
      .select('id, status, amount, user_id, kind')
      .eq('id', walletRequestId)
      .maybeSingle()
    if (!intent) return json({ ok: false, error: 'request_not_found' }, 400)
    if (String((intent as { kind?: string }).kind || '') !== 'charge') {
      return json({ ok: false, error: 'not_charge' }, 400)
    }
    if (String((intent as { status?: string }).status || '') === 'paid') {
      return json({ ok: true, skipped: true })
    }

    const amount = Math.floor(Number((intent as { amount?: unknown }).amount || 0))
    const uid = String((intent as { user_id?: string | null }).user_id || '')
    if (!uid) return json({ ok: false, error: 'missing_user_id' }, 400)
    const ptsAdd = Math.floor(amount * 0.05)

    const { data: u, error: uErr } = await svc.from('users').select('id, points').eq('id', uid).maybeSingle()
    if (uErr || !u) return json({ ok: false, error: 'user_not_found' }, 400)

    const nextPts = Number((u as { points?: unknown }).points || 0) + ptsAdd
    const { error: ptsErr } = await svc.from('users').update({ points: nextPts }).eq('id', uid)
    if (ptsErr) return json({ ok: false, error: ptsErr.message }, 500)

    const { error: ttErr } = await svc.from('toast_transactions').insert({
      user_id: uid,
      amount: ptsAdd,
      transaction_type: 'charge',
      source_type: 'admin',
      reference_id: walletRequestId,
    } as any)
    if (ttErr) return json({ ok: false, error: ttErr.message }, 500)

    const { error: stErr } = await svc
      .from('payment_intents')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', walletRequestId)
      .in('status', ['pending', 'created'])
    if (stErr) return json({ ok: false, error: stErr.message }, 500)

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'server_error' }, 500)
  }
}
