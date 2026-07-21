import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

async function requireAdminViaService() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, user: null, adminId: null as string | null }

  const svc = tryCreateServiceClient()
  if (!svc) {
    if (user.email === 'admin@auran.kr') return { ok: true as const, status: 200, user, adminId: null as string | null }
    return { ok: false as const, status: 500, user, adminId: null as string | null }
  }
  const { data: u } = await svc.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  const role = (u as any)?.role || null
  if (role === 'admin') return { ok: true as const, status: 200, user, adminId: (u as any)?.id || null }

  const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  const pRole = (p as any)?.role || null
  if (pRole === 'admin') {
    const { data: u2 } = await svc.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    return { ok: true as const, status: 200, user, adminId: (u2 as any)?.id || null }
  }

  return { ok: false as const, status: 403, user, adminId: null as string | null }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminViaService()
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: 'not_admin' }, { status: admin.status })
  }

  const body = await req.json().catch(() => ({}))
  const transactionId = typeof body?.transaction_id === 'string' ? body.transaction_id.trim() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''

  if (!transactionId) {
    return NextResponse.json({ ok: false, error: 'missing_transaction_id' }, { status: 400 })
  }
  if (!note) {
    return NextResponse.json({ ok: false, error: 'missing_note' }, { status: 400 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_client_unavailable' }, { status: 500 })
  }

  let adminId = admin.adminId
  if (!adminId && admin.user) {
    const { data: uRow } = await svc.from('users').select('id').eq('auth_id', admin.user.id).maybeSingle()
    adminId = (uRow as any)?.id || null
  }
  if (!adminId) {
    return NextResponse.json({ ok: false, error: 'admin_id_not_found' }, { status: 500 })
  }

  const { data: original, error: fetchErr } = await svc
    .from('toast_transactions')
    .select('id, user_id, amount, transaction_type, source_type, status')
    .eq('id', transactionId)
    .maybeSingle()

  if (fetchErr || !original) {
    return NextResponse.json({ ok: false, error: 'transaction_not_found' }, { status: 404 })
  }

  if (original.transaction_type !== 'earn' || original.status !== 'active') {
    return NextResponse.json({ ok: false, error: '이미 회수됐거나 회수 불가한 항목' }, { status: 400 })
  }

  const amt = Number(original.amount) || 0
  if (amt <= 0 || !original.user_id) {
    return NextResponse.json({ ok: false, error: '이미 회수됐거나 회수 불가한 항목' }, { status: 400 })
  }

  const { error: insertErr } = await svc.from('toast_transactions').insert({
    user_id: original.user_id,
    amount: -amt,
    transaction_type: 'adjust',
    source_type: original.source_type,
    reference_id: original.id,
    note,
    admin_id: adminId,
    status: 'active',
  })
  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 })
  }

  const { error: reverseErr } = await svc
    .from('toast_transactions')
    .update({ status: 'reversed' })
    .eq('id', original.id)
  if (reverseErr) {
    return NextResponse.json({ ok: false, error: reverseErr.message }, { status: 500 })
  }

  const { data: userRow, error: userErr } = await svc
    .from('users')
    .select('points')
    .eq('id', original.user_id)
    .maybeSingle()
  if (userErr || !userRow) {
    return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 500 })
  }

  const { error: pointsErr } = await svc
    .from('users')
    .update({ points: (Number(userRow.points) || 0) - amt })
    .eq('id', original.user_id)
  if (pointsErr) {
    return NextResponse.json({ ok: false, error: pointsErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
