import type { SupabaseClient } from '@supabase/supabase-js'
import { calcPouchTier, monthBillingRange } from '@/lib/brand/brandBilling'

export type AggregateBrandBillingParams = {
  brandId: string
  profileId: string
  /** DATE 형태 YYYY-MM-01 */
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
 * 특정 원장·브랜드·청구월 brand_orders 합산 → brand_billing_invoices upsert
 * (cancelled 제외, created_at 월 구간)
 */
export async function aggregateBrandBilling(
  supabase: SupabaseClient,
  { brandId, profileId, billingMonth }: AggregateBrandBillingParams,
): Promise<AggregateBrandBillingResult> {
  const ym = String(billingMonth).slice(0, 7)
  const { billingMonth: monthDate, startIso, endIso } = monthBillingRange(ym)

  const { data: orderRows, error: orderErr } = await supabase
    .from('brand_orders')
    .select('id, total_amount, points_earned, status')
    .eq('profile_id', profileId)
    .eq('brand_id', brandId)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .neq('status', 'cancelled')

  if (orderErr) {
    return { ok: false, total_amount: 0, points_total: 0, pouch_tier: null, error: orderErr.message }
  }

  const orders = orderRows || []
  const totalAmount = orders.reduce((s, o) => s + Math.trunc(Number(o.total_amount) || 0), 0)
  const pointsTotal = orders.reduce((s, o) => s + Math.trunc(Number(o.points_earned) || 0), 0)
  const pouchTier = calcPouchTier(totalAmount)

  const { data: row, error: upsertErr } = await supabase
    .from('brand_billing_invoices')
    .upsert(
      {
        brand_id: brandId,
        owner_id: profileId,
        billing_month: monthDate,
        total_amount: totalAmount,
        points_total: pointsTotal,
        pouch_tier: pouchTier,
      },
      { onConflict: 'brand_id,owner_id,billing_month' },
    )
    .select(
      'id, brand_id, owner_id, billing_month, total_amount, points_total, pouch_tier, pouch_sent_qty, pouch_sent_note, status, paid_at',
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

  return {
    ok: true,
    total_amount: totalAmount,
    points_total: pointsTotal,
    pouch_tier: pouchTier,
    invoice: row as Record<string, unknown>,
  }
}
