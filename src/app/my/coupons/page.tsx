import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MyCouponsClient, type CouponBoxRow } from './MyCouponsClient'

function normalizeRows(data: unknown): CouponBoxRow[] {
  if (!Array.isArray(data)) return []
  return data.map((uc: any) => {
    const emb = uc.coupons
    const couponRow =
      emb && typeof emb === 'object' && !Array.isArray(emb)
        ? emb
        : Array.isArray(emb) && emb[0]
          ? emb[0]
          : null
    return {
      id: String(uc.id),
      status: String(uc.status ?? ''),
      issued_at: uc.issued_at ?? null,
      used_at: uc.used_at ?? null,
      expired_at: uc.expired_at ?? null,
      coupon_id: String(uc.coupon_id ?? ''),
      coupons: couponRow,
    }
  })
}

export default async function MyCouponsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/my/coupons')

  const selWithExp = `
      id,
      status,
      issued_at,
      used_at,
      expired_at,
      coupon_id,
      coupons (
        id,
        name,
        code,
        type,
        discount_rate,
        discount_amount,
        min_order,
        max_discount,
        start_at,
        end_at,
        is_active,
        description,
        scope,
        scope_brand_ids,
        scope_product_ids,
        scope_user_ids,
        discount_type,
        discount_value,
        coupon_type
      )
    `
  const selNoExp = `
      id,
      status,
      issued_at,
      used_at,
      coupon_id,
      coupons (
        id,
        name,
        code,
        type,
        discount_rate,
        discount_amount,
        min_order,
        max_discount,
        start_at,
        end_at,
        is_active,
        description,
        scope,
        scope_brand_ids,
        scope_product_ids,
        scope_user_ids,
        discount_type,
        discount_value,
        coupon_type
      )
    `

  let data: unknown = null
  let errMsg: string | null = null

  const first = await supabase.from('user_coupons').select(selWithExp).eq('user_id', user.id).order('issued_at', { ascending: false })
  if (first.error && /expired_at|column .* does not exist|Could not find/i.test(first.error.message)) {
    const second = await supabase.from('user_coupons').select(selNoExp).eq('user_id', user.id).order('issued_at', { ascending: false })
    data = second.data
    errMsg = second.error?.message ?? null
  } else {
    data = first.data
    errMsg = first.error?.message ?? null
  }

  const rows = normalizeRows(data)
  return <MyCouponsClient initialRows={rows} initialError={errMsg} />
}
