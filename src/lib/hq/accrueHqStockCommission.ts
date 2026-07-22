import type { SupabaseClient } from '@supabase/supabase-js'

/** brandTierPurchase.ts 와 동일 (해당 파일 미수정 · 공식만 재사용) */
const PLATFORM_FEE_RATE = 8.8

/**
 * HQ 재고발주 결제완료 후 스폰서 커미션 적립.
 * net/fee/commission 계산식은 brandTierPurchase.ts 원문과 동일.
 */
export async function accrueHqStockCommission(
  client: SupabaseClient,
  order: {
    id: string
    brand_id: string
    profile_id: string
    final_amount: number
  },
): Promise<void> {
  const { data: dup } = await client
    .from('hq_commission_ledger')
    .select('id')
    .eq('source_type', 'hq_stock_order')
    .eq('source_order_id', order.id)
    .maybeSingle()
  if (dup?.id) return

  const { data: buyerGrade } = await client
    .from('brand_owner_grades')
    .select('sponsor_owner_id')
    .eq('brand_id', order.brand_id)
    .eq('owner_id', order.profile_id)
    .maybeSingle()

  const sponsorOwnerId = buyerGrade?.sponsor_owner_id
    ? String(buyerGrade.sponsor_owner_id)
    : null
  if (!sponsorOwnerId || sponsorOwnerId === order.profile_id) return

  const { data: sponsorGradeRow } = await client
    .from('brand_owner_grades')
    .select('id, grade, payment_status')
    .eq('brand_id', order.brand_id)
    .eq('owner_id', sponsorOwnerId)
    .eq('payment_status', 'paid')
    .maybeSingle()

  if (!sponsorGradeRow?.id) return

  const sponsorGrade = String((sponsorGradeRow as { grade?: string }).grade || '').trim()
  if (!sponsorGrade) return

  // 요율은 오렌 자체 hq_commission_rates만 사용 (brand_tier_packages 미조회)
  const { data: rateRow } = await client
    .from('hq_commission_rates')
    .select('commission_rate')
    .eq('grade', sponsorGrade)
    .maybeSingle()
  const commissionRate = Number(rateRow?.commission_rate ?? 0)
  if (!(commissionRate > 0)) return

  // brandTierPurchase.ts 동일:
  // feeAmount = Math.floor(paidAmount * PLATFORM_FEE_RATE / 100)
  // netAmount = paidAmount - feeAmount
  // commissionAmount = Math.floor(netAmount * commissionRate / 100)
  const paidAmount = Math.trunc(Number(order.final_amount) || 0)
  const feeAmount = Math.floor((paidAmount * PLATFORM_FEE_RATE) / 100)
  const netAmount = paidAmount - feeAmount
  const commissionAmount = Math.floor((netAmount * commissionRate) / 100)
  if (!(commissionAmount > 0)) return

  const nowIso = new Date().toISOString()
  const { error } = await client.from('hq_commission_ledger').insert({
    source_type: 'hq_stock_order',
    source_order_id: order.id,
    brand_id: order.brand_id,
    buyer_owner_id: order.profile_id,
    sponsor_owner_id: sponsorOwnerId,
    commission_rate: commissionRate,
    commission_amount: commissionAmount,
    status: 'pending',
    created_at: nowIso,
  } as any)

  if (error) {
    console.error('[hq_stock_order commission insert]', error)
  }
}
