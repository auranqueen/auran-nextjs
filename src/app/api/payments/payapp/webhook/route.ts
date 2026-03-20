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
          .eq('category', 'star_system')
          .eq('key', 'charge_base_points_pct')
          .maybeSingle()

        const { data: bonusRateRow } = await client
          .from('admin_settings')
          .select('value')
          .eq('category', 'star_system')
          .eq('key', 'lv2_charge_bonus_pct')
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
          .select('id,order_no,customer_id,share_journal_id,purchase_lead_rewarded')
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
              .eq('category', 'star_system')
              .eq('key', 'purchase_lead_points')
              .maybeSingle()

            const purchaseLeadPoints = Number(leadPointRow?.value ?? 8888)

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
        const pointsReclaim = Math.floor(amount * 0.05)
        const { data: u } = await client.from('users').select('charge_balance, points').eq('id', intent.user_id).single()
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

