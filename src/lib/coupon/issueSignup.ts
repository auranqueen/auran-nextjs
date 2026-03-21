import { insertNotificationForAuthUser } from '@/lib/notifications/notifyProfile'
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
    .select('id,name,issued_count,max_issue_count')
    .eq('issue_trigger', 'signup')
    .eq('is_active', true)

  const issuedNames: string[] = []

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

    issuedNames.push((c as { name?: string }).name || '쿠폰')

    await client
      .from('coupons')
      .update({ issued_count: (c.issued_count || 0) + 1 })
      .eq('id', c.id)
  }

  if (issuedNames.length > 0) {
    const body =
      issuedNames.length === 1
        ? `${issuedNames[0]}이 발급됐어요. 쿠폰함을 확인하세요!`
        : `${issuedNames.length}개의 쿠폰이 발급됐어요. 쿠폰함을 확인하세요!`
    await insertNotificationForAuthUser(client, authUserId, {
      type: 'coupon',
      title: '쿠폰 발급',
      body,
      icon: '🎫',
      link: '/my/coupons',
    })
  }
}
