/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notifications/createNotification'
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
      .select('id,auth_id,name,email,phone,skin_type')
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

  const productQ = req.nextUrl.searchParams.get('product_q')
  if (productQ && productQ.trim()) {
    const s = productQ.trim().replace(/%/g, '').slice(0, 80)
    const { data: rows, error } = await auth.supabase
      .from('products')
      .select('id,name,retail_price,brand_id,brands(name)')
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
    if (!coupon_id || !user_auth_id) return json({ ok: false, error: 'missing_fields' }, 400)

    const db = tryCreateServiceClient() || auth.supabase

    const { data: c } = await db.from('coupons').select('id,issued_count,max_issue_count').eq('id', coupon_id).maybeSingle()
    if (!c) return json({ ok: false, error: 'coupon_not_found' }, 400)
    if (c.max_issue_count != null && (c.issued_count || 0) >= c.max_issue_count) {
      return json({ ok: false, error: 'issue_limit_reached' }, 400)
    }

    const { data: exists } = await db
      .from('user_coupons')
      .select('id')
      .eq('user_id', user_auth_id)
      .eq('coupon_id', coupon_id)
      .maybeSingle()
    if (exists) return json({ ok: false, error: 'already_issued' }, 400)

    const { error: insErr } = await db.from('user_coupons').insert({
      user_id: user_auth_id,
      coupon_id,
      status: 'unused',
    })
    if (insErr) return json({ ok: false, error: insErr.message }, 500)

    await db
      .from('coupons')
      .update({ issued_count: (c.issued_count || 0) + 1 })
      .eq('id', coupon_id)

    const { data: recipient } = await db.from('users').select('id').eq('auth_id', user_auth_id).maybeSingle()
    if (recipient?.id) {
      await createNotification(
        db,
        recipient.id,
        'coupon',
        '새 쿠폰이 발급됐어요!',
        '쿠폰함에서 확인해 보세요.',
        '/my/coupons'
      )
    }

    return json({ ok: true })
  }

  return json({ ok: false, error: 'unknown_action' }, 400)
}
