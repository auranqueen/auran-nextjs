import type { SupabaseClient } from '@supabase/supabase-js'
import { calcPouchTier } from '@/lib/brand/brandBilling'

export type AggregateBrandBillingParams = {
  companyId: string
  profileId: string
  /** DATE 형태 YYYY-MM-01 (청구서 라벨용, 조회 구간과 별개) */
  billingMonth: string
}

export type AggregateBrandBillingResult = {
  ok: boolean
  total_amount: number
  points_total: number
  pouch_tier: number | null
  invoice?: Record<string, unknown> | null
  error?: string
}

/**
 * 청구 사이클: 전월 26일 00:00(로컬) ~ 당월 26일 00:00(로컬) 반개구간
 * (크론이 매월 25일 실행 → referenceDate가 속한 달의 26일이 end)
 */
export function billingCycleRange(referenceDate: Date): { startIso: string; endIso: string } {
  const ref = referenceDate
  const end = new Date(ref.getFullYear(), ref.getMonth(), 26)
  const start = new Date(end.getFullYear(), end.getMonth() - 1, 26)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

/**
 * 특정 원장·컴퍼니·청구월 brand_orders(그 컴퍼니 소속 전체 브랜드) 합산 → brand_billing_invoices upsert
 * (cancelled 제외, 조회는 26일 사이클 / billing_month 라벨은 YYYY-MM-01)
 */
export async function aggregateBrandBilling(
  supabase: SupabaseClient,
  { companyId, profileId, billingMonth }: AggregateBrandBillingParams,
): Promise<AggregateBrandBillingResult> {
  const ym = String(billingMonth).slice(0, 7)
  const [y, m] = ym.split('-').map(Number)
  const monthDate =
    y && m
      ? `${y}-${String(m).padStart(2, '0')}-01`
      : String(billingMonth).slice(0, 10)

  const cycleRef = y && m ? new Date(y, m - 1, 1) : new Date()
  const { startIso, endIso } = billingCycleRange(cycleRef)

  const { data: brandRows, error: brandErr } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)

  if (brandErr) {
    return { ok: false, total_amount: 0, points_total: 0, pouch_tier: null, error: brandErr.message }
  }

  const brandIds = (brandRows || []).map((b: { id: string }) => b.id)
  if (brandIds.length === 0) {
    return { ok: false, total_amount: 0, points_total: 0, pouch_tier: null, error: 'no_brands_for_company' }
  }

  const { data: orderRows, error: orderErr } = await supabase
    .from('brand_orders')
    .select('id, total_amount, points_earned, points_used, status')
    .eq('profile_id', profileId)
    .in('brand_id', brandIds)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .neq('status', 'cancelled')

  if (orderErr) {
    return { ok: false, total_amount: 0, points_total: 0, pouch_tier: null, error: orderErr.message }
  }

  const orders = orderRows || []
  const rawTotalAmount = orders.reduce((s, o) => s + Math.trunc(Number(o.total_amount) || 0), 0)
  const pointsUsedThisCycle = orders.reduce((s, o) => s + Math.trunc(Number((o as { points_used?: number }).points_used) || 0), 0)
  const pointsTotal = orders.reduce((s, o) => s + Math.trunc(Number(o.points_earned) || 0), 0)
  const totalAmount = Math.max(0, rawTotalAmount - pointsUsedThisCycle)
  const pouchTier = calcPouchTier(totalAmount)

  const { data: existingInvoice } = await supabase
    .from('brand_billing_invoices')
    .select('id, points_used')
    .eq('company_id', companyId)
    .eq('owner_id', profileId)
    .eq('billing_month', monthDate)
    .maybeSingle()
  const previousPointsUsed = Math.trunc(Number((existingInvoice as { points_used?: number } | null)?.points_used) || 0)
  const pointsDelta = pointsUsedThisCycle - previousPointsUsed

  const { data: row, error: upsertErr } = await supabase
    .from('brand_billing_invoices')
    .upsert(
      {
        company_id: companyId,
        owner_id: profileId,
        billing_month: monthDate,
        total_amount: totalAmount,
        points_total: pointsTotal,
        points_used: pointsUsedThisCycle,
        pouch_tier: pouchTier,
      },
      { onConflict: 'company_id,owner_id,billing_month' },
    )
    .select(
      'id, company_id, owner_id, billing_month, total_amount, points_total, points_used, pouch_tier, pouch_sent_qty, pouch_sent_note, status, paid_at',
    )
    .single()

  if (upsertErr || !row) {
    return {
      ok: false,
      total_amount: totalAmount,
      points_total: pointsTotal,
      pouch_tier: pouchTier,
      error: upsertErr?.message || 'upsert_failed',
    }
  }

  if (pointsDelta > 0) {
    const { data: pointRow } = await supabase
      .from('brand_points')
      .select('balance')
      .eq('company_id', companyId)
      .eq('owner_id', profileId)
      .eq('track', 'ARETE')
      .maybeSingle()
    const currentBalance = Math.trunc(Number((pointRow as { balance?: number } | null)?.balance) || 0)
    const nextBalance = Math.max(0, currentBalance - pointsDelta)
    await supabase
      .from('brand_points')
      .update({ balance: nextBalance })
      .eq('company_id', companyId)
      .eq('owner_id', profileId)
      .eq('track', 'ARETE')
  }

  return {
    ok: true,
    total_amount: totalAmount,
    points_total: pointsTotal,
    pouch_tier: pouchTier,
    invoice: row as Record<string, unknown>,
  }
}
