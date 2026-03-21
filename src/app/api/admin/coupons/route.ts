/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

async function requireAdminApi() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, supabase, user: null as any }

  const svc = tryCreateServiceClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
    if ((u as any)?.role === 'admin') return { ok: true as const, status: 200, supabase: svc, user }
    const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
    if ((p as any)?.role === 'admin') return { ok: true as const, status: 200, supabase: svc, user }
  } else {
    if (user.email === 'admin@auran.kr') return { ok: true as const, status: 200, supabase, user }
  }

  return { ok: false as const, status: 403, supabase, user }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)

  const userSearch = req.nextUrl.searchParams.get('user_q')
  if (userSearch && userSearch.trim()) {
    const s = userSearch.trim().replace(/%/g, '').slice(0, 80)
    const { data: users, error: uerr } = await auth.supabase
      .from('users')
      .select('id,auth_id,name,email,phone')
      .or(`email.ilike.%${s}%,name.ilike.%${s}%`)
      .limit(25)
    if (uerr) return json({ ok: false, error: uerr.message }, 500)
    return json({ ok: true, users: users || [] })
  }

  const { data: coupons, error } = await auth.supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return json({ ok: false, error: error.message }, 500)

  const stats: Record<string, { issued: number; used: number }> = {}
  for (const c of coupons || []) {
    const { count: issued } = await auth.supabase
      .from('user_coupons')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', (c as any).id)
    const { count: used } = await auth.supabase
      .from('user_coupons')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', (c as any).id)
      .eq('status', 'used')
    stats[(c as any).id] = { issued: issued || 0, used: used || 0 }
  }

  return json({ ok: true, coupons: coupons || [], stats })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)

  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''

  if (action === 'create') {
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) return json({ ok: false, error: 'name_required' }, 400)
    const type = body?.type === 'rate' ? 'rate' : 'amount'
    const code =
      typeof body?.code === 'string' && body.code.trim()
        ? body.code.trim()
        : `APP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
    const discount_amount = Math.max(0, Math.floor(Number(body?.discount_amount) || 0))
    const discount_rate = Math.max(0, Number(body?.discount_rate) || 0)
    const min_order = Math.max(0, Math.floor(Number(body?.min_order) || 0))
    const issue_trigger = typeof body?.issue_trigger === 'string' ? body.issue_trigger : 'manual'
    const max_issue_count = body?.max_issue_count == null ? null : Math.max(0, Math.floor(Number(body.max_issue_count)))
    const is_active = body?.is_active !== false
    const description = typeof body?.description === 'string' ? body.description : null
    const start_at = body?.start_at ? String(body.start_at) : null
    const end_at = body?.end_at ? String(body.end_at) : null

    const { data: row, error } = await auth.supabase
      .from('coupons')
      .insert({
        code,
        name,
        description,
        type,
        discount_amount: type === 'amount' ? discount_amount : null,
        discount_rate: type === 'rate' ? discount_rate : null,
        min_order,
        start_at,
        end_at,
        issue_trigger,
        max_issue_count,
        is_active,
        issued_count: 0,
        usage_limit: null,
        used_count: 0,
      })
      .select('id')
      .single()
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, id: row?.id })
  }

  if (action === 'issue') {
    const coupon_id = typeof body?.coupon_id === 'string' ? body.coupon_id : ''
    const user_auth_id = typeof body?.user_auth_id === 'string' ? body.user_auth_id : ''
    if (!coupon_id || !user_auth_id) return json({ ok: false, error: 'missing_fields' }, 400)

    const { data: c } = await auth.supabase.from('coupons').select('id,issued_count,max_issue_count').eq('id', coupon_id).maybeSingle()
    if (!c) return json({ ok: false, error: 'coupon_not_found' }, 400)
    if (c.max_issue_count != null && (c.issued_count || 0) >= c.max_issue_count) {
      return json({ ok: false, error: 'issue_limit_reached' }, 400)
    }

    const { data: exists } = await auth.supabase
      .from('user_coupons')
      .select('id')
      .eq('user_id', user_auth_id)
      .eq('coupon_id', coupon_id)
      .maybeSingle()
    if (exists) return json({ ok: false, error: 'already_issued' }, 400)

    const { error: insErr } = await auth.supabase.from('user_coupons').insert({
      user_id: user_auth_id,
      coupon_id,
      status: 'unused',
    })
    if (insErr) return json({ ok: false, error: insErr.message }, 500)

    await auth.supabase
      .from('coupons')
      .update({ issued_count: (c.issued_count || 0) + 1 })
      .eq('id', coupon_id)

    return json({ ok: true })
  }

  return json({ ok: false, error: 'unknown_action' }, 400)
}
