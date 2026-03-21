import { NextRequest, NextResponse } from 'next/server'
import { issueCouponManualToUser } from '@/lib/admin/issueCouponManual'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

/** POST /api/admin/coupons/issue — 본문: { coupon_id, user_auth_id } (기존 action:issue 와 동일) */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, error: 'not_logged_in' }, 401)

  const svc = tryCreateServiceClient()
  if (!svc) {
    return json(
      {
        ok: false,
        error: 'service_role_unconfigured',
        message: 'SUPABASE_SERVICE_ROLE_KEY가 설정되어야 수동 발급이 가능합니다.',
      },
      503
    )
  }

  const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  const isAdmin =
    (u as { role?: string } | null)?.role === 'admin' ||
    (p as { role?: string } | null)?.role === 'admin' ||
    user.email === 'admin@auran.kr'
  if (!isAdmin) return json({ ok: false, error: 'forbidden' }, 403)

  const body = await req.json().catch(() => ({}))
  const coupon_id = typeof body?.coupon_id === 'string' ? body.coupon_id : ''
  const user_auth_id = typeof body?.user_auth_id === 'string' ? body.user_auth_id : ''

  const result = await issueCouponManualToUser(svc, coupon_id, user_auth_id)
  if (!result.ok) {
    return json({ ok: false, error: result.error }, result.status)
  }
  return json({ ok: true })
}
