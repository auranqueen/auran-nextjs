import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/payments/payapp/cancel
 * 결제(충전) 취소: 지갑 잔액 차감 + 적립 포인트 회수.
 * - intent_id 또는 provider_trade_id 필수.
 * - 잔액 부족 시 취소 불가.
 * - 취소 완료 후 notifications 테이블에 알림 insert.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const intentId = typeof body?.intent_id === 'string' ? body.intent_id.trim() : null
  const providerTradeId = typeof body?.provider_trade_id === 'string' ? body.provider_trade_id.trim() : null

  if (!intentId && !providerTradeId) {
    return NextResponse.json({ ok: false, error: 'intent_id or provider_trade_id required' }, { status: 400 })
  }

  const service = tryCreateServiceClient()
  const client = service || supabase

  // 내 users.id 조회
  const { data: me } = await client.from('users').select('id').eq('auth_id', user.id).single()
  if (!me?.id) return NextResponse.json({ ok: false, error: 'user_row_missing' }, { status: 400 })

  let intent: { id: string; user_id: string; kind: string; status: string; amount: number } | null = null

  if (intentId) {
    const { data } = await client.from('payment_intents').select('id, user_id, kind, status, amount').eq('id', intentId).maybeSingle()
    intent = data
  } else if (providerTradeId) {
    const { data } = await client
      .from('payment_intents')
      .select('id, user_id, kind, status, amount')
      .eq('provider', 'payapp')
      .eq('provider_trade_id', providerTradeId)
      .maybeSingle()
    intent = data
  }

  if (!intent || intent.user_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'intent_not_found_or_unauthorized' }, { status: 404 })
  }
  if (intent.kind !== 'charge') {
    return NextResponse.json({ ok: false, error: 'only_charge_cancellable' }, { status: 400 })
  }
  if (intent.status !== 'paid') {
    return NextResponse.json({ ok: false, error: 'intent_not_paid' }, { status: 400 })
  }

  const amount = Number(intent.amount) || 0
  const { data: ratesBase } = await client
    .from('admin_settings')
    .select('value')
    .eq('category', 'points_payment')
    .eq('key', 'wallet_charge_rate')
    .maybeSingle()
  const { data: ratesBonus } = await client
    .from('admin_settings')
    .select('value')
    .eq('category', 'star_benefit')
    .eq('key', 'lv2_charge_bonus')
    .maybeSingle()

  const { data: u } = await client.from('users').select('charge_balance, points, star_level').eq('id', me.id).single()
  const baseRatePct = Number(ratesBase?.value ?? 5)
  const bonusRatePct = Number(ratesBonus?.value ?? 3)
  const basePoints = Math.floor(amount * (baseRatePct / 100))
  const extraPoints = u?.star_level && u.star_level >= 2 ? Math.floor(amount * (bonusRatePct / 100)) : 0
  const pointsReclaim = basePoints + extraPoints
  const curBalance = Number(u?.charge_balance || 0)
  const curPoints = Number(u?.points || 0)

  if (curBalance < amount) {
    return NextResponse.json({ ok: false, error: 'insufficient_balance', message: '잔액 부족으로 취소할 수 없습니다.' }, { status: 400 })
  }

  const nextBalance = curBalance - amount
  const nextPoints = Math.max(0, curPoints - pointsReclaim)

  await client.from('users').update({
    charge_balance: nextBalance,
    points: nextPoints,
  }).eq('id', me.id)

  await client.from('payment_intents').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', intent.id)

  // notifications: user_id = auth.users id (auth_id)
  const notifBody = `₩${amount.toLocaleString()} 충전이 취소되었습니다. 지갑 잔액이 조정되었습니다.`
  await client.from('notifications').insert({
    user_id: user.id,
    type: 'payment',
    title: '충전 취소',
    body: notifBody,
    is_read: false,
  })

  return NextResponse.json({
    ok: true,
    intent_id: intent.id,
    amount,
    points_reclaimed: pointsReclaim,
    new_balance: nextBalance,
    new_points: nextPoints,
  })
}
