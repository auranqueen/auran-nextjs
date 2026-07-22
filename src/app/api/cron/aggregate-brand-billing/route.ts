import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { aggregateBrandBilling, billingCycleRange } from '@/lib/billing/aggregateBrandBilling'

const CIVASAN_BRAND_ID = '60413ded-91f4-4004-b677-ae684cb0677e'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export const dynamic = 'force-dynamic'

/** invoice/page.tsx currentYm()와 동일한 라벨용 YYYY-MM */
function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 매월 25일: 시바산 brand_orders 월합 → brand_billing_invoices 취합
 * 조회 구간 = 전월26일~당월26일 / billing_month 라벨 = 이번달 1일
 * Vercel Cron: Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  const qSecret = req.nextUrl.searchParams.get('secret') || ''
  const secret = bearer || qSecret

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CRON_SECRET) return json({ ok: false, error: 'CRON_SECRET not configured' }, 503)
    if (secret !== process.env.CRON_SECRET) return json({ ok: false, error: 'unauthorized' }, 401)
  } else if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const svc = tryCreateServiceClient()
  if (!svc) return json({ ok: false, error: 'service_unavailable' }, 500)

  const ym = currentYm()
  const billingMonth = `${ym}-01`
  const { startIso, endIso } = billingCycleRange(new Date())

  const { data: orderRows, error: listErr } = await svc
    .from('brand_orders')
    .select('profile_id')
    .eq('brand_id', CIVASAN_BRAND_ID)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .not('profile_id', 'is', null)

  if (listErr) {
    console.error('[aggregate-brand-billing] list error', listErr.message)
    return json({ ok: false, error: listErr.message }, 500)
  }

  const profileIds = Array.from(
    new Set((orderRows || []).map((r: { profile_id?: string | null }) => String(r.profile_id || '')).filter(Boolean)),
  )

  let okCount = 0
  let failCount = 0
  const errors: Array<{ profile_id: string; error: string }> = []

  for (const profileId of profileIds) {
    const result = await aggregateBrandBilling(svc, {
      brandId: CIVASAN_BRAND_ID,
      profileId,
      billingMonth,
    })
    if (result.ok) {
      okCount += 1
    } else {
      failCount += 1
      errors.push({ profile_id: profileId, error: result.error || 'failed' })
    }
  }

  console.log(
    `[aggregate-brand-billing] month=${billingMonth} cycle=${startIso}..${endIso} profiles=${profileIds.length} ok=${okCount} fail=${failCount}`,
  )

  return json({
    ok: true,
    billing_month: billingMonth,
    cycle_start: startIso,
    cycle_end: endIso,
    profile_count: profileIds.length,
    aggregated: okCount,
    failed: failCount,
    errors: errors.slice(0, 20),
  })
}
