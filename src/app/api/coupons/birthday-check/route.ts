import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/createNotification'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { daysUntilNextBirthday } from '@/lib/coupon/daysUntilBirthday'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export const dynamic = 'force-dynamic'

/** 로그인 고객 홈 접속 시 생일 쿠폰 자동 발급 */
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, reason: 'not_logged_in' }, 401)

  const client = tryCreateServiceClient() || supabase

  const { data: profile } = await client.from('users').select('id,birthday').eq('auth_id', user.id).maybeSingle()
  if (!profile?.birthday) return json({ ok: true, issued: 0 })

  const { data: enabled } = await client
    .from('admin_settings')
    .select('value')
    .eq('category', 'coupon')
    .eq('key', 'scope_enabled')
    .maybeSingle()
  if (Number(enabled?.value ?? 1) !== 1) return json({ ok: true, issued: 0 })

  const daysUntil = daysUntilNextBirthday(profile.birthday)

  const { data: coupons } = await client
    .from('coupons')
    .select('id,birthday_days_before,max_issue_count,issued_count')
    .eq('issue_trigger', 'birthday')
    .eq('is_active', true)

  let issued = 0
  for (const c of coupons || []) {
    const before = Math.max(0, Number((c as any).birthday_days_before ?? 7))
    if (daysUntil > before || daysUntil < 0) continue

    if ((c as any).max_issue_count != null && ((c as any).issued_count || 0) >= (c as any).max_issue_count) continue

    const { data: ex } = await client
      .from('user_coupons')
      .select('id')
      .eq('user_id', user.id)
      .eq('coupon_id', (c as any).id)
      .maybeSingle()
    if (ex) continue

    const { error: insErr } = await client.from('user_coupons').insert({
      user_id: user.id,
      coupon_id: (c as any).id,
      status: 'unused',
    })
    if (insErr) continue

    issued += 1
    await client
      .from('coupons')
      .update({ issued_count: ((c as any).issued_count || 0) + 1 })
      .eq('id', (c as any).id)
  }

  if (issued > 0 && profile.id) {
    await createNotification(client, profile.id, 'birthday', '생일 쿠폰이 발급됐어요', '쿠폰함에서 확인해 보세요.', '/my/coupons')
  }

  return json({ ok: true, issued })
}
