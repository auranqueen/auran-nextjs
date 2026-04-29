import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWalletChargeCompleteAlimtalkIfEnabled } from '@/lib/payments/sendWalletChargeCompleteAlimtalk'
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
  if (payState === '4' || (payState as string | number) === 4) {
    if (intent.status !== 'paid') {
      // mark paid
      await supabase
        .from('payment_intents')
        .update({ status: 'paid', paid_at: data.pay_date || new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', intent.id)

      // 원장님 구독 결제: owner_subscriptions + profiles 반영
      if (intent.kind === 'owner_subscription' && intent.user_id && intent.target_id) {
        const client = tryCreateServiceClient() || supabase
        let payload: { owner_id?: string; plan?: string; plan_name?: string; mode?: string; monthly_price?: number } = {}
        try {
          payload = JSON.parse(String(intent.target_id))
        } catch {
          payload = {}
        }
        const ownerId = String(payload.owner_id || intent.user_id)
        const planSlug = String(payload.plan || 'owner_plan')
        const planName = String(payload.plan_name || planSlug)
        const ownerMode = String(payload.mode || 'auran')
        const monthlyPrice = Number(payload.monthly_price ?? intent.amount ?? 0)
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + 1)

        await client.from('owner_subscriptions').insert({
          owner_id: ownerId,
          plan: planSlug,
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          monthly_price: monthlyPrice,
          status: 'active',
        } as any)

        const { data: urow } = await client.from('users').select('auth_id').eq('id', ownerId).maybeSingle()
        if (urow?.auth_id) {
          await client
            .from('profiles')
            .update({ owner_subscription_plan: planSlug, owner_mode: ownerMode } as any)
            .eq('auth_id', urow.auth_id)
        }

        await client.from('notifications').insert({
          user_id: ownerId,
          type: 'promo',
          title: '구독이 시작됐어요 💜',
          body: `${planName} 구독을 시작했어요`,
          icon: '💜',
          is_read: false,
        } as any)
      }

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
        const { error: chargeUserUpdateErr } = await client
          .from('users')
          .update({ charge_balance: nextBalance, points: nextPoints })
          .eq('id', intent.user_id)
        if (!chargeUserUpdateErr) {
          try {
            const payType = String(data.pay_type ?? data.paymethod ?? '')
            const isBank = payType === 'vbank'
            const chargeRate = isBank ? 0.05 : 0.02
            const chargeToast = Math.floor(amount * chargeRate)

            if (chargeToast > 0) {
              const { data: uRow, error: uRowErr } = await client
                .from('users')
                .select('points')
                .eq('id', intent.user_id)
                .maybeSingle()
              if (uRowErr) {
                console.warn('[charge toast uRow]', uRowErr)
              } else if (uRow) {
                const { error: ptErr } = await client
                  .from('users')
                  .update({ points: (Number(uRow.points) || 0) + chargeToast })
                  .eq('id', intent.user_id)
                if (ptErr) console.warn('[charge toast points]', ptErr)
              }

              const { error: ttErr } = await client.from('toast_transactions').insert({
                user_id: intent.user_id,
                amount: chargeToast,
                transaction_type: 'charge',
                description: isBank ? '충전 토스트 적립 (가상계좌 5%)' : '충전 토스트 적립 (카드 2%)',
                reference_id: intent.id,
              } as any)
              if (ttErr) console.warn('[toast_transactions charge bonus]', ttErr)
            }
          } catch (e) {
            console.warn('[charge toast bonus]', e)
          }
        } else {
          console.warn('[charge users.update]', chargeUserUpdateErr)
        }
        await client.from('notifications').insert({
          user_id: intent.user_id,
          type: 'payment',
          title: '충전 완료',
          body: `충전금 ₩${amount.toLocaleString()} · 적립 포인트 ${pointsToAdd.toLocaleString()}P`,
          is_read: false,
        })
        await sendWalletChargeCompleteAlimtalkIfEnabled(client, {
          userId: intent.user_id,
          amount,
          pointsAdded: pointsToAdd,
        })
      }
      // 주문 결제 완료: 알림만 (주문 상태는 이미 주문확인)
      if (intent.kind === 'order' && intent.target_id && intent.user_id) {
        const client = tryCreateServiceClient() || supabase
        const { data: orderRow } = await client
          .from('orders')
          .select(
            'id,order_no,customer_id,share_journal_id,purchase_lead_rewarded,point_used,charge_used,toast_used,gift_receiver_id,gift_message,payment_applied,gift_created,user_coupon_id,address,recipient_name,recipient_phone,order_items(product_id)'
          )
          .eq('id', intent.target_id)
          .maybeSingle()
        const amount = Number(intent.amount || 0)
        await client.from('notifications').insert({
          user_id: intent.user_id,
          type: 'payment',
          title: '주문 결제 완료',
          body: `주문이 결제되었습니다. ₩${amount.toLocaleString()}${orderRow?.order_no ? ` · 주문번호 ${orderRow.order_no}` : ''}`,
          is_read: false,
        })

        const shipAddr = String((orderRow as any)?.address || '').trim()
        const shipName = String((orderRow as any)?.recipient_name || '').trim()
        const shipPhone = String((orderRow as any)?.recipient_phone || '').trim()
        if (shipAddr && intent.user_id) {
          const { data: dupShip } = await client
            .from('shipping_addresses')
            .select('id')
            .eq('user_id', intent.user_id)
            .eq('address', shipAddr)
            .maybeSingle()
          if (!dupShip) {
            await client.from('shipping_addresses').insert({
              user_id: intent.user_id,
              address: shipAddr,
              recipient_name: shipName || null,
              recipient_phone: shipPhone || null,
              is_default: true,
              label: '최근배송지',
            } as any)
          }
          await client.from('users').update({ shipping_address: shipAddr } as any).eq('id', intent.user_id)
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
          const toastUsedOrder = Math.max(0, Number((orderRow as { toast_used?: unknown }).toast_used || 0))
          if (toastUsedOrder > 0) {
            const { error: ttUseErr } = await client.from('toast_transactions').insert({
              user_id: orderRow.customer_id,
              amount: -toastUsedOrder,
              transaction_type: 'use',
              description: '구매 토스트 사용',
              reference_id: orderRow.id,
            } as any)
            if (ttUseErr) console.warn('[toast_transactions use]', ttUseErr)
          }
          const { count: _priorPaidCount } = await client
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('customer_id', orderRow.customer_id)
            .eq('payment_applied', true)
          await client
            .from('orders')
            .update({
              payment_applied: true,
              status: '주문확인',
              payment_status: 'paid',
              payment_method: String(data.pay_type ?? data.paymethod ?? '') || null,
            })
            .eq('id', orderRow.id)
          if ((_priorPaidCount ?? 0) === 0 && intent.user_id) {
            await client.from('notifications').insert({
              user_id: intent.user_id,
              type: 'exclusive_unlock',
              title: '✦ 새로운 케어 세계가 열렸어요',
              body: 'AURAN 회원만 만날 수 있는 프리미엄 아로마 브랜드를 소개합니다',
              is_read: false,
            } as any)

            const { data: fpCoupons } = await client
              .from('coupons')
              .select('id,issued_count,max_issue_count')
              .eq('issue_trigger', 'first_purchase')
              .eq('is_active', true)
            for (const c of fpCoupons || []) {
              if (c.max_issue_count != null && (c.issued_count || 0) >= c.max_issue_count) continue
              const { data: exists } = await client
                .from('user_coupons')
                .select('id')
                .eq('user_id', intent.user_id)
                .eq('coupon_id', c.id)
                .maybeSingle()
              if (exists) continue
              const { error: insErr } = await client.from('user_coupons').insert({
                user_id: intent.user_id,
                coupon_id: c.id,
                status: 'unused',
              })
              if (insErr) continue
              await client
                .from('coupons')
                .update({ issued_count: (c.issued_count || 0) + 1 })
                .eq('id', c.id)
            }
          }

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

          // 브랜드별 상시 쿠폰 (issue_trigger null · scope brand) — unused 없을 때만 발급, issued_count 반영
          if (intent.user_id) {
            let oiList = ((orderRow as any)?.order_items || []) as { product_id?: string | null }[]
            const pidFromOi = (rows: { product_id?: string | null }[]) =>
              Array.from(
                new Set(rows.map((x) => x?.product_id).filter((id): id is string => Boolean(id)))
              )
            let productIds = pidFromOi(oiList)
            if (!productIds.length && orderRow.id) {
              const { data: oiRows } = await client.from('order_items').select('product_id').eq('order_id', orderRow.id)
              oiList = (oiRows || []) as { product_id?: string | null }[]
              productIds = pidFromOi(oiList)
            }
            if (productIds.length) {
              const { data: prows } = await client.from('products').select('brand_id').in('id', productIds)
              const brandIds = Array.from(
                new Set((prows || []).map((p: { brand_id?: string | null }) => p?.brand_id).filter((id): id is string => Boolean(id)))
              )
              if (brandIds.length) {
                const { data: brandCoupons } = await client
                  .from('coupons')
                  .select('id,issued_count,max_issue_count,scope_brand_ids')
                  .is('issue_trigger', null)
                  .eq('scope', 'brand')
                  .eq('is_active', true)
                for (const c of brandCoupons || []) {
                  const scopeIds = (c.scope_brand_ids || []) as string[]
                  const applies = brandIds.some((bid) => scopeIds.includes(bid))
                  if (!applies) continue
                  if (c.max_issue_count != null && (c.issued_count || 0) >= c.max_issue_count) continue
                  const { data: unusedRow } = await client
                    .from('user_coupons')
                    .select('id')
                    .eq('user_id', intent.user_id)
                    .eq('coupon_id', c.id)
                    .eq('status', 'unused')
                    .maybeSingle()
                  if (unusedRow) continue
                  const { error: bcErr } = await client.from('user_coupons').insert({
                    user_id: intent.user_id,
                    coupon_id: c.id,
                    status: 'unused',
                  })
                  if (bcErr) continue
                  await client
                    .from('coupons')
                    .update({ issued_count: (c.issued_count || 0) + 1 })
                    .eq('id', c.id)
                }
              }
            }
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
        await client.from('notifications').insert({
          user_id: intent.user_id,
          type: 'payment',
          title: '충전 취소',
          body: `₩${amount.toLocaleString()} 충전이 취소되었습니다. 지갑 잔액이 조정되었습니다.`,
          is_read: false,
        })
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
          if (orderRow.customer_id) {
            await client.from('notifications').insert({
              user_id: orderRow.customer_id,
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

