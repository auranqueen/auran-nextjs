import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function POST(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })

  const svc = tryCreateServiceClient() || supabase
  const { data: me, error: meErr } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  if (meErr) return NextResponse.json({ ok: false, error: meErr.message }, { status: 500 })
  if ((me as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const { data: intents, error: intentsErr } = await svc
    .from('payment_intents')
    .select('id,target_id,status,kind')
    .eq('status', 'paid')
    .eq('kind', 'order')
    .not('target_id', 'is', null)

  if (intentsErr) return NextResponse.json({ ok: false, error: intentsErr.message }, { status: 500 })

  let processed = 0
  let skipped = 0
  for (const intent of intents || []) {
    const orderId = String((intent as { target_id?: string | null }).target_id || '').trim()
    if (!orderId) {
      skipped += 1
      continue
    }

    const { data: orderRow, error: orderErr } = await svc
      .from('orders')
      .select('id,payment_applied,payment_status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !orderRow?.id) {
      skipped += 1
      continue
    }

    // Idempotency: once payment_applied=true, never process again.
    if (orderRow.payment_applied === true) {
      skipped += 1
      continue
    }

    const shouldProcess = !orderRow.payment_applied || orderRow.payment_status !== 'paid'
    if (!shouldProcess) {
      skipped += 1
      continue
    }

    const { error: upErr } = await svc
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_applied: true,
        status: '주문확인',
      })
      .eq('id', orderRow.id)

    if (upErr) {
      skipped += 1
      continue
    }
    processed += 1
  }

  return NextResponse.json({ ok: true, processed, skipped })
}

