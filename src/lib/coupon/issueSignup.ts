import { tryCreateServiceClient } from '@/lib/supabase/service'

/** 신규 가입 시 issue_trigger = signup 인 쿠폰을 user_coupons 에 발급 (service role) */
export async function issueSignupCouponsForAuthUser(authUserId: string): Promise<void> {
  const client = tryCreateServiceClient()
  if (!client) return

  const { data: onRow } = await client
    .from('admin_settings')
    .select('value')
    .eq('category', 'coupon')
    .eq('key', 'signup_coupon_enabled')
    .maybeSingle()
  if (Number(onRow?.value ?? 1) !== 1) return

  const { data: coupons } = await client
    .from('coupons')
    .select('id,issued_count,max_issue_count')
    .eq('issue_trigger', 'signup')
    .eq('is_active', true)

  for (const c of coupons || []) {
    if (c.max_issue_count != null && (c.issued_count || 0) >= c.max_issue_count) continue
    const { data: exists } = await client
      .from('user_coupons')
      .select('id')
      .eq('user_id', authUserId)
      .eq('coupon_id', c.id)
      .maybeSingle()
    if (exists) continue

    const { error: insErr } = await client.from('user_coupons').insert({
      user_id: authUserId,
      coupon_id: c.id,
      status: 'unused',
    })
    if (insErr) continue

    await client
      .from('coupons')
      .update({ issued_count: (c.issued_count || 0) + 1 })
      .eq('id', c.id)
  }
}
