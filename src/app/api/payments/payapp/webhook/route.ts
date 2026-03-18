import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

      // domain apply: charge => increase charge_balance
      if (intent.kind === 'charge' && intent.user_id) {
        // fetch current balance and update (no RPC in this codebase)
        const { data: u } = await supabase.from('users').select('charge_balance').eq('id', intent.user_id).single()
        const next = Number(u?.charge_balance || 0) + Number(intent.amount || 0)
        await supabase.from('users').update({ charge_balance: next }).eq('id', intent.user_id)
      }
    }
  } else if (payState === '9' || payState === '64' || payState === '70' || payState === '71') {
    if (intent.status !== 'cancelled') {
      await supabase
        .from('payment_intents')
        .update({ status: 'cancelled', cancelled_at: data.canceldate || new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', intent.id)
    }
  } else if (payState === '8' || payState === '16' || payState === '31') {
    if (intent.status !== 'cancelled') {
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

