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
        const pointsToAdd = Math.floor(amount * 0.05)
        const client = tryCreateServiceClient() || supabase
        const { data: u } = await client.from('users').select('charge_balance, points').eq('id', intent.user_id).single()
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

