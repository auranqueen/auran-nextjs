import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { insertBrandOrder } from '@/lib/brand/insertBrandOrder'

function yyyymmddLocal(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function random4(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}

function makeOrderNo(): string {
  return `ORD-${yyyymmddLocal()}-${random4()}`
}

type CartBrandGroup = {
  brand_id: string
  profile_id: string
  owner_name?: string
  salon_name?: string
  grade?: string
  items: unknown[]
  total_qty?: number
  total_amount?: number
  promo_applied?: string | null
  promo?: string | null
  points_earned?: number
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized', message: '로그인이 필요합니다' }, { status: 401 })
  }

  const svc = tryCreateAdminClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: '서버 오류' }, { status: 500 })
  }

  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const cartItems = Array.isArray(body?.cartItems) ? (body.cartItems as CartBrandGroup[]) : null
  if (!cartItems || cartItems.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
  }

  for (const g of cartItems) {
    if (!g?.brand_id || !g?.profile_id || !Array.isArray(g.items) || g.items.length === 0) {
      return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
    }
    if (g.profile_id !== profile.id) {
      return NextResponse.json({ ok: false, error: 'profile_mismatch', message: '프로필이 일치하지 않습니다' }, { status: 403 })
    }
  }

  const ownerName = String(cartItems[0]?.owner_name || '')
  const salonName = String(cartItems[0]?.salon_name || '')
  const totalAmount = cartItems.reduce((s, g) => s + Math.trunc(Number(g.total_amount) || 0), 0)

  let batchId: string | null = null
  let orderNo: string | null = null
  const maxAttempts = 8
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = makeOrderNo()
    const { data: batch, error: batchErr } = await svc
      .from('brand_order_batches')
      .insert({
        order_no: candidate,
        profile_id: profile.id,
        owner_name: ownerName,
        salon_name: salonName,
        total_amount: totalAmount,
        status: '승인대기',
      })
      .select('id, order_no')
      .single()

    if (!batchErr && batch?.id) {
      batchId = batch.id
      orderNo = batch.order_no
      break
    }
    const msg = String(batchErr?.message || '')
    const code = String((batchErr as { code?: string } | null)?.code || '')
    const isUnique = code === '23505' || /duplicate|unique/i.test(msg)
    if (!isUnique) {
      return NextResponse.json(
        { ok: false, error: 'batch_insert_failed', message: batchErr?.message || '배치 생성 실패' },
        { status: 500 },
      )
    }
  }

  if (!batchId || !orderNo) {
    return NextResponse.json(
      { ok: false, error: 'order_no_conflict', message: '주문번호 생성에 실패했습니다. 다시 시도해주세요' },
      { status: 500 },
    )
  }

  const orderIds: string[] = []
  for (const g of cartItems) {
    const promoApplied =
      g.promo_applied != null
        ? String(g.promo_applied)
        : g.promo != null
          ? String(g.promo)
          : null
    const result = await insertBrandOrder(svc, {
      brand_id: g.brand_id,
      profile_id: g.profile_id,
      owner_name: g.owner_name || ownerName,
      salon_name: g.salon_name || salonName,
      grade: g.grade || '',
      items: g.items,
      total_qty: g.total_qty,
      total_amount: g.total_amount,
      promo_applied: promoApplied,
      points_earned: g.points_earned,
      batch_id: batchId,
    })
    if (!result.ok) {
      await svc.from('brand_orders').delete().eq('batch_id', batchId)
      await svc.from('brand_order_batches').delete().eq('id', batchId)
      const status = result.error === 'unpaid_invoice' ? 403 : 500
      return NextResponse.json(
        { ok: false, error: result.error, message: result.message },
        { status },
      )
    }
    orderIds.push(result.order_id)
  }

  return NextResponse.json({
    ok: true,
    batch_id: batchId,
    order_no: orderNo,
    order_ids: orderIds,
  })
}
