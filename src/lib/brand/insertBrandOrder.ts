import type { SupabaseClient } from '@supabase/supabase-js'

export const BRAND_ORDER_UNPAID_MESSAGE = '미납 청구서가 있어 발주가 제한됩니다'

/** billing_month(YYYY-MM-01) → 그 달 30일(또는 말일 중 작은 값) 로컬 자정 */
export function unpaidDueDate(billingMonth: string): Date {
  const ym = String(billingMonth).slice(0, 7)
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return new Date(0)
  const lastDay = new Date(y, m, 0).getDate()
  const dueDay = Math.min(30, lastDay)
  return new Date(y, m - 1, dueDay)
}

export function startOfTodayLocal(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export type CreateBrandOrderInput = {
  brand_id: string
  profile_id: string
  owner_name?: string
  salon_name?: string
  grade?: string
  items: unknown[]
  total_qty?: number
  total_amount?: number
  promo_applied?: string | null
  points_earned?: number
  /** 멀티브랜드 배치 묶음 (선택) */
  batch_id?: string | null
  campaign_id?: string
  status?: string
}

export type CreateBrandOrderResult =
  | { ok: true; order_id: string }
  | { ok: false; error: 'unpaid_invoice' | 'insert_failed'; message: string }

/**
 * brand_orders 1행 insert + 브랜드 메시지.
 * /api/brand-orders/create 및 /api/brand-order-batches/create 공용.
 */
export async function insertBrandOrder(
  svc: SupabaseClient,
  input: CreateBrandOrderInput,
): Promise<CreateBrandOrderResult> {
  const brandId = input.brand_id
  const profileId = input.profile_id
  const ownerName = input.owner_name || ''
  const salonName = input.salon_name || ''
  const grade = input.grade || ''
  const items = input.items
  const totalQty = Math.trunc(Number(input.total_qty) || 0)
  const totalAmount = Math.trunc(Number(input.total_amount) || 0)
  const promoApplied = input.promo_applied == null ? null : String(input.promo_applied)
  const pointsEarned = Math.trunc(Number(input.points_earned) || 0)
  const status = input.status || 'pending'

  const { data: brandRow } = await svc
    .from('brands')
    .select('company_id')
    .eq('id', brandId)
    .maybeSingle()
  const companyId = (brandRow as { company_id?: string | null } | null)?.company_id
  let unpaidRows: { billing_month?: string }[] | null = null
  if (companyId) {
    const { data } = await svc
      .from('brand_billing_invoices')
      .select('id, billing_month, status')
      .eq('owner_id', profileId)
      .eq('company_id', companyId)
      .eq('status', 'unpaid')
      .gt('total_amount', 0)
    unpaidRows = data
  }

  const today = startOfTodayLocal()
  const overdue = (unpaidRows || []).some((inv: { billing_month?: string }) => {
    const due = unpaidDueDate(String(inv.billing_month || ''))
    return due.getTime() < today.getTime()
  })
  if (overdue) {
    return { ok: false, error: 'unpaid_invoice', message: BRAND_ORDER_UNPAID_MESSAGE }
  }

  const row: Record<string, unknown> = {
    brand_id: brandId,
    profile_id: profileId,
    owner_name: ownerName,
    salon_name: salonName,
    grade,
    status,
    items,
    total_qty: totalQty,
    total_amount: totalAmount,
    promo_applied: promoApplied,
    points_earned: pointsEarned,
  }
  if (input.batch_id) {
    row.batch_id = input.batch_id
  }
  if (input.campaign_id) {
    row.campaign_id = input.campaign_id
  }

  const { data: order, error: insertErr } = await svc
    .from('brand_orders')
    .insert(row)
    .select('id')
    .single()

  if (insertErr || !order?.id) {
    return {
      ok: false,
      error: 'insert_failed',
      message: insertErr?.message || '발주 실패',
    }
  }

  const itemSummary = (items as Array<{ name?: string; qty?: number; line_amount?: number }>)
    .map((i) => `${i.name || ''} ${i.qty || 0}ea · ₩${Number(i.line_amount || 0).toLocaleString()}`)
    .join(', ')

  await svc.from('brand_messages').insert({
    brand_id: brandId,
    message_type: 'auto_order',
    target_type: profileId ? 'selected' : 'all',
    target_owner_id: profileId || null,
    title: `발주가 접수됐어요`,
    body: `${salonName} 발주가 정상 접수됐습니다. ${itemSummary}`,
    send_count: 1,
  })

  return { ok: true, order_id: order.id }
}
