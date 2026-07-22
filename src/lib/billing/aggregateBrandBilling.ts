import type { SupabaseClient } from '@supabase/supabase-js'
import { calcPouchTier } from '@/lib/brand/brandBilling'

export type AggregateBrandBillingParams = {
  brandId: string
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
 * 특정 원장·브랜드·청구월 brand_orders 합산 → brand_billing_invoices upsert
 * (cancelled 제외, 조회는 26일 사이클 / billing_month 라벨은 YYYY-MM-01)
 */
export async function aggregateBrandBilling(
  supabase: SupabaseClient,
  { brandId, profileId, billingMonth }: AggregateBrandBillingParams,
): Promise<AggregateBrandBillingResult> {
  const ym = String(billingMonth).slice(0, 7)
  const [y, m] = ym.split('-').map(Number)
  const monthDate =
    y && m
      ? `${y}-${String(m).padStart(2, '0')}-01`
      : String(billingMonth).slice(0, 10)

  // 라벨 월(예: 7월) 기준으로 사이클 = 전월26일 ~ 당월26일
  const cycleRef = y && m ? new Date(y, m - 1, 1) : new Date()
  const { startIso, endIso } = billingCycleRange(cycleRef)

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
