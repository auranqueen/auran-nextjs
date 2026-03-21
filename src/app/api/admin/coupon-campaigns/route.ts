import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

async function requireAdminApi() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, supabase: null as ReturnType<typeof tryCreateServiceClient> }

  const svc = tryCreateServiceClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
    if ((u as { role?: string } | null)?.role === 'admin') return { ok: true as const, supabase: svc }
    const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
    if ((p as { role?: string } | null)?.role === 'admin') return { ok: true as const, supabase: svc }
  }
  if (user.email === 'admin@auran.kr' && svc) return { ok: true as const, supabase: svc }
  return { ok: false as const, status: 403, supabase: svc }
}

/** GET /api/admin/coupon-campaigns?from=ISO&to=ISO */
export async function GET(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)
  if (!auth.supabase) return json({ ok: false, error: 'service_role_unconfigured' }, 503)

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  let q = auth.supabase
    .from('coupon_campaigns')
    .select('id,coupon_id,campaign_name,target_count,success_count,duplicate_count,failed_count,results,issued_by,issued_at,coupons(name)')
    .order('issued_at', { ascending: false })
    .limit(300)

  if (from) q = q.gte('issued_at', from)
  if (to) q = q.lte('issued_at', to)

  const { data: rows, error } = await q
  if (error) return json({ ok: false, error: error.message }, 500)

  const campaigns = (rows || []).map((r: any) => {
    const c = r.coupons
    const couponName =
      c && typeof c === 'object' && !Array.isArray(c)
        ? (c as { name?: string }).name
        : Array.isArray(c) && c[0]
          ? (c[0] as { name?: string }).name
          : null
    return {
      id: r.id,
      coupon_id: r.coupon_id,
      campaign_name: r.campaign_name,
      coupon_name: couponName || '—',
      target_count: r.target_count,
      success_count: r.success_count,
      duplicate_count: r.duplicate_count,
      failed_count: r.failed_count,
      results: r.results,
      issued_by: r.issued_by,
      issued_at: r.issued_at,
    }
  })

  return json({ ok: true, campaigns })
}
