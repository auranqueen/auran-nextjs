import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
const REVIEW_TOAST_RATE = 5 // 시바산 정책값 하드코딩, 수정 불가
const SALON_FREE_SHIPPING_THRESHOLD = 50000
const SALON_BASIC_SHIPPING_FEE = 3000
const SALON_JEJU_EXTRA_FEE = 5000
const SALON_ISLAND_EXTRA_FEE = 5000
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const body = await req.json()
  const { salon_id, items, recipient_name, recipient_phone, address, address_detail, checkout_batch_id, dry_run } = body
  if (!salon_id || !Array.isArray(items) || items.length === 0 || !address || (!dry_run && !checkout_batch_id)) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
  const { data: salon } = await service.from('salons').select('id, owner_id').eq('id', salon_id).single()
  if (!salon) return NextResponse.json({ ok: false, error: 'salon_not_found' }, { status: 404 })
  const { data: owner } = await service.from('users').select('id, origin_track, auth_id').eq('id', salon.owner_id).single()
  if (!owner) {
    return NextResponse.json({ ok: false, error: 'owner_not_found' }, { status: 404 })
  }
  const productIds = items.map((i: any) => i.brand_product_id)
  const { data: products } = await service
    .from('brand_products')
    .select('id, brand_id, name, consumer_price, member_price, customer_toast_rate, status')
    .in('id', productIds)
  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }
  if (products.some(p => p.status !== 'active')) {
    return NextResponse.json({ ok: false, error: 'product_not_active' }, { status: 400 })
  }
  const brandIds = Array.from(new Set(products.map(p => p.brand_id)))
  if (brandIds.length !== 1) {
    return NextResponse.json({ ok: false, error: 'multiple_brands_not_allowed' }, { status: 400 })
  }
  const brandId = brandIds[0]
  const { data: link } = await service
    .from('brand_owner_links')
    .select('id').eq('owner_id', owner.id).eq('brand_id', brandId).eq('status', 'active')
    .maybeSingle()
  if (!link) return NextResponse.json({ ok: false, error: 'brand_not_linked' }, { status: 403 })
  // 회원가 판정(서버 재검증) — 이 살롱에서 결제완료/배송완료 이력이 있으면 회원
  const { data: myOrders } = await service
    .from('brand_product_orders')
    .select('id')
    .eq('customer_id', me.id)
    .eq('salon_id', salon_id)
    .in('status', ['결제완료', '배송완료'])
  const isMember = (myOrders || []).length > 0
  // 활성 캠페인 조회(서버 재검증) — 이 원장(owner)이 만든, 지금 시점에 유효한 캠페인
  type CampaignRow = {
    campaign_type: 'bundle' | 'gift' | 'discount'
    target_product_ids: string[]
    buy_qty: number | null
    bonus_qty: number | null
    gift_product_id: string | null
    discount_pct: number | null
  }
  let campaigns: CampaignRow[] = []
  if (owner.auth_id) {
    const { data: ownerProfileRow } = await service.from('profiles').select('id').eq('auth_id', owner.auth_id).maybeSingle()
    if (ownerProfileRow?.id) {
      const nowIso = new Date().toISOString()
      const { data: campaignRows } = await service
        .from('hq_forced_campaigns')
        .select('campaign_type, target_product_ids, buy_qty, bonus_qty, gift_product_id, discount_pct')
        .eq('owner_id', ownerProfileRow.id)
        .eq('is_active', true)
        .lte('start_at', nowIso)
        .gte('end_at', nowIso)
      campaigns = (campaignRows || []) as CampaignRow[]
    }
  }
  const campaignFor = (productId: string) =>
    campaigns.find((c) => Array.isArray(c.target_product_ids) && c.target_product_ids.includes(productId)) || null
  const orderedProductIds = new Set(
    items
      .filter((i: any) => Math.trunc(Number(i.quantity)) >= 1)
      .map((i: any) => String(i.brand_product_id)),
  )
  const isGiftTarget = (productId: string) =>
    campaigns.some(
      (c) =>
        c.campaign_type === 'gift' &&
        c.gift_product_id === productId &&
        Array.isArray(c.target_product_ids) &&
        c.target_product_ids.some((tid) => orderedProductIds.has(String(tid))),
    )
  let subtotal = 0
  let totalCustomerToast = 0
  const orderItems = items.map((i: any) => {
    const p = products.find(pp => pp.id === i.brand_product_id)!
    const qty = Math.trunc(Number(i.quantity)) || 0
    const basePrice = isMember && p.member_price ? p.member_price : p.consumer_price
    const campaign = campaignFor(p.id)
    let unitPrice = basePrice
    let lineSubtotal = basePrice * qty
    if (!isMember && isGiftTarget(p.id)) {
      // 이 상품 자체가 어떤 활성 gift 캠페인의 "증정품"으로 지정된 경우 — 최대 1개까지만 무료, 초과분은 정가. 회원가 대상 제외(일반가에만 적용)
      const freeQty = Math.min(qty, 1)
      const paidQty = qty - freeQty
      lineSubtotal = basePrice * paidQty
      unitPrice = qty > 0 ? Math.round(lineSubtotal / qty) : 0
    } else if (!isMember && campaign?.campaign_type === 'discount' && campaign.discount_pct) {
      unitPrice = Math.round(basePrice * (1 - campaign.discount_pct / 100))
      lineSubtotal = unitPrice * qty
    } else if (!isMember && campaign?.campaign_type === 'bundle' && campaign.buy_qty && campaign.bonus_qty) {
      const setSize = campaign.buy_qty + campaign.bonus_qty
      const completeSets = Math.floor(qty / setSize)
      const freeUnits = completeSets * campaign.bonus_qty
      const chargeableQty = Math.max(0, qty - freeUnits)
      lineSubtotal = basePrice * chargeableQty
      unitPrice = qty > 0 ? Math.round(lineSubtotal / qty) : basePrice
    }
    const lineToast = Math.floor(lineSubtotal * p.customer_toast_rate / 100)
    subtotal += lineSubtotal
    totalCustomerToast += lineToast
    return {
      brand_product_id: p.id,
      product_name: p.name,
      consumer_price: unitPrice,
      quantity: qty,
      subtotal: lineSubtotal,
      customer_toast_rate: p.customer_toast_rate,
      customer_toast_amount: lineToast,
    }
  })
  const basicFee = subtotal >= SALON_FREE_SHIPPING_THRESHOLD ? 0 : SALON_BASIC_SHIPPING_FEE
  let extraFee = 0
  if (address.includes('제주')) extraFee += SALON_JEJU_EXTRA_FEE
  if (address.includes('울릉')) extraFee += SALON_ISLAND_EXTRA_FEE
  const shippingFee = basicFee + extraFee
  const finalAmount = subtotal + shippingFee
  const platformFeeRate = 8.8
  const platformFee = Math.floor(finalAmount * platformFeeRate / 100)
  const ownerAmount = finalAmount - platformFee
  if (dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      subtotal,
      shipping_fee: shippingFee,
      final_amount: finalAmount,
    })
  }
  const orderNo = `BPO${Date.now()}`
  const { data: order, error } = await service
    .from('brand_product_orders')
    .insert({
      order_no: orderNo,
      customer_id: me.id,
      salon_id,
      brand_id: brandId,
      status: '결제대기',
      recipient_name, recipient_phone, address, address_detail,
      subtotal,
      shipping_fee: shippingFee,
      final_amount: finalAmount,
      platform_fee_rate: platformFeeRate,
      platform_fee: platformFee,
      owner_amount: ownerAmount,
      review_toast_rate: REVIEW_TOAST_RATE,
      checkout_batch_id,
      customer_toast_amount: totalCustomerToast,
    })
    .select('id, order_no, final_amount')
    .single()
  if (error || !order) {
    return NextResponse.json({ ok: false, error: 'order_create_failed' }, { status: 500 })
  }
  await service.from('brand_product_order_items').insert(
    orderItems.map(oi => ({ ...oi, order_id: order.id }))
  )
  return NextResponse.json({ ok: true, order_id: order.id, order_no: order.order_no, final_amount: order.final_amount })
}
