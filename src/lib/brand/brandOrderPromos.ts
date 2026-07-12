/** 등급별 적립율(%) — 프로모는 supply_promos, 적립은 기존 값 유지 */
export const GRADE_POINT_RATES: Record<string, number> = {
  '메디슈티컬': 3,
  '프리미엄전문점': 2,
  '전문점': 1.5,
  '취급점': 1,
}

export type SupplyPromoRow = {
  id: string
  brand_id: string
  qty: number | null
  bonus_qty: number | null
  bonus: string | null
  condition: string | null
  title: string | null
}

export type BrandOrderLineItem = {
  product_id: string
  name: string
  qty: number
  unit_price: number
  line_amount: number
  bonus: number
  promo: string
}

export function hasValidSupplyPrice(supplyPrice: number | null | undefined): boolean {
  return Number.isFinite(Number(supplyPrice)) && Number(supplyPrice) > 0
}

export function calcLineAmount(qty: number, unitPrice: number): number {
  return Math.trunc(qty) * Math.trunc(unitPrice)
}

/** cartQty 이상 threshold 중 qty 최대(동률이면 bonus_qty 큰 것) */
export function pickSupplyPromo(
  promos: SupplyPromoRow[],
  brandId: string,
  cartQty: number,
): SupplyPromoRow | null {
  const eligible = promos
    .filter((p) => p.brand_id === brandId && cartQty >= (p.qty ?? 0))
    .sort((a, b) => (b.qty ?? 0) - (a.qty ?? 0) || (b.bonus_qty ?? 0) - (a.bonus_qty ?? 0))
  return eligible[0] ?? null
}

export function promoLabel(row: SupplyPromoRow | null): string {
  if (!row) return ''
  if (row.bonus?.trim()) return row.bonus.trim()
  if (row.qty != null && row.bonus_qty != null) return `${row.qty}+${row.bonus_qty}`
  return ''
}

export function promoBonus(row: SupplyPromoRow | null): number {
  if (!row) return 0
  if (row.bonus_qty != null && Number.isFinite(row.bonus_qty)) return row.bonus_qty
  const label = promoLabel(row)
  const parts = label.split('+')
  return parseInt(parts[1] || '0', 10) || 0
}

export function gradePointRate(grade: string): number {
  return GRADE_POINT_RATES[grade] ?? 1
}

export function buildOrderLineItem(
  product: { id: string; name: string; brand_id: string; supply_price: number },
  qty: number,
  promos: SupplyPromoRow[],
): BrandOrderLineItem {
  const unitPrice = Math.trunc(product.supply_price)
  const picked = pickSupplyPromo(promos, product.brand_id, qty)
  const promo = promoLabel(picked)
  const bonus = promoBonus(picked)
  return {
    product_id: product.id,
    name: product.name,
    qty,
    unit_price: unitPrice,
    line_amount: calcLineAmount(qty, unitPrice),
    bonus,
    promo,
  }
}
