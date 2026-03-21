/** Mirrors server order logic for coupons (public.coupons schema). */
export function computeCouponDiscount(totalAmount: number, c: any): number {
  if (!c) return 0
  const minOrder = Math.max(0, Number(c.min_order ?? 0))
  if (totalAmount < minOrder) return 0
  const now = Date.now()
  if (c.start_at && new Date(c.start_at).getTime() > now) return 0
  if (c.end_at && new Date(c.end_at).getTime() < now) return 0
  if (c.type === 'amount') {
    return Math.min(Math.max(0, Number(c.discount_amount || 0)), totalAmount)
  }
  const rate = Number(c.discount_rate ?? 0)
  const raw = Math.floor((totalAmount * rate) / 100)
  const cap = c.max_discount != null ? Math.min(Number(c.max_discount), totalAmount) : totalAmount
  return Math.min(raw, cap)
}

export function isCouponExpiredForUser(uc: { status: string }, c: any): boolean {
  if (uc.status === 'expired') return true
  if (!c?.end_at) return false
  return new Date(c.end_at).getTime() < Date.now()
}
