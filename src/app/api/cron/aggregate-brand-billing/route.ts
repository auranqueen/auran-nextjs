import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { aggregateBrandBilling, billingCycleRange } from '@/lib/billing/aggregateBrandBilling'

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
 * 매월 25일: 컴퍼니 전체 순회 → 소속 브랜드 brand_orders 월합 → brand_billing_invoices 취합
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

  const { data: companyRows, error: companyErr } = await svc.from('brand_companies').select('id')
  if (companyErr) {
    console.error('[aggregate-brand-billing] company list error', companyErr.message)
    return json({ ok: false, error: companyErr.message }, 500)
  }

  const companyIds = (companyRows || []).map((c: { id: string }) => c.id)

  let okCount = 0
  let failCount = 0
  let totalProfiles = 0
  const errors: Array<{ company_id: string; profile_id: string; error: string }> = []

  for (const companyId of companyIds) {
    const { data: brandRows } = await svc.from('brands').select('id').eq('company_id', companyId)
    const brandIds = (brandRows || []).map((b: { id: string }) => b.id)
    if (brandIds.length === 0) continue

    const { data: orderRows, error: listErr } = await svc
      .from('brand_orders')
      .select('profile_id')
      .in('brand_id', brandIds)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .not('profile_id', 'is', null)

    if (listErr) {
      console.error('[aggregate-brand-billing] list error', companyId, listErr.message)
      continue
    }

    const profileIds = Array.from(
      new Set(
        (orderRows || []).map((r: { profile_id?: string | null }) => String(r.profile_id || '')).filter(Boolean),
      ),
    )
    totalProfiles += profileIds.length

    for (const profileId of profileIds) {
      const result = await aggregateBrandBilling(svc, { companyId, profileId, billingMonth })
      if (result.ok) {
        okCount += 1
      } else {
        failCount += 1
        errors.push({ company_id: companyId, profile_id: profileId, error: result.error || 'failed' })
      }
    }
  }

  console.log(
    `[aggregate-brand-billing] month=${billingMonth} cycle=${startIso}..${endIso} companies=${companyIds.length} profiles=${totalProfiles} ok=${okCount} fail=${failCount}`,
  )

  return json({
    ok: true,
    billing_month: billingMonth,
    cycle_start: startIso,
    cycle_end: endIso,
    company_count: companyIds.length,
    profile_count: totalProfiles,
    aggregated: okCount,
    failed: failCount,
    errors: errors.slice(0, 20),
  })
}
