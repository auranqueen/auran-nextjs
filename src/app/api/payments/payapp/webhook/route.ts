import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWalletChargeCompleteAlimtalkIfEnabled } from '@/lib/payments/sendWalletChargeCompleteAlimtalk'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { addToPurchaseAmount, autoUpgradeGrade } from '@/lib/gradeUtils'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'
import { handleBrandTierPurchase } from '@/lib/webhookHandlers/brandTierPurchase'
import { handleBrandProductOrderComplete, handleBrandProductOrderCancel } from '@/lib/webhookHandlers/brandProductOrder'

const ANNUAL_STORE_PLAN_SLUGS = new Set([
  'track_a_store_annual',
  'track_b_store_annual',
  'track_a_showcase_annual',
  'track_b_showcase_annual',
])

function mustEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v.trim()
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
  const checkKey = decodeURIComponent(data.linkkey?.trim() ?? '') === linkkey
  const checkVal = decodeURIComponent(data.linkval?.trim() ?? '') === linkval
  if (!checkUser || !checkKey || !checkVal) {
    console.log('[webhook verify]', {
      checkUser,
      checkKey,
      checkVal,
      dataUserid: data.userid,
      dataLinkkey: data.linkkey?.trim(),
      dataLinkkeyDecoded: decodeURIComponent(data.linkkey?.trim() ?? ''),
      envLinkkey: linkkey,
      dataLinkval: data.linkval?.trim(),
      dataLinkvalDecoded: decodeURIComponent(data.linkval?.trim() ?? ''),
      envLinkval: linkval,
    })
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

  // pay_state=10: 가상계좌 입금대기
  if (payState === '10' || (payState as string | number) === 10) {
    const client = tryCreateServiceClient() || supabase
    if (intent.kind === 'order' && intent.target_id) {
      await client
        .from('orders')
        .update({ status: '입금대기', payment_status: 'pending' })
        .eq('id', intent.target_id)
        .eq('payment_applied', false)
    }
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
        const isTrackPlan = planSlug.startsWith('track_a_') || planSlug.startsWith('track_b_')
        const ownerMode = String(payload.mode || 'auran')
        const monthlyPrice = Number(payload.monthly_price ?? intent.amount ?? 0)
        const expiresAt = new Date()
        if (ANNUAL_STORE_PLAN_SLUGS.has(planSlug)) {
          expiresAt.setFullYear(expiresAt.getFullYear() + 1)
        } else {
          expiresAt.setMonth(expiresAt.getMonth() + 1)
        }

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
          const profileUpdate: { owner_subscription_plan: string; owner_mode?: string } = {
            owner_subscription_plan: planSlug,
          }
          if (!isTrackPlan) {
            profileUpdate.owner_mode = ownerMode
          }
          await client.from('profiles').update(profileUpdate as any).eq('auth_id', urow.auth_id)
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

      if (intent.kind === 'brand_tier_purchase' && intent.target_id) {
        const client = tryCreateServiceClient() || supabase
        await handleBrandTierPurchase(intent, client)
      }

      // ★ 멤버십 결제 완료 — 기존 분기 그대로 두고 이 블록만 추가
      if (intent.kind === 'membership' && intent.user_id && intent.target_id) {
        const client = tryCreateServiceClient() || supabase
        const planId = String(intent.target_id)
        const { data: plan } = await client
          .from('membership_plans')
          .select('shipments_per_year, interval_months')
          .eq('id', planId)
          .maybeSingle()
        const total = Number(plan?.shipments_per_year ?? 6)
        const interval = Number(plan?.interval_months ?? 2)
        const now = new Date()
        const expires = new Date(now); expires.setFullYear(expires.getFullYear() + 1)
        const next = new Date(now); next.setMonth(next.getMonth() + interval)
        const { data: existingMembership } = await client
          .from('user_memberships').select('id').eq('source_id', intent.id).maybeSingle()
        if (!existingMembership) {
          await client.from('user_memberships').insert({
            user_id: intent.user_id,
            plan_id: planId,
            status: 'active',
            started_at: now.toISOString(),
            expires_at: expires.toISOString(),
            shipments_total: total,
            shipments_remaining: total,
            next_shipment_date: next.toISOString().slice(0, 10),
            source_type: 'payment_intent',
            source_id: intent.id,
          } as any)
          await client.from('notifications').insert({
            user_id: intent.user_id,
            type: 'promo',
            title: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
            body: '두 달마다, 오렌이 고른 리추얼이 도착해요',
            is_read: false,
          } as any)
          // 상담톡 + 알림톡
          try {
            const client2 = tryCreateServiceClient() || supabase
            const userId = intent.user_id
            // 배송지 확인
            const { data: addrRow } = await client2
              .from('shipping_addresses')
              .select('id')
              .eq('user_id', userId)
              .eq('is_default', true)
              .maybeSingle()
            const hasAddress = !!addrRow
            // 다음 배송일
            const { data: memRow } = await client2
              .from('user_memberships')
              .select('next_shipment_date')
              .eq('user_id', userId)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            const nextDate = (memRow as any)?.next_shipment_date || ''
            // 상담톡
            let channelId: string | null = null
            const { data: chRow } = await client2
              .from('chat_channels')
              .select('id')
              .eq('user_id', userId)
              .eq('channel_type', 'owner')
              .maybeSingle()
            channelId = (chRow as any)?.id || null
            if (!channelId) {
              const { data: newCh } = await client2
                .from('chat_channels')
                .insert({
                  user_id: userId,
                  channel_type: 'owner',
                  title: '원장님 상담',
                  preview_text: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
                  unread_count: 1,
                  is_online: false,
                } as any)
                .select('id')
                .maybeSingle()
              channelId = (newCh as any)?.id || null
            }
            if (channelId) {
              const chatMsg = hasAddress
                ? `안녕하세요 💜 ORÆN PRIVÉ 멤버십 결제가 완료됐어요!\n\n첫 배송일은 ${nextDate}입니다.\n오렌이 정성껏 리추얼을 준비할게요.\n\n궁금한 점은 언제든 말씀해주세요 🌙`
                : `안녕하세요 💜 ORÆN PRIVÉ 멤버십 결제가 완료됐어요!\n\n배송지를 등록해주세요:\nauran.kr/my/addresses\n\n등록 완료 후 첫 리추얼을 보내드릴게요 🌙`
              await client2.from('consultation_messages').insert({
                channel_id: channelId,
                sender_id: userId,
                message: chatMsg,
                message_kind: 'text',
                is_from_customer: false,
              } as any)
              await client2.from('chat_channels').update({
                last_message: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
                last_message_at: new Date().toISOString(),
                unread_count: 1,
                preview_text: 'ORÆN PRIVÉ 멤버십이 시작됐어요 💜',
              }).eq('id', channelId)
            }
            // 알림톡
            const { data: userRow } = await client2
              .from('users')
              .select('phone, name')
              .eq('id', userId)
              .maybeSingle()
            if ((userRow as any)?.phone) {
              const name = (userRow as any)?.name || '고객'
              const alimMsg = hasAddress
                ? `[ORÆN PRIVÉ] ${name}님, 멤버십 결제가 완료됐어요 💜\n\n첫 배송일: ${nextDate}\n오렌이 정성껏 리추얼을 준비할게요.`
                : `[ORÆN PRIVÉ] ${name}님, 멤버십 결제가 완료됐어요 💜\n\n배송지를 등록해주세요:\nhttps://auran.kr/my/addresses`
              await sendPpurioAlimtalk({
                phone: (userRow as any).phone,
                message: alimMsg,
                title: 'ORÆN PRIVÉ 멤버십 시작',
              }).catch(() => {})
            }
          } catch (_) {}
        }
      }

      // 멤버십 결제 누적구매액 + 등급 자동 승급
      if (intent.kind === 'membership' && intent.user_id && intent.amount) {
        try {
          const client = tryCreateServiceClient() || supabase
          await addToPurchaseAmount(intent.user_id, intent.amount, client)
          await autoUpgradeGrade(intent.user_id, client)
        } catch (_) {}
      }

      // ★ 멤버십 "선물" 결제 완료 — 기존 분기 그대로 두고 이 블록만 추가
      if (intent.kind === 'membership_gift' && intent.target_id) {
        const client = tryCreateServiceClient() || supabase
        const giftId = String(intent.target_id)
        const { data: gift } = await client
          .from('membership_gifts')
          .select('id, gifted_by, claim_token, status')
          .eq('id', giftId)
          .maybeSingle()
        if (gift && gift.status === 'pending') {
          await client
            .from('membership_gifts')
            .update({
              status: 'paid',
              source_type: 'payment_intent',
              source_id: intent.id,
            })
            .eq('id', giftId)
            .eq('status', 'pending')
          if (gift.gifted_by) {
            await client.from('notifications').insert({
              user_id: gift.gifted_by,
              type: 'promo',
              title: 'ORÆN PRIVÉ 선물이 준비됐어요 🎁',
              body: '받는 분께 이 링크를 보내주세요: https://auran.kr/membership/claim/' + gift.claim_token,
              is_read: false,
            } as any)
            // 선물 받을 사람 알림 + 알림톡 + 상담톡은 claim 수령 시 처리됨
            // 보낸 사람 알림톡 추가
            try {
              const { data: senderRow } = await client
                .from('users')
                .select('phone, name')
                .eq('id', gift.gifted_by)
                .maybeSingle()
              if ((senderRow as any)?.phone) {
                await sendPpurioAlimtalk({
                  phone: (senderRow as any).phone,
                  message: `[ORÆN PRIVÉ] 선물 결제가 완료됐어요 🎁\n\n아래 링크를 받는 분께 보내주세요:\nhttps://auran.kr/membership/claim/${gift.claim_token}`,
                  title: 'ORÆN PRIVÉ 선물 발송',
                }).catch(() => {})
              }
            } catch (_) {}
          }
        }
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

        const { error: chargeUserUpdateErr } = await client.rpc('increment_charge_balance', { user_id: intent.user_id, amount: amount })
        if (!chargeUserUpdateErr) {
          try {
            const payType = String(data.pay_type ?? data.paymethod ?? '')
            const isBank = payType === 'vbank'
            const chargeRate = isBank ? 0.05 : 0.02
            const chargeToast = Math.floor(amount * chargeRate)

            if (chargeToast > 0) {
              const { error: ptErr } = await client.rpc('increment_points', { user_id: intent.user_id, amount: chargeToast })
              if (ptErr) console.warn('[charge toast points]', ptErr)

              const { error: ttErr } = await client.from('toast_transactions').insert({
                user_id: intent.user_id,
                amount: chargeToast,
                transaction_type: 'charge',
                source_type: 'system',
                source_id: intent.id,
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
      // 예약 결제 완료: purchases insert + 정산 계산
      if (intent.kind === 'booking' && intent.user_id && intent.target_id) {
        try {
          const client = tryCreateServiceClient() || supabase
          // target_id: "salonId|serviceName|servicePrice|sessions|partnerFeeRate"
          const parts = String(intent.target_id).split('|')
          const salonId = parts[0] || ''
          const serviceName = parts[1] || ''
          const servicePrice = Number(parts[2] || 0)
          const totalSessions = Number(parts[3] || 1)
          const partnerFeeRate = Number(parts[4] || 0)
          const reviewerId = parts[8] || ''
          const paymentAmount = Number(intent.amount || 0)
          // 수수료 계산
          const platformFeeRate = 8.8
          const platformFee = Math.floor(paymentAmount * platformFeeRate / 100)
          // 파트너스 확인 (고객의 partner_ref)
          const { data: customerRow } = await client
            .from('users')
            .select('id, partner_ref')
            .eq('id', intent.user_id)
            .maybeSingle()
          const partnerId = customerRow?.partner_ref || null
          const partnerFee = partnerId && partnerFeeRate > 0
            ? Math.floor(paymentAmount * partnerFeeRate / 100)
            : 0
          const partnerFeePerSession = totalSessions > 0
            ? Math.floor(partnerFee / totalSessions)
            : 0
          const ownerAmount = paymentAmount - platformFee - partnerFee
          // salon owner_id 조회
          const { data: salonRow } = await client
            .from('salons')
            .select('owner_id')
            .eq('id', salonId)
            .maybeSingle()
          // 중복 방지
          const { data: existing } = await client
            .from('purchases')
            .select('id')
            .eq('payment_id', String(intent.id))
            .maybeSingle()
          if (!existing) {
            const { data: newPurchase } = await client
              .from('purchases')
              .insert({
                customer_id: intent.user_id,
                salon_id: salonId,
                owner_id: salonRow?.owner_id || null,
                service_name: serviceName,
                service_price: servicePrice,
                total_sessions: totalSessions,
                used_sessions: 0,
                remaining: totalSessions,
                payment_id: String(intent.id),
                payment_amount: paymentAmount,
                platform_fee_rate: platformFeeRate,
                platform_fee: platformFee,
                partner_id: partnerId,
                partner_fee_rate: partnerFeeRate,
                partner_fee: partnerFee,
                partner_fee_per_session: partnerFeePerSession,
                partner_fee_paid: 0,
                partner_fee_remaining: partnerFee,
                owner_amount: ownerAmount,
                reviewer_id: reviewerId || null,
                status: 'active',
                settlement_status: 'pending',
                purchased_at: new Date().toISOString(),
              })
              .select('id')
              .maybeSingle()
            // 고객 알림
            await client.from('notifications').insert({
              user_id: intent.user_id,
              type: 'payment',
              title: '결제가 완료됐어요 💜',
              body: `${serviceName} ${totalSessions}회권 · ₩${paymentAmount.toLocaleString()} 결제 완료. 이제 날짜를 예약해보세요!`,
              link_url: `/salons/${salonId}?booking_paid=true&purchase_id=${newPurchase?.id || ''}`,
              is_read: false,
            } as any)
            // 원장님 알림
            if (salonRow?.owner_id) {
              await client.from('notifications').insert({
                user_id: salonRow.owner_id,
                type: 'payment',
                title: '새 시술권 결제 💜',
                body: `${serviceName} ${totalSessions}회권 · 정산 예정 ₩${ownerAmount.toLocaleString()}`,
                is_read: false,
              } as any)
            }
            // 파트너스 알림
            if (partnerId && partnerFee > 0) {
              await client.from('notifications').insert({
                user_id: partnerId,
                type: 'payment',
                title: '파트너스 수수료 발생 💜',
                body: `${serviceName} ${totalSessions}회권 · 회차 완료마다 ₩${partnerFeePerSession.toLocaleString()}씩 정산 예정`,
                is_read: false,
              } as any)
            }
          }
        } catch (e) {
          console.error('[booking purchase insert]', e)
        }
      }
      if (intent.kind === 'brand_product_order' && intent.target_id && intent.user_id) {
        const client = tryCreateServiceClient() || supabase
        await handleBrandProductOrderComplete(intent, client)
      }
      // 주문 결제 완료: 알림만 (주문 상태는 이미 주문확인)
      if (intent.kind === 'order' && intent.target_id && intent.user_id) {
        const client = tryCreateServiceClient() || supabase
        const { data: orderRow } = await client
          .from('orders')
          .select(
            'id,order_no,customer_id,share_journal_id,purchase_lead_rewarded,point_used,charge_used,toast_used,gift_receiver_id,gift_message,payment_applied,payment_status,gift_created,user_coupon_id,address,recipient_name,recipient_phone,subtotal,shipping_fee,grade_discount,coupon_discount,order_items(product_name,quantity,product_price),final_amount'
          )
          .eq('id', intent.target_id)
          .maybeSingle()
        const amount = Number(intent.amount || 0)
        const orderMsgs = [
          '오늘의 나를 위한 선택 💜 주문이 접수됐어요',
          '피부가 기대하고 있어요 ✨ 정성껏 준비할게요',
          '당신의 루틴이 시작됩니다 🌙',
          '소중한 주문, 설레는 마음으로 준비해요 💜',
          '나를 가장 잘 아는 케어, 출발 준비 완료 ✨',
        ]
        const orderMsg = orderMsgs[Math.floor(Math.random() * orderMsgs.length)]
        const itemList = ((orderRow?.order_items as any[]) || []).map((i: any) => `${i.product_name || '상품'} × ${i.quantity || 1}`).join('\n')
        const subtotalAmt = Number((orderRow as any)?.subtotal ?? 0)
        const shippingFeeAmt = Number((orderRow as any)?.shipping_fee ?? 0)
        const gradeDiscountAmt = Number((orderRow as any)?.grade_discount ?? 0)
        const couponDiscountAmt = Number((orderRow as any)?.coupon_discount ?? 0)
        const toastUsedAmt = Number((orderRow as any)?.toast_used ?? 0)
        const chargeUsedAmt = Number((orderRow as any)?.charge_used ?? 0)
        const payType = String(data.pay_type ?? data.paymethod ?? '')
        const payMethodLabel = payType === '1' ? '신용카드' : payType === 'vbank' ? '가상계좌' : payType ? payType : '카드'
        await client.from('notifications').insert({
          user_id: intent.user_id,
          type: 'payment',
          title: '💜 주문이 완료됐어요',
          body: `${orderMsg}\n${itemList} · ${Number(orderRow?.final_amount || 0).toLocaleString()}원`,
          is_read: false,
        })

        if (orderRow?.id && (!orderRow.payment_applied || orderRow.payment_status !== 'paid')) {
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
              source_type: 'order',
              source_id: orderRow.id,
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
              status: (() => {
                const pt = String(data.pay_type ?? data.paymethod ?? '')
                return pt === '3' ? '발송준비' : '주문확인'
              })(),
              payment_status: 'paid',
              payment_method: (() => {
                const pt = String(data.pay_type ?? data.paymethod ?? '')
                const cardName = String(data.card_name ?? '').trim()
                if (pt === '1') return cardName ? `${cardName}카드` : '신용카드'
                if (pt === '2') return '계좌이체'
                if (pt === '3') return '가상계좌'
                if (pt === '4') return '휴대폰'
                return pt || null
              })(),
            })
            .eq('id', orderRow.id)
          if (orderRow?.customer_id) {
            const { data: channelRow } = await supabase
              .from('chat_channels')
              .select('id')
              .eq('user_id', orderRow.customer_id)
              .eq('channel_type', 'owner')
              .maybeSingle()

            if (channelRow?.id) {
              const allProductNames = (orderRow.order_items ?? [])
                .map((item: any) => item.product_name)
                .filter(Boolean)
                .join(' · ')
              const finalAmount = (orderRow as any).final_amount
                ? `${Number((orderRow as any).final_amount).toLocaleString()}원`
                : ''
              await supabase.from('consultation_messages').insert({
                channel_id: channelRow.id,
                sender_id: orderRow.customer_id,
                message_kind: 'order_paid',
                body: `${allProductNames}${finalAmount ? ' · ' + finalAmount : ''}`,
                order_id: orderRow.id,
                is_from_customer: false,
              })
            }
          }
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

        // 일반 주문 결제 완료 후처리: 누적구매액 + 등급승급 + 토스트적립 + 알림톡
        if (intent.kind === 'order' && intent.user_id && intent.amount && (orderRow as any)?.payment_applied !== true) {
          try {
            const postClient = tryCreateServiceClient() || supabase
            // 1. 누적 구매액 + 등급 자동 승급
            await addToPurchaseAmount(intent.user_id, intent.amount, postClient)
            await autoUpgradeGrade(intent.user_id, postClient)
            // 2. 구매 토스트 적립
            const { data: rewardSetting } = await postClient
              .from('admin_settings')
              .select('value')
              .eq('category', 'points_payment')
              .eq('key', 'purchase_reward_rate')
              .maybeSingle()
            const rewardRate = Number(rewardSetting?.value ?? 3) / 100
            const toastEarn = Math.floor(intent.amount * rewardRate)
            if (toastEarn > 0) {
              await postClient.from('toast_transactions').insert({
                user_id: intent.user_id,
                amount: toastEarn,
                transaction_type: 'earn',
                source_type: 'order',
                source_id: (orderRow as any)?.id || null,
                reference_id: (orderRow as any)?.id || null,
              } as any)
              const { error: ptErr } = await postClient.rpc('increment_points', { user_id: intent.user_id, amount: toastEarn })
              if (ptErr) console.warn('[order purchase toast points]', ptErr)
              await postClient.from('notifications').insert({
                user_id: intent.user_id,
                type: 'toast',
                title: `${toastEarn.toLocaleString()}T 적립됐어요 🍞`,
                body: '구매 완료 적립 토스트예요. 다음 주문에 사용해보세요!',
                link_url: '/wallet',
                is_read: false,
              } as any)
            }
            // 3. 주문 완료 알림톡
            const { data: uRow } = await postClient.from('users').select('phone,name').eq('id', intent.user_id).maybeSingle()
            if ((uRow as any)?.phone) {
              const uName = (uRow as any)?.name || '고객'
              await sendPpurioAlimtalk({
                phone: (uRow as any).phone,
                message: `[AURAN] ${uName}님, 주문이 완료됐어요 💜\n\n결제금액: ₩${Number(intent.amount).toLocaleString()}\n토스트 ${toastEarn.toLocaleString()}T 적립!\n\n주문 확인: https://auran.kr/my`,
                title: 'AURAN 주문 완료',
              }).catch(() => {})
            }
          } catch (_) {}
        }
      }
    }

    if (intent.kind === 'order' && intent.target_id) {
      const orderClient = tryCreateServiceClient() || supabase
      const { data: orderRow } = await orderClient
        .from('orders')
        .select('id,payment_applied,payment_status,final_amount,address,address_detail,recipient_name,recipient_phone')
        .eq('id', intent.target_id)
        .maybeSingle()

      const shipAddr = String(orderRow?.address || '').trim()
      const shipName = String(orderRow?.recipient_name || '').trim()
      const shipPhone = String(orderRow?.recipient_phone || '').trim()
      if (shipAddr && intent.user_id) {
        const { data: dupShip } = await orderClient
          .from('shipping_addresses')
          .select('id')
          .eq('user_id', intent.user_id)
          .eq('address', shipAddr)
          .maybeSingle()
        if (!dupShip) {
          await orderClient.from('shipping_addresses').insert({
            user_id: intent.user_id,
            address: shipAddr,
            address_detail: (orderRow as any).address_detail || null,
            recipient_name: shipName || null,
            phone: shipPhone || null,
            is_default: true,
            label: '최근배송지',
          } as any)
        }
        await orderClient.from('users').update({ shipping_address: shipAddr } as any).eq('id', intent.user_id)
      }

      if (orderRow?.id && (!orderRow.payment_applied || orderRow.payment_status !== 'paid') && Math.abs(Number((orderRow as any).final_amount) - Number(intent.amount)) <= 10) {
        await orderClient
          .from('orders')
          .update({
            payment_status: 'paid',
            payment_applied: true,
            status: (() => {
              const pt = String(data.pay_type ?? data.paymethod ?? '')
              return pt === '3' ? '발송준비' : '주문확인'
            })(),
            payment_method: (() => {
              const pt = String(data.pay_type ?? data.paymethod ?? '')
              const cardName = String(data.card_name ?? '').trim()
              if (pt === '1') return cardName ? `${cardName}카드` : '신용카드'
              if (pt === '2') return '계좌이체'
              if (pt === '3') return '가상계좌'
              if (pt === '4') return '휴대폰'
              return pt || null
            })(),
          })
          .eq('id', orderRow.id)
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
      if (intent.kind === 'brand_product_order' && intent.target_id) {
        const client = tryCreateServiceClient() || supabase
        await handleBrandProductOrderCancel(intent, client)
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

