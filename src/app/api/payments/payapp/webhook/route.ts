import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

async function readRawBody(req: NextRequest) {
  const buf = await req.arrayBuffer()
  return Buffer.from(buf).toString('utf8')
}

function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  const sp = new URLSearchParams(body)
  // Avoid downlevelIteration issues in Next build
  sp.forEach((v, k) => {
    out[k] = v
  })
  return out
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const raw = await readRawBody(req)
  const data = parseForm(raw)

  const mulNo = data.mul_no || null
  const payState = data.pay_state || ''

  if (mulNo?.startsWith('sandbox-')) return new NextResponse('SUCCESS', { status: 200 })

  // log webhook first
  await supabase.from('payment_webhook_logs').insert({
    provider: 'payapp',
    provider_trade_id: mulNo,
    event_type: payState,
    raw_body: raw,
    headers: Object.fromEntries(req.headers.entries()),
    verified: false,
    handled: false,
  })

  // Verify seller credentials + amount match
  const userid = mustEnv('PAYAPP_USER_ID')
  const linkkey = mustEnv('PAYAPP_LINKKEY')
  const linkval = mustEnv('PAYAPP_LINKVAL')

  const checkUser = data.userid === userid
  const checkKey = data.linkkey === linkkey
  const checkVal = data.linkval === linkval
  if (!checkUser || !checkKey || !checkVal) {
    // IMPORTANT: return SUCCESS to stop retries, but do not process
    return new NextResponse('SUCCESS', { status: 200 })
  }

  // Correlate to our intent: prefer var1 (intent id), fallback mul_no lookup
  const intentId = data.var1 || null
  let intent: any = null

  if (intentId) {
    const { data: found } = await supabase.from('payment_intents').select('*').eq('id', intentId).maybeSingle()
    intent = found
  } else if (mulNo) {
    const { data: found } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('provider', 'payapp')
      .eq('provider_trade_id', mulNo)
      .maybeSingle()
    intent = found
  }

  if (!intent) return new NextResponse('SUCCESS', { status: 200 })

  // amount check
  const price = Number(data.price)
  if (!Number.isFinite(price) || price !== Number(intent.amount)) {
    return new NextResponse('SUCCESS', { status: 200 })
  }

  // PayApp pay_state: 4=paid, 9/64=cancel, 8/16/31=request cancel, 10=pending
  if (payState === '4') {
    if (intent.status !== 'paid') {
      // mark paid
      await supabase
        .from('payment_intents')
        .update({ status: 'paid', paid_at: data.pay_date || new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', intent.id)

      // domain apply: charge => increase charge_balance + 5% 포인트 적립 + 알림
      if (intent.kind === 'charge' && intent.user_id) {
        const amount = Number(intent.amount || 0)
        const client = tryCreateServiceClient() || supabase
        const { data: u } = await client.from('users').select('charge_balance, points, star_level').eq('id', intent.user_id).single()

        const { data: baseRateRow } = await client
          .from('admin_settings')
          .select('value')
          .eq('category', 'points_payment')
          .eq('key', 'wallet_charge_rate')
          .maybeSingle()

        const { data: bonusRateRow } = await client
          .from('admin_settings')
          .select('value')
          .eq('category', 'star_benefit')
          .eq('key', 'lv2_charge_bonus')
          .maybeSingle()

        const baseRatePct = Number(baseRateRow?.value ?? 5)
        const bonusRatePct = Number(bonusRateRow?.value ?? 3)

        const basePointsToAdd = Math.floor(amount * (baseRatePct / 100))
        const extraPointsToAdd = u?.star_level && u.star_level >= 2 ? Math.floor(amount * (bonusRatePct / 100)) : 0
        const pointsToAdd = basePointsToAdd + extraPointsToAdd

        const nextBalance = Number(u?.charge_balance || 0) + amount
        const nextPoints = Number(u?.points || 0) + pointsToAdd
        await client.from('users').update({ charge_balance: nextBalance, points: nextPoints }).eq('id', intent.user_id)
        const { data: userRow } = await client.from('users').select('auth_id').eq('id', intent.user_id).single()
        if (userRow?.auth_id) {
          await client.from('notifications').insert({
            user_id: userRow.auth_id,
            type: 'payment',
            title: '충전 완료',
            body: `충전금 ₩${amount.toLocaleString()} · 적립 포인트 ${pointsToAdd.toLocaleString()}P`,
            is_read: false,
          })
        }
      }
      // 주문 결제 완료: 알림만 (주문 상태는 이미 주문확인)
      if (intent.kind === 'order' && intent.target_id && intent.user_id) {
        const client = tryCreateServiceClient() || supabase
        const { data: orderRow } = await client
          .from('orders')
          .select('id,order_no,customer_id,share_journal_id,purchase_lead_rewarded,point_used,charge_used,gift_receiver_id,gift_message,payment_applied,gift_created,user_coupon_id')
          .eq('id', intent.target_id)
          .maybeSingle()
        const { data: userRow } = await client.from('users').select('auth_id').eq('id', intent.user_id).single()
        const amount = Number(intent.amount || 0)
        if (userRow?.auth_id) {
          await client.from('notifications').insert({
            user_id: userRow.auth_id,
            type: 'payment',
            title: '주문 결제 완료',
            body: `주문이 결제되었습니다. ₩${amount.toLocaleString()}${orderRow?.order_no ? ` · 주문번호 ${orderRow.order_no}` : ''}`,
            is_read: false,
          })
        }

        if (orderRow?.id && !orderRow.payment_applied) {
          const pointUsed = Math.max(0, Number(orderRow.point_used || 0))
          const chargeUsed = Math.max(0, Number(orderRow.charge_used || 0))
          if (pointUsed > 0 || chargeUsed > 0) {
            const { data: buyer } = await client
              .from('users')
              .select('points,charge_balance')
              .eq('id', orderRow.customer_id)
              .maybeSingle()
            if (buyer) {
              const nextPoints = Math.max(0, Number(buyer.points || 0) - pointUsed)
              const nextCharge = Math.max(0, Number(buyer.charge_balance || 0) - chargeUsed)
              await client.from('users').update({ points: nextPoints, charge_balance: nextCharge }).eq('id', orderRow.customer_id)
            }
          }
          await client.from('orders').update({ payment_applied: true }).eq('id', orderRow.id)

          if (orderRow.user_coupon_id) {
            await client
              .from('user_coupons')
              .update({
                status: 'used',
                used_at: new Date().toISOString(),
                order_id: orderRow.id,
              })
              .eq('id', orderRow.user_coupon_id)
              .eq('status', 'unused')
          }
        }

        if (orderRow?.id && orderRow.gift_receiver_id && !orderRow.gift_created) {
          const { data: oi } = await client.from('order_items').select('product_id').eq('order_id', orderRow.id).limit(1).maybeSingle()
          if (oi?.product_id) {
            await client.from('gifts').insert({
              sender_id: orderRow.customer_id,
              receiver_id: orderRow.gift_receiver_id,
              product_id: oi.product_id,
              message: orderRow.gift_message || null,
              status: 'pending',
            })
            const { data: notifOn } = await client
              .from('admin_settings')
              .select('value')
              .eq('category', 'gift')
              .eq('key', 'gift_notification_enabled')
              .maybeSingle()
            const notifEnabled = Number(notifOn?.value ?? 1) === 1
            if (notifEnabled) {
              const { data: sender } = await client.from('users').select('name').eq('id', orderRow.customer_id).maybeSingle()
              const senderName = (sender as any)?.name || 'OO'
              await client.from('notifications').insert({
                user_id: orderRow.gift_receiver_id,
                type: 'gift',
                title: '🎁 선물이 도착했어요',
                body: `${senderName}님이 선물을 보냈어요! 선물함을 확인하세요`,
                is_read: false,
              })
            }
            await client.from('orders').update({ gift_created: true }).eq('id', orderRow.id)
          }
        }

        // 공유링크 구매 유도 리워드 (중복 지급 방지: order.purchase_lead_rewarded)
        if (orderRow?.share_journal_id && !orderRow.purchase_lead_rewarded) {
          const { data: shareJournal } = await client
            .from('skin_journals')
            .select('id,user_id')
            .eq('id', orderRow.share_journal_id)
            .maybeSingle()

          if (shareJournal?.user_id && String(shareJournal.user_id) !== String(orderRow.customer_id)) {
            const { data: leadPointRow } = await client
              .from('admin_settings')
              .select('value')
              .eq('category', 'points_action')
              .eq('key', 'share_purchase')
              .maybeSingle()

            const purchaseLeadPoints = Number(leadPointRow?.value ?? 500)

            // 포인트 적립: 기존 DB 함수 사용 (users.points + point_history 동시 처리)
            await client.rpc('award_points', {
              p_user_id: shareJournal.user_id,
              p_amount: purchaseLeadPoints,
              p_description: '공유링크 구매 유도',
              p_icon: '🔗',
              p_order_id: orderRow.id,
            })

            const { data: ownerRow } = await client.from('users').select('purchase_leads').eq('id', shareJournal.user_id).single()
            const nextLeads = Number(ownerRow?.purchase_leads || 0) + 1
            await client.from('users').update({ purchase_leads: nextLeads }).eq('id', shareJournal.user_id)

            await client
              .from('orders')
              .update({ purchase_lead_rewarded: true })
              .eq('id', orderRow.id)

            await client.from('notifications').insert({
              user_id: shareJournal.user_id,
              type: 'system',
              title: '공유링크 구매 발생',
              body: `내 공유링크로 구매가 발생했어요. ${purchaseLeadPoints.toLocaleString()}P 적립!`,
              is_read: false,
            })

            // 스타 레벨 캐시 갱신
            await client.rpc('recalc_user_star_levels', { p_user_id: shareJournal.user_id })
          } else {
            await client
              .from('orders')
              .update({ purchase_lead_rewarded: true })
              .eq('id', orderRow.id)
          }
        }
      }
    }
  } else if (payState === '9' || payState === '64' || payState === '70' || payState === '71' || payState === '8' || payState === '16' || payState === '31') {
    if (intent.status !== 'cancelled') {
      const client = tryCreateServiceClient() || supabase
      if (intent.status === 'paid' && intent.kind === 'charge' && intent.user_id) {
        const amount = Number(intent.amount || 0)
        const { data: u } = await client.from('users').select('charge_balance, points, star_level').eq('id', intent.user_id).single()
        const { data: baseRateRow } = await client
          .from('admin_settings')
          .select('value')
          .eq('category', 'points_payment')
          .eq('key', 'wallet_charge_rate')
          .maybeSingle()
        const { data: bonusRateRow } = await client
          .from('admin_settings')
          .select('value')
          .eq('category', 'star_benefit')
          .eq('key', 'lv2_charge_bonus')
          .maybeSingle()
        const baseRatePct = Number(baseRateRow?.value ?? 5)
        const bonusRatePct = Number(bonusRateRow?.value ?? 3)
        const basePoints = Math.floor(amount * (baseRatePct / 100))
        const extraPoints = u?.star_level && u.star_level >= 2 ? Math.floor(amount * (bonusRatePct / 100)) : 0
        const pointsReclaim = basePoints + extraPoints
        const curBalance = Number(u?.charge_balance || 0)
        const curPoints = Number(u?.points || 0)
        const nextBalance = Math.max(0, curBalance - amount)
        const nextPoints = Math.max(0, curPoints - pointsReclaim)
        await client.from('users').update({ charge_balance: nextBalance, points: nextPoints }).eq('id', intent.user_id)
        const { data: userRow } = await client.from('users').select('auth_id').eq('id', intent.user_id).single()
        if (userRow?.auth_id) {
          await client.from('notifications').insert({
            user_id: userRow.auth_id,
            type: 'payment',
            title: '충전 취소',
            body: `₩${amount.toLocaleString()} 충전이 취소되었습니다. 지갑 잔액이 조정되었습니다.`,
            is_read: false,
          })
        }
      }
      if (intent.status === 'paid' && intent.kind === 'order' && intent.target_id) {
        const { data: orderRow } = await client
          .from('orders')
          .select('id,customer_id,point_used,charge_used,payment_applied')
          .eq('id', intent.target_id)
          .maybeSingle()
        if (orderRow?.id) {
          if (orderRow.payment_applied) {
            const pointUsed = Math.max(0, Number(orderRow.point_used || 0))
            const chargeUsed = Math.max(0, Number(orderRow.charge_used || 0))
            if (pointUsed > 0 || chargeUsed > 0) {
              const { data: buyer } = await client
                .from('users')
                .select('points,charge_balance')
                .eq('id', orderRow.customer_id)
                .maybeSingle()
              if (buyer) {
                await client
                  .from('users')
                  .update({
                    points: Number(buyer.points || 0) + pointUsed,
                    charge_balance: Number(buyer.charge_balance || 0) + chargeUsed,
                  })
                  .eq('id', orderRow.customer_id)
              }
            }
          }
          const { restoreUserCouponForOrder } = await import('@/lib/coupon/restoreForOrder')
          await restoreUserCouponForOrder(orderRow.id)
          await client
            .from('orders')
            .update({ status: '취소', payment_applied: false })
            .eq('id', orderRow.id)
          const { data: buyerAuth } = await client.from('users').select('auth_id').eq('id', orderRow.customer_id).maybeSingle()
          if (buyerAuth?.auth_id) {
            await client.from('notifications').insert({
              user_id: buyerAuth.auth_id,
              type: 'system',
              title: '주문 결제 취소',
              body: '결제가 취소되었습니다. 쿠폰은 다시 사용할 수 있어요.',
              is_read: false,
            })
          }
        }
      }
      await supabase
        .from('payment_intents')
        .update({ status: 'cancelled', cancelled_at: data.canceldate || new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', intent.id)
    }
  } else {
    // pending/unknown: do nothing
  }

  return new NextResponse('SUCCESS', { status: 200 })
}

