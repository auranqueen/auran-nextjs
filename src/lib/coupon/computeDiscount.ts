/** Mirrors server order logic for coupons (public.coupons schema). */

export type OrderLineForCoupon = {
  product_id: string
  brand_id: string | null
  subtotal: number
}

export function isCouponApplicableForOrder(
  coupon: any,
  lines: OrderLineForCoupon[],
  totalAmount: number,
  authUserId: string
): boolean {
  if (!coupon?.is_active) return false
  const now = Date.now()
  if (coupon.start_at && new Date(coupon.start_at).getTime() > now) return false
  if (coupon.end_at && new Date(coupon.end_at).getTime() < now) return false

  const scope = (coupon.scope || 'all').toLowerCase()
  if (scope === 'brand') {
    const ids = (coupon.scope_brand_ids || []) as string[]
    if (!ids.length) return false
    const ok = lines.some((l) => l.brand_id && ids.map(String).includes(String(l.brand_id)))
    if (!ok) return false
  }
  if (scope === 'product') {
    const ids = (coupon.scope_product_ids || []) as string[]
    if (!ids.length) return false
    const ok = lines.some((l) => ids.map(String).includes(String(l.product_id)))
    if (!ok) return false
  }

  const su = (coupon.scope_user_ids || []) as string[]
  if (su.length > 0) {
    if (!su.map(String).includes(String(authUserId))) return false
  }

  const minOrder = Math.max(0, Number(coupon.min_order ?? 0))
  if (totalAmount < minOrder) return false

  return true
}

function effectiveDiscountMeta(c: any): { kind: 'amount' | 'rate'; value: number } {
  const dt = (c.discount_type || (c.type === 'rate' ? 'rate' : 'amount')) as string
  if (dt === 'rate') {
    const v = Number(c.discount_value != null ? c.discount_value : c.discount_rate ?? 0)
    return { kind: 'rate', value: v }
  }
  const v = Number(c.discount_value != null ? c.discount_value : c.discount_amount ?? 0)
  return { kind: 'amount', value: v }
}

export function computeCouponDiscount(
  totalAmount: number,
  c: any,
  opts?: { maxPercent?: number }
): number {
  if (!c) return 0
  const minOrder = Math.max(0, Number(c.min_order ?? 0))
  if (totalAmount < minOrder) return 0
  const now = Date.now()
  if (c.start_at && new Date(c.start_at).getTime() > now) return 0
  if (c.end_at && new Date(c.end_at).getTime() < now) return 0

  const meta = effectiveDiscountMeta(c)
  const maxPct = Math.min(100, Math.max(0, opts?.maxPercent ?? 70))

  if (meta.kind === 'amount') {
    return Math.min(Math.max(0, Math.floor(meta.value)), totalAmount)
  }
  const rate = Math.min(maxPct, Math.max(0, meta.value))
  const raw = Math.floor((totalAmount * rate) / 100)
  const cap = c.max_discount != null ? Math.min(Number(c.max_discount), totalAmount) : totalAmount
  return Math.min(raw, cap)
}

export function isCouponExpiredForUser(uc: { status: string; expired_at?: string | null }, c: any): boolean {
  if (uc.status === 'expired') return true
  if (uc.expired_at && new Date(uc.expired_at).getTime() < Date.now()) return true
  if (!c?.end_at) return false
  return new Date(c.end_at).getTime() < Date.now()
}
