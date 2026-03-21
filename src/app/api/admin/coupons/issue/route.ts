import { NextRequest, NextResponse } from 'next/server'
import { insertCouponCampaignRecord } from '@/lib/admin/couponCampaign'
import { issueCouponsToAuthUsers } from '@/lib/admin/issueCouponsBulk'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

async function requireAdminUser() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401 as const, user: null, label: '' }

  const svc = tryCreateServiceClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
    if ((u as { role?: string } | null)?.role === 'admin')
      return { ok: true as const, user, label: user.email || user.id }
    const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
    if ((p as { role?: string } | null)?.role === 'admin')
      return { ok: true as const, user, label: user.email || user.id }
  }
  if (user.email === 'admin@auran.kr') return { ok: true as const, user, label: user.email }
  return { ok: false as const, status: 403 as const, user, label: '' }
}

/**
 * POST /api/admin/coupons/issue
 * body:
 *  - { coupon_id, user_ids: string[], campaign_name?: string }
 *  - { coupon_id, campaign_name?, mode: 'all_customers' } → role=customer & auth_id 있는 전원
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminUser()
  if (!auth.ok) {
    return json(
      { success: false, error: auth.status === 401 ? 'not_logged_in' : 'forbidden' },
      auth.status
    )
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    return json({ success: false, error: 'service_role_unconfigured' }, 500)
  }

  const body = await req.json().catch(() => ({}))
  const coupon_id = typeof body?.coupon_id === 'string' ? body.coupon_id.trim() : ''
  const campaign_name =
    typeof body?.campaign_name === 'string' && body.campaign_name.trim()
      ? body.campaign_name.trim().slice(0, 200)
      : '수동발급'

  let user_ids: string[] = []
  if (body?.mode === 'all_customers') {
    const { data: rows, error } = await svc
      .from('users')
      .select('auth_id')
      .eq('role', 'customer')
      .not('auth_id', 'is', null)
    if (error) return json({ success: false, error: error.message }, 500)
    user_ids = (rows || []).map((r: { auth_id: string }) => r.auth_id).filter(Boolean)
  } else {
    const raw = body?.user_ids
    if (Array.isArray(raw)) {
      user_ids = raw.filter((x: unknown) => typeof x === 'string' && x.length > 10) as string[]
    } else if (typeof body?.user_auth_id === 'string' && body.user_auth_id) {
      user_ids = [body.user_auth_id]
    }
  }

  if (!coupon_id) return json({ success: false, error: 'missing_coupon_id' }, 400)
  if (!user_ids.length) return json({ success: false, error: 'no_target_users' }, 400)
  if (user_ids.length > 8000) return json({ success: false, error: 'too_many_users' }, 400)

  const { results, summary } = await issueCouponsToAuthUsers(svc, coupon_id, user_ids)

  await insertCouponCampaignRecord(svc, {
    coupon_id,
    campaign_name,
    issued_by: auth.label || 'admin',
    results,
    target_count: user_ids.length,
  })

  return json({
    success: true,
    results,
    summary: {
      success: summary.success,
      duplicate: summary.duplicate,
      failed: summary.failed,
      total: user_ids.length,
    },
  })
}
