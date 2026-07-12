/** 월 합계(원) → 파우치 tier (200/300/500) 또는 null */
export function calcPouchTier(totalAmount: number): number | null {
  const t = Math.trunc(totalAmount)
  if (t >= 5_000_000) return 500
  if (t >= 3_000_000) return 300
  if (t >= 2_000_000) return 200
  return null
}

export function pouchTierLabel(tier: number | null): string | null {
  if (tier === 500) return '500만원 이상 → 파우치 500장 증정'
  if (tier === 300) return '300만원 이상 → 파우치 300장 증정'
  if (tier === 200) return '200만원 이상 → 파우치 200장 증정'
  return null
}

/** YYYY-MM → billing_month DATE(월 1일) + 조회용 ISO 범위 */
export function monthBillingRange(ym: string): {
  billingMonth: string
  startIso: string
  endIso: string
} {
  const [y, m] = ym.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  const billingMonth = `${y}-${String(m).padStart(2, '0')}-01`
  return { billingMonth, startIso: start.toISOString(), endIso: end.toISOString() }
}

export type InvoiceLineRow = {
  order_id: string
  date: string
  name: string
  qty: number
  unit_price: number
  line_amount: number
}

export function expandOrderItemsToLines(orders: Array<{
  id: string
  created_at: string
  items: Array<{
    name?: string
    qty?: number
    unit_price?: number
    line_amount?: number
  }> | null
}>): InvoiceLineRow[] {
  const rows: InvoiceLineRow[] = []
  for (const o of orders) {
    const date = new Date(o.created_at).toLocaleDateString('ko-KR')
    const items = Array.isArray(o.items) ? o.items : []
    for (const it of items) {
      const qty = Math.trunc(Number(it.qty) || 0)
      const unitPrice = Math.trunc(Number(it.unit_price) || 0)
      const lineAmount = Math.trunc(Number(it.line_amount) || qty * unitPrice)
      rows.push({
        order_id: o.id,
        date,
        name: String(it.name || ''),
        qty,
        unit_price: unitPrice,
        line_amount: lineAmount,
      })
    }
  }
  return rows
}
