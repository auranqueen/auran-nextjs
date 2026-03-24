/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { insertCouponCampaignRecord } from '@/lib/admin/couponCampaign'
import { bulkIssueSpecialEventCoupon } from '@/lib/admin/issueCouponBulkSpecial'
import { issueCouponsToAuthUsers } from '@/lib/admin/issueCouponsBulk'
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

  if (req.nextUrl.searchParams.get('customer_with_auth_count') === '1') {
    const { count, error } = await auth.supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer')
      .not('auth_id', 'is', null)
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, count: count ?? 0 })
  }

  const topPurchasers = req.nextUrl.searchParams.get('top_purchasers')
  if (topPurchasers && /^\d+$/.test(topPurchasers)) {
    const n = Math.min(500, Math.max(1, parseInt(topPurchasers, 10)))
    const { data: topRows, error: rpcErr } = await auth.supabase.rpc('admin_top_customers_by_spend', {
      limit_n: n,
    } as any)
    if (rpcErr) return json({ ok: false, error: rpcErr.message }, 500)
    const rows = (topRows || []) as { customer_id: string; total_spend: number }[]
    const ids = rows.map((r) => r.customer_id).filter(Boolean)
    if (!ids.length) return json({ ok: true, top_purchasers: [] })
    const { data: us, error: uerr } = await auth.supabase
      .from('users')
      .select('id,auth_id,name,email,phone,customer_grade')
      .in('id', ids)
    if (uerr) return json({ ok: false, error: uerr.message }, 500)
    const byId = new Map((us || []).map((u: any) => [u.id, u]))
    const top_purchasers = rows
      .map((r) => {
        const u = byId.get(r.customer_id) as Record<string, unknown> | undefined
        if (!u) return null
        return {
          ...u,
          total_spend: Number(r.total_spend) || 0,
        }
      })
      .filter(Boolean)
    return json({ ok: true, top_purchasers })
  }

  const gradesParam = req.nextUrl.searchParams.get('customer_grades')
  if (gradesParam && gradesParam.trim()) {
    const parts = gradesParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!parts.length) return json({ ok: true, users: [] })
    const { data: users, error: gerr } = await auth.supabase
      .from('users')
      .select('id,auth_id,name,email,phone,customer_grade')
      .eq('role', 'customer')
      .in('customer_grade', parts)
      .not('auth_id', 'is', null)
      .limit(2000)
    if (gerr) return json({ ok: false, error: gerr.message }, 500)
    return json({ ok: true, users: users || [] })
  }

  if (req.nextUrl.searchParams.get('recent_issue_log') === '1') {
    const { data: urows, error: uerr } = await auth.supabase
      .from('user_coupons')
      .select('id,user_id,coupon_id,issued_at,used_at,status,coupons(name)')
      .order('issued_at', { ascending: false })
      .limit(10)
    if (uerr) return json({ ok: false, error: uerr.message }, 500)
    const list = urows || []
    const authIds = Array.from(new Set(list.map((r: any) => r.user_id).filter(Boolean)))
    const usersByAuth: Record<string, { name: string | null; email: string | null }> = {}
    if (authIds.length) {
      const { data: ulist } = await auth.supabase.from('users').select('auth_id,name,email').in('auth_id', authIds)
      for (const u of ulist || []) {
        const row = u as { auth_id: string; name: string | null; email: string | null }
        if (row.auth_id) usersByAuth[row.auth_id] = { name: row.name, email: row.email }
      }
    }
    const recent_issue_log = list.map((r: any) => {
      const c = r.coupons
      const couponName =
        c && typeof c === 'object' && !Array.isArray(c)
          ? (c as { name?: string }).name
          : Array.isArray(c) && c[0]
            ? (c[0] as { name?: string }).name
            : null
      const u = usersByAuth[r.user_id]
      const used = r.status === 'used' || (r.used_at != null && r.used_at !== '')
      return {
        id: r.id,
        user_id: r.user_id,
        coupon_id: r.coupon_id,
        issued_at: r.issued_at,
        used_at: r.used_at,
        used,
        coupon_name: couponName || '—',
        customer_name: u?.name?.trim() || '—',
        customer_email: u?.email || null,
      }
    })
    return json({ ok: true, recent_issue_log })
  }

  const userSearch = req.nextUrl.searchParams.get('user_q')
  if (userSearch && userSearch.trim()) {
    const s = userSearch.trim().replace(/%/g, '').slice(0, 80)
    const { data: users, error: uerr } = await auth.supabase
      .from('users')
      .select('id,auth_id,name,email,phone,skin_type,customer_grade')
      .or(`email.ilike.%${s}%,name.ilike.%${s}%,phone.ilike.%${s}%`)
      .limit(25)
    if (uerr) return json({ ok: false, error: uerr.message }, 500)
    return json({ ok: true, users: users || [] })
  }

  const brandQ = req.nextUrl.searchParams.get('brand_q')
  if (brandQ && brandQ.trim()) {
    const s = brandQ.trim().replace(/%/g, '').slice(0, 80)
    const { data: rows, error } = await auth.supabase
      .from('brands')
      .select('id,name,logo_url')
      .ilike('name', `%${s}%`)
      .limit(30)
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, brands: rows || [] })
  }

  const couponId = req.nextUrl.searchParams.get('coupon_id')
  if (couponId && /^[0-9a-f-]{36}$/i.test(couponId.trim())) {
    const id = couponId.trim()
    const { data: coupon, error: cErr } = await auth.supabase.from('coupons').select('*').eq('id', id).maybeSingle()
    if (cErr || !coupon) return json({ ok: false, error: 'coupon_not_found' }, 404)

    const countStatus = async (status?: string) => {
      let q = auth.supabase.from('user_coupons').select('id', { count: 'exact', head: true }).eq('coupon_id', id)
      if (status) q = q.eq('status', status)
      const { count } = await q
      return count || 0
    }
    const [total, used, unused, expired] = await Promise.all([
      countStatus(),
      countStatus('used'),
      countStatus('unused'),
      countStatus('expired'),
    ])
    return json({
      ok: true,
      coupon,
      breakdown: { total, used, unused, expired },
    })
  }

  const productQ = req.nextUrl.searchParams.get('product_q')
  if (productQ && productQ.trim()) {
    const s = productQ.trim().replace(/%/g, '').slice(0, 80)
    const { data: rows, error } = await auth.supabase
      .from('products')
      .select('id,name,retail_price,brand_id')
      .eq('status', 'active')
      .ilike('name', `%${s}%`)
      .limit(30)
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true, products: rows || [] })
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

function parseUuidArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string' && x.length > 10).map((x) => x.trim())
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)

  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''

  if (action === 'create') {
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) return json({ ok: false, error: 'name_required' }, 400)

    const discountType = body?.discount_type === 'rate' || body?.discount_type === 'percent' ? 'rate' : 'amount'
    const discountValue = Math.max(0, Math.floor(Number(body?.discount_value) || 0))
    const { data: maxPctRow } = await auth.supabase
      .from('admin_settings')
      .select('value')
      .eq('category', 'coupon')
      .eq('key', 'max_percent_discount')
      .maybeSingle()
    const maxPct = Math.min(100, Math.max(0, Number(maxPctRow?.value ?? 70)))
    if (discountType === 'rate' && discountValue > maxPct) {
      return json({ ok: false, error: 'rate_too_high', max: maxPct }, 400)
    }

    const type = discountType === 'rate' ? 'rate' : 'amount'
    const code =
      typeof body?.code === 'string' && body.code.trim()
        ? body.code.trim()
        : `APP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

    const min_order = Math.max(0, Math.floor(Number(body?.min_order) || 0))
    const issue_trigger = typeof body?.issue_trigger === 'string' ? body.issue_trigger : 'manual'
    const max_issue_count = body?.max_issue_count == null ? null : Math.max(0, Math.floor(Number(body.max_issue_count)))
    const is_active = body?.is_active !== false
    const description = typeof body?.description === 'string' ? body.description : null
    const start_at = body?.start_at ? String(body.start_at) : null
    const end_at = body?.end_at ? String(body.end_at) : null

    const scope = typeof body?.scope === 'string' ? body.scope : 'all'
    const scope_brand_ids = parseUuidArray(body?.scope_brand_ids)
    const scope_product_ids = parseUuidArray(body?.scope_product_ids)
    const scope_user_ids = parseUuidArray(body?.scope_user_ids)
    const birthday_days_before = Math.max(0, Math.floor(Number(body?.birthday_days_before ?? 7)))
    const birthday_days_after = Math.max(0, Math.floor(Number(body?.birthday_days_after ?? 7)))

    const coupon_type =
      body?.coupon_type === 'special_event' ? 'special_event' : 'regular'

    const insertRow: Record<string, any> = {
      code,
      name,
      description,
      type,
      discount_amount: type === 'amount' ? discountValue : null,
      discount_rate: type === 'rate' ? discountValue : null,
      discount_type: discountType === 'rate' ? 'rate' : 'amount',
      discount_value: discountValue,
      min_order,
      start_at,
      end_at,
      issue_trigger,
      max_issue_count,
      is_active,
      issued_count: 0,
      usage_limit: null,
      used_count: 0,
      scope,
      scope_brand_ids: scope === 'brand' && scope_brand_ids.length ? scope_brand_ids : null,
      scope_product_ids: scope === 'product' && scope_product_ids.length ? scope_product_ids : null,
      scope_user_ids: scope_user_ids.length ? scope_user_ids : null,
      birthday_days_before,
      birthday_days_after,
      coupon_type,
    }

    const { data: row, error } = await auth.supabase
      .from('coupons')
      .insert(insertRow)
      .select('id')
      .single()
    if (error) return json({ ok: false, error: error.message }, 500)

    const newId = row?.id as string
    if (issue_trigger === 'specific_user' && scope_user_ids.length && newId) {
      let n = 0
      for (const uid of scope_user_ids) {
        const { data: ex } = await auth.supabase
          .from('user_coupons')
          .select('id')
          .eq('user_id', uid)
          .eq('coupon_id', newId)
          .maybeSingle()
        if (ex) continue
        const { error: insUc } = await auth.supabase.from('user_coupons').insert({
          user_id: uid,
          coupon_id: newId,
          status: 'unused',
        })
        if (!insUc) n += 1
      }
      if (n > 0) {
        const { data: cur } = await auth.supabase.from('coupons').select('issued_count').eq('id', newId).maybeSingle()
        await auth.supabase
          .from('coupons')
          .update({ issued_count: (cur?.issued_count || 0) + n })
          .eq('id', newId)
      }
    }

    return json({ ok: true, id: newId })
  }

  if (action === 'issue') {
    const coupon_id = typeof body?.coupon_id === 'string' ? body.coupon_id : ''
    const user_auth_id = typeof body?.user_auth_id === 'string' ? body.user_auth_id : ''

    const svc = tryCreateServiceClient()
    if (!svc) {
      return json(
        {
          ok: false,
          success: false,
          error: 'service_role_unconfigured',
          message: 'SUPABASE_SERVICE_ROLE_KEY가 설정되어야 수동 발급이 가능합니다.',
        },
        503
      )
    }

    const { results } = await issueCouponsToAuthUsers(svc, coupon_id, user_auth_id ? [user_auth_id] : [])
    const r0 = results[0]
    if (!r0) {
      return json({ ok: false, success: false, error: 'missing_fields' }, 400)
    }
    if (r0.status !== 'success') {
      const code =
        r0.status === 'already_issued'
          ? 'already_issued'
          : r0.status === 'user_not_found'
            ? 'user_not_found'
            : r0.message || 'issue_failed'
      return json({ ok: false, success: false, error: code }, 400)
    }
    if (r0.status === 'success') {
      const campaign_name =
        typeof body?.campaign_name === 'string' && body.campaign_name.trim()
          ? String(body.campaign_name).trim().slice(0, 200)
          : '수동발급'
      const issued_by = auth.user?.email || auth.user?.id || 'admin'
      await insertCouponCampaignRecord(svc, {
        coupon_id,
        campaign_name,
        issued_by,
        results,
        target_count: 1,
      })
    }
    const { data: uc } = await svc
      .from('user_coupons')
      .select('id,user_id,coupon_id,issued_at')
      .eq('user_id', user_auth_id)
      .eq('coupon_id', coupon_id)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return json(
      { ok: true, success: true, issued: uc || { user_id: user_auth_id, coupon_id } } as any
    )
  }

  if (action === 'issue_bulk_special') {
    const coupon_id = typeof body?.coupon_id === 'string' ? body.coupon_id : ''
    const target = body?.target === 'grade' ? 'grade' : body?.target === 'selected' ? 'selected' : 'all'
    const customer_grade = typeof body?.customer_grade === 'string' ? body.customer_grade.trim() : ''
    const auth_ids = parseUuidArray(body?.auth_ids)

    const svc = tryCreateServiceClient()
    if (!svc) {
      return json(
        {
          ok: false,
          error: 'service_role_unconfigured',
          message: 'SUPABASE_SERVICE_ROLE_KEY가 설정되어야 일괄 발급이 가능합니다.',
        },
        503
      )
    }

    const result = await bulkIssueSpecialEventCoupon(svc, coupon_id, {
      target,
      customer_grade: target === 'grade' ? customer_grade || null : null,
      auth_ids: target === 'selected' ? auth_ids : undefined,
    })
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.status)
    }
    return json({ ok: true, issued: result.issued, skipped: result.skipped })
  }

  return json({ ok: false, error: 'unknown_action' }, 400)
}
