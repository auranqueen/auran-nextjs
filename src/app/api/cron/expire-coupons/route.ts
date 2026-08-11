import { NextRequest, NextResponse } from 'next/server'
import { expireUnusedCouponsPastEnd } from '@/lib/coupon/expireUserCoupons'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export const dynamic = 'force-dynamic'

/**
 * 만료된 쿠폰 템플릿에 묶인 미사용 user_coupons → status expired
 * Vercel Cron 또는 수동 호출: Authorization: Bearer $CRON_SECRET
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  const qSecret = req.nextUrl.searchParams.get('secret') || ''
  const secret = bearer || qSecret

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CRON_SECRET) return json({ ok: false, error: 'CRON_SECRET not configured' }, 503)
    if (secret !== process.env.CRON_SECRET) return json({ ok: false, error: 'unauthorized' }, 401)
  } else if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const { updated } = await expireUnusedCouponsPastEnd()
  let monthly_skin_reports: { users: number } | null = null
  if (new Date().getUTCDate() === 1) {
    monthly_skin_reports = await runMonthlySkinReportJob()
  }
  return json({ ok: true, updated, monthly_skin_reports })
}

/** 전월 skin_cycle_analysis·주문·피부사진 로그 집계 → monthly_skin_reports (매월 1일 크론 시 실행) */
async function runMonthlySkinReportJob(): Promise<{ users: number }> {
  const admin = tryCreateServiceClient()
  if (!admin) return { users: 0 }
  const now = new Date()
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1))
  const y = lastMonthEnd.getUTCFullYear()
  const mo = lastMonthEnd.getUTCMonth() + 1
  const reportMonth = `${y}-${String(mo).padStart(2, '0')}`
  const startIso = lastMonthStart.toISOString().slice(0, 10)
  const endIso = lastMonthEnd.toISOString().slice(0, 10)
  const rangeEnd = new Date(lastMonthEnd)
  rangeEnd.setUTCHours(23, 59, 59, 999)

  const { data: cycles } = await admin
    .from('skin_cycle_analysis')
    .select('auth_id, record_date, hormone_stage, checkin_condition')
    .gte('record_date', startIso)
    .lte('record_date', endIso)

  const { data: orders } = await admin
    .from('orders')
    .select('customer_id, items, final_amount, total_amount, ordered_at, status')
    .gte('ordered_at', lastMonthStart.toISOString())
    .lte('ordered_at', rangeEnd.toISOString())

  const userSet = new Set<string>()
  for (const r of cycles || []) {
    const id = String((r as { auth_id?: string }).auth_id || '')
    if (id) userSet.add(id)
  }
  for (const o of orders || []) {
    const st = String((o as { status?: string }).status || '')
    if (st === '취소' || st === '환불') continue
    const id = String((o as { customer_id?: string }).customer_id || '')
    if (id) userSet.add(id)
  }

  let users = 0
  for (const uid of Array.from(userSet)) {
    const rows = (cycles || []).filter((r: any) => String(r.auth_id) === uid)
    const hormone_pattern: Record<string, number> = {}
    const checkin_summary: Record<string, number> = {}
    for (const r of rows) {
      const hs = String((r as any).hormone_stage || '기타')
      hormone_pattern[hs] = (hormone_pattern[hs] || 0) + 1
      const cc = String((r as any).checkin_condition || '미기록')
      checkin_summary[cc] = (checkin_summary[cc] || 0) + 1
    }

    const myOrders = (orders || []).filter((o: any) => String(o.customer_id) === uid && String(o.status || '') !== '취소' && String(o.status || '') !== '환불')
    let totalAmt = 0
    const products: Record<string, { qty: number; subtotal: number }> = {}
    for (const o of myOrders) {
      totalAmt += Number((o as any).final_amount ?? (o as any).total_amount ?? 0)
      let items: any[] = []
      try {
        const raw = (o as any).items
        items = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []
      } catch {
        items = []
      }
      for (const it of items) {
        const pid = String(it?.product_id || '')
        if (!pid) continue
        const q = Math.max(1, Number(it?.quantity || 1))
        const unit = Number(it?.price ?? it?.sale_price ?? it?.retail_price ?? 0)
        if (!products[pid]) products[pid] = { qty: 0, subtotal: 0 }
        products[pid].qty += q
        products[pid].subtotal += unit * q
      }
    }
    const purchase_summary = { total_amount: totalAmt, products }

    let skin_changes: Record<string, unknown> = { photo_count: 0 }
    try {
      const { count } = await admin
        .from('skin_photo_log')
        .select('*', { count: 'exact', head: true })
        .eq('auth_id', uid)
        .gte('created_at', lastMonthStart.toISOString())
        .lte('created_at', rangeEnd.toISOString())
      skin_changes = { photo_count: count ?? 0 }
    } catch {
      skin_changes = { photo_count: 0 }
    }

    const { error } = await admin.from('monthly_skin_reports').upsert(
      {
        user_id: uid,
        report_month: reportMonth,
        hormone_pattern,
        checkin_summary,
        purchase_summary,
        skin_changes,
      } as any,
      { onConflict: 'user_id,report_month' }
    )
    if (!error) users += 1
  }
  return { users }
}
