import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

function json(body: { ok: boolean; error?: string }, status = 200) {
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
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  const role = (me as { role?: string } | null)?.role || ''
  const isAdmin = role === 'admin' || role === 'super_admin'
  const isOwner = role === 'owner'
  if ((!isAdmin && !isOwner) || !(me as { id?: string } | null)?.id) {
    return json({ ok: false, error: 'forbidden' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const channelId = typeof body?.channelId === 'string' ? body.channelId.trim() : ''
  const customerUserId = typeof body?.customerUserId === 'string' ? body.customerUserId.trim() : ''
  const amount = Math.floor(Number(body?.amount))
  if (!channelId || !customerUserId) return json({ ok: false, error: 'missing_params' }, 400)
  if (!Number.isFinite(amount) || amount <= 0) return json({ ok: false, error: 'invalid_amount' }, 400)

  const svc = tryCreateAdminClient()
  if (!svc) return json({ ok: false, error: 'service_unavailable' }, 500)

  try {
    const { data: ch } = await svc
      .from('chat_channels')
      .select('id, owner_id, user_id')
      .eq('id', channelId)
      .maybeSingle()
    if (!ch) return json({ ok: false, error: 'channel_not_found' }, 400)
    if (!isAdmin && String((ch as { owner_id?: string | null }).owner_id || '') !== String((me as { id: string }).id)) {
      return json({ ok: false, error: 'not_channel_owner' }, 401)
    }
    if (String((ch as { user_id?: string | null }).user_id || '') !== customerUserId) {
      return json({ ok: false, error: 'customer_mismatch' }, 400)
    }

    const { data: cust, error: custErr } = await svc
      .from('users')
      .select('id, points')
      .eq('id', customerUserId)
      .maybeSingle()
    if (custErr || !cust) return json({ ok: false, error: 'customer_not_found' }, 400)

    const next = Number((cust as { points?: number }).points || 0) + amount
    const { error: upErr } = await svc.from('users').update({ points: next }).eq('id', customerUserId)
    if (upErr) return json({ ok: false, error: upErr.message }, 500)

    const { error: ttErr } = await svc.from('toast_transactions').insert({
      user_id: customerUserId,
      amount,
      transaction_type: 'gift',
      source_type: 'gift',
      reference_id: channelId,
    } as any)
    if (ttErr) return json({ ok: false, error: ttErr.message }, 500)

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'server_error' }, 500)
  }
}
