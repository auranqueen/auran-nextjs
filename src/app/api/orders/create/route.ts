import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { computeCouponDiscount, isCouponApplicableForOrder } from '@/lib/coupon/computeDiscount'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

function kstTodayStartIso(): string {
  const s = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  return `${s}T00:00:00+09:00`
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, reason: 'not_logged_in' }, 401)

  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items : []
  const shareJournalId = typeof body?.share_journal_id === 'string' ? body.share_journal_id : null
  const usePoints = Math.max(0, Math.floor(Number(body?.use_points) || 0))
  const useCharge = Math.max(0, Math.floor(Number(body?.use_charge) || 0))
  const giftTo = typeof body?.gift_to === 'string' && body.gift_to ? body.gift_to : null
  const userCouponId = typeof body?.user_coupon_id === 'string' && body.user_coupon_id ? body.user_coupon_id : null
  if (items.length === 0) return json({ ok: false, error: 'items_required' }, 400)

  type Item = { product_id: string; quantity: number }
  const validItems: Item[] = items
    .filter((x: any) => typeof x?.product_id === 'string' && Number(x?.quantity) >= 1)
    .map((x: any) => ({ product_id: x.product_id.trim(), quantity: Math.min(99, Math.floor(Number(x.quantity)) || 1) }))
  if (validItems.length === 0) return json({ ok: false, error: 'invalid_items' }, 400)

  const svc = tryCreateServiceClient()
  const client = svc || supabase

  const { data: msgLenRow } = await client
    .from('admin_settings')
    .select('value')
    .eq('category', 'gift')
    .eq('key', 'gift_message_max_length')
    .maybeSingle()
  const giftMsgMax = Math.min(500, Math.max(1, Number(msgLenRow?.value ?? 100)))
  const giftMessage = typeof body?.gift_message === 'string' ? body.gift_message.slice(0, giftMsgMax) : null

  const { data: me } = await client.from('users').select('id').eq('auth_id', user.id).single()
  if (!me?.id) return json({ ok: false, error: 'user_row_missing' }, 400)

  if (giftTo) {
    const { data: maxRow } = await client
      .from('admin_settings')
      .select('value')
      .eq('category', 'gift')
      .eq('key', 'max_gift_per_day')
      .maybeSingle()
    const maxDay = Math.max(1, Number(maxRow?.value ?? 10))
    const start = kstTodayStartIso()
    const { count: sentGifts } = await client
      .from('gifts')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', me.id)
      .gte('created_at', start)
    const { count: pendingGiftOrders } = await client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', me.id)
      .not('gift_receiver_id', 'is', null)
      .eq('gift_created', false)
      .gte('created_at', start)
    const used = (sentGifts || 0) + (pendingGiftOrders || 0)
    if (used >= maxDay) return json({ ok: false, error: 'gift_daily_limit' }, 400)
  }

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

  let couponDiscount = 0
  let validatedUserCouponId: string | null = null
  if (userCouponId) {
    const { data: maxC } = await client
      .from('admin_settings')
      .select('value')
      .eq('category', 'coupon')
      .eq('key', 'max_coupons_per_order')
      .maybeSingle()
    const maxPerOrder = Math.max(0, Number(maxC?.value ?? 1))
    if (maxPerOrder < 1) return json({ ok: false, error: 'coupon_not_allowed' }, 400)

    const { data: uc } = await client
      .from('user_coupons')
      .select('id,status,coupon_id')
      .eq('id', userCouponId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!uc || uc.status !== 'unused') return json({ ok: false, error: 'invalid_coupon' }, 400)

    const { data: c } = await client.from('coupons').select('*').eq('id', uc.coupon_id).maybeSingle()
    if (!c || !c.is_active) return json({ ok: false, error: 'coupon_inactive' }, 400)

    const linesForCoupon = orderItemsRows.map((r) => ({
      product_id: r.product_id,
      brand_id: r.brand_id,
      subtotal: r.subtotal,
    }))
    if (!isCouponApplicableForOrder(c, linesForCoupon, totalAmount, user.id)) {
      return json({ ok: false, error: 'coupon_not_applicable' }, 400)
    }

    const { data: mxRow } = await client
      .from('admin_settings')
      .select('value')
      .eq('category', 'coupon')
      .eq('key', 'max_percent_discount')
      .maybeSingle()
    const maxPct = Math.min(100, Math.max(0, Number(mxRow?.value ?? 70)))

    couponDiscount = computeCouponDiscount(totalAmount, c, { maxPercent: maxPct })
    if (couponDiscount <= 0) return json({ ok: false, error: 'coupon_not_applicable' }, 400)
    validatedUserCouponId = uc.id
  }

  const afterCoupon = Math.max(0, totalAmount - couponDiscount)
  const pointUsed = Math.min(usePoints, afterCoupon)
  const chargeUsed = Math.min(useCharge, Math.max(0, afterCoupon - pointUsed))
  const finalAmount = Math.max(0, afterCoupon - pointUsed - chargeUsed)

  const { data: order, error: orderErr } = await client
    .from('orders')
    .insert({
      customer_id: me.id,
      status: '주문확인',
      total_amount: totalAmount,
      point_used: pointUsed,
      charge_used: chargeUsed,
      coupon_discount: couponDiscount,
      final_amount: finalAmount,
      earn_points: 0,
      points_awarded: false,
      share_journal_id: validatedShareJournalId,
      gift_receiver_id: giftTo,
      gift_message: giftMessage,
      user_coupon_id: validatedUserCouponId,
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

  if (finalAmount === 0 && validatedUserCouponId) {
    const db = tryCreateServiceClient() || client
    await db
      .from('user_coupons')
      .update({ status: 'used', used_at: new Date().toISOString(), order_id: order.id })
      .eq('id', validatedUserCouponId)
      .eq('status', 'unused')
  }

  return json({
    ok: true,
    order_id: order.id,
    order_no: order.order_no,
    final_amount: order.final_amount,
  })
}
