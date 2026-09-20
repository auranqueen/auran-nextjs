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
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  const role = (me as { role?: string } | null)?.role || ''
  const isAdmin = role === 'admin' || role === 'super_admin'
  const isCustomer = role === 'customer'
  if (!isAdmin && !isCustomer) return json({ ok: false, error: 'forbidden' }, 401)

  const body = await req.json().catch(() => ({}))
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
  if (!orderId) return json({ ok: false, error: 'missing_orderId' }, 400)

  const svc = tryCreateAdminClient()
  if (!svc) return json({ ok: false, error: 'service_unavailable' }, 500)

  try {
    const { data: order } = await svc
      .from('orders')
      .select(
        'id,status,customer_id,items,referrer_user_id,share_toast_paid,final_amount,purchase_toast_paid,order_items(product_id,quantity,product_price,final_price)'
      )
      .eq('id', orderId)
      .maybeSingle()
    if (!order?.id) return json({ ok: false, error: 'order_not_found' }, 400)

    if (!isAdmin) {
      if (String((order as any).customer_id || '') !== user.id) {
        return json({ ok: false, error: 'not_your_order' }, 401)
      }
    }

    if (String((order as any).status || '') === '구매확정') {
      return json({ ok: true, skipped: true })
    }

    const rawOrderItems = (order as any).order_items
    const items =
      Array.isArray(rawOrderItems) && rawOrderItems.length > 0
        ? rawOrderItems
        : Array.isArray((order as any).items)
          ? ((order as any).items as any[])
          : []
    const productIds = Array.from(
      new Set(items.map((it: any) => String(it?.product_id || it?.id || '').trim()).filter((v: string) => v.length > 0))
    )
    let pMap: Record<string, { share_toast: number }> = {}
    if (productIds.length > 0) {
      const { data: prods } = await svc.from('products').select('id,share_toast').in('id', productIds)
      pMap = Object.fromEntries(
        ((prods || []) as any[]).map((p) => [String(p.id), { share_toast: Number(p.share_toast || 0) }])
      )
    }
    let shareAmount = 0
    items.forEach((it: any) => {
      const pid = String(it?.product_id || it?.id || '').trim()
      const qty = Math.max(1, Number(it?.quantity || 1))
      const pm = pMap[pid]
      if (pm) shareAmount += Math.floor(Math.max(0, pm.share_toast) * qty)
    })

    const buyerAuthId = String((order as any).customer_id || '')
    if (buyerAuthId && !(order as any).purchase_toast_paid) {
      const { data: rewardSetting } = await svc
        .from('admin_settings')
        .select('value')
        .eq('category', 'points_payment')
        .eq('key', 'purchase_reward_rate')
        .maybeSingle()
      const rewardRate = Number((rewardSetting as any)?.value ?? 3) / 100
      const purchaseToastEarn = Math.floor(Number((order as any).final_amount || 0) * rewardRate)
      if (purchaseToastEarn > 0) {
        const { data: buyerRow } = await svc.from('users').select('id, points').eq('auth_id', buyerAuthId).maybeSingle()
        if (buyerRow?.id) {
          const { error: ttErr } = await svc.from('toast_transactions').insert({
            user_id: buyerRow.id,
            amount: purchaseToastEarn,
            transaction_type: 'earn',
            source_type: 'order',
            source_id: orderId,
            reference_id: orderId,
          } as any)
          if (ttErr) return json({ ok: false, error: ttErr.message }, 500)
          const { error: ptsErr } = await svc
            .from('users')
            .update({ points: Number((buyerRow as any).points || 0) + purchaseToastEarn })
            .eq('id', buyerRow.id)
          if (ptsErr) return json({ ok: false, error: ptsErr.message }, 500)
        }
      }
      await svc.from('orders').update({ purchase_toast_paid: true }).eq('id', orderId)
    }

    const referrerAuthId = String((order as any).referrer_user_id || '')
    if (referrerAuthId && shareAmount > 0 && !(order as any).share_toast_paid) {
      const { data: refRow } = await svc.from('users').select('id, points').eq('auth_id', referrerAuthId).maybeSingle()
      if (refRow?.id) {
        const { error: ttErr } = await svc.from('toast_transactions').insert({
          user_id: refRow.id,
          amount: shareAmount,
          transaction_type: 'share_reward',
          source_type: 'order',
          reference_id: orderId,
        } as any)
        if (ttErr) return json({ ok: false, error: ttErr.message }, 500)
        const { error: ptsErr } = await svc
          .from('users')
          .update({ points: Number((refRow as any).points || 0) + shareAmount })
          .eq('id', refRow.id)
        if (ptsErr) return json({ ok: false, error: ptsErr.message }, 500)
      }
      await svc
        .from('orders')
        .update({ share_toast_paid: true, share_toast_amount: shareAmount } as any)
        .eq('id', orderId)
    }

    const { error: stErr } = await svc
      .from('orders')
      .update({ status: '구매확정', confirmed_at: new Date().toISOString() } as any)
      .eq('id', orderId)
    if (stErr) return json({ ok: false, error: stErr.message }, 500)

    return json({ ok: true })
  } catch (e: any) {
    return json({ ok: false, error: e?.message || 'server_error' }, 500)
  }
}
