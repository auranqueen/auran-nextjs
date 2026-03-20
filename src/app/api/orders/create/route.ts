import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, reason: 'not_logged_in' }, 401)

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : []
  const shareJournalId = typeof body?.share_journal_id === 'string' ? body.share_journal_id : null
  if (items.length === 0) return json({ ok: false, error: 'items_required' }, 400)

  type Item = { product_id: string; quantity: number }
  const validItems: Item[] = items
    .filter((x: any) => typeof x?.product_id === 'string' && Number(x?.quantity) >= 1)
    .map((x: any) => ({ product_id: x.product_id.trim(), quantity: Math.min(99, Math.floor(Number(x.quantity)) || 1) }))
  if (validItems.length === 0) return json({ ok: false, error: 'invalid_items' }, 400)

  const svc = tryCreateServiceClient()
  const client = svc || supabase

  const { data: me } = await client.from('users').select('id').eq('auth_id', user.id).single()
  if (!me?.id) return json({ ok: false, error: 'user_row_missing' }, 400)

  let validatedShareJournalId: string | null = null
  if (shareJournalId) {
    const { data: sj } = await client
      .from('skin_journals')
      .select('id,user_id')
      .eq('id', shareJournalId)
      .maybeSingle()

    if (sj?.id && sj.user_id && String(sj.user_id) !== String(me.id)) {
      validatedShareJournalId = sj.id
    }
  }

  const productIdSet = new Set(validItems.map((i: Item) => i.product_id))
  const productIds = Array.from(productIdSet)
  const { data: products } = await client
    .from('products')
    .select('id,name,retail_price,brand_id')
    .eq('status', 'active')
    .in('id', productIds)
  const productMap = new Map((products || []).map((p: any) => [p.id, p]))

  let totalAmount = 0
  const orderItemsRows: { product_id: string; brand_id: string | null; product_name: string; product_price: number; quantity: number; subtotal: number }[] = []
  for (const item of validItems) {
    const product = productMap.get(item.product_id)
    if (!product) return json({ ok: false, error: 'product_not_found', product_id: item.product_id }, 400)
    const price = Number(product.retail_price) || 0
    const subtotal = price * item.quantity
    totalAmount += subtotal
    orderItemsRows.push({
      product_id: product.id,
      brand_id: product.brand_id || null,
      product_name: product.name || '',
      product_price: price,
      quantity: item.quantity,
      subtotal,
    })
  }
  if (totalAmount < 1) return json({ ok: false, error: 'invalid_total' }, 400)

  const { data: order, error: orderErr } = await client
    .from('orders')
    .insert({
      customer_id: me.id,
      status: '주문확인',
      total_amount: totalAmount,
      point_used: 0,
      charge_used: 0,
      coupon_discount: 0,
      final_amount: totalAmount,
      earn_points: 0,
      points_awarded: false,
      share_journal_id: validatedShareJournalId,
    })
    .select('id,order_no,final_amount')
    .single()

  if (orderErr || !order) return json({ ok: false, error: orderErr?.message || 'order_create_failed' }, 500)

  for (const row of orderItemsRows) {
    const { error: itemErr } = await client.from('order_items').insert({
      order_id: order.id,
      product_id: row.product_id,
      brand_id: row.brand_id,
      product_name: row.product_name,
      product_price: row.product_price,
      quantity: row.quantity,
      subtotal: row.subtotal,
    })
    if (itemErr) return json({ ok: false, error: 'order_item_failed', detail: itemErr.message }, 500)
  }

  return json({
    ok: true,
    order_id: order.id,
    order_no: order.order_no,
    final_amount: order.final_amount,
  })
}
