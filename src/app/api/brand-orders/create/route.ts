import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

const BLOCK_MESSAGE = '미납 청구서가 있어 발주가 제한됩니다'

/** billing_month(YYYY-MM-01) → 그 달 30일(또는 말일 중 작은 값) 로컬 자정 */
function unpaidDueDate(billingMonth: string): Date {
  const ym = String(billingMonth).slice(0, 7)
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return new Date(0)
  const lastDay = new Date(y, m, 0).getDate()
  const dueDay = Math.min(30, lastDay)
  return new Date(y, m - 1, dueDay)
}

function startOfTodayLocal(): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized', message: '로그인이 필요합니다' }, { status: 401 })
  }

  const svc = tryCreateAdminClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: '서버 오류' }, { status: 500 })
  }

  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id.trim() : ''
  const profileId = typeof body?.profile_id === 'string' ? body.profile_id.trim() : ''
  const ownerName = typeof body?.owner_name === 'string' ? body.owner_name : ''
  const salonName = typeof body?.salon_name === 'string' ? body.salon_name : ''
  const grade = typeof body?.grade === 'string' ? body.grade : ''
  const items = Array.isArray(body?.items) ? body.items : null
  const totalQty = Math.trunc(Number(body?.total_qty) || 0)
  const totalAmount = Math.trunc(Number(body?.total_amount) || 0)
  const promoApplied = body?.promo_applied == null ? null : String(body.promo_applied)
  const pointsEarned = Math.trunc(Number(body?.points_earned) || 0)

  if (!brandId || !profileId || !items || items.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
  }
  if (profileId !== profile.id) {
    return NextResponse.json({ ok: false, error: 'profile_mismatch', message: '프로필이 일치하지 않습니다' }, { status: 403 })
  }

  const { data: unpaidRows } = await svc
    .from('brand_billing_invoices')
    .select('id, billing_month, status')
    .eq('owner_id', profileId)
    .eq('brand_id', brandId)
    .eq('status', 'unpaid')
    .gt('total_amount', 0)

  const today = startOfTodayLocal()
  const overdue = (unpaidRows || []).some((inv: { billing_month?: string }) => {
    const due = unpaidDueDate(String(inv.billing_month || ''))
    return due.getTime() < today.getTime()
  })
  if (overdue) {
    return NextResponse.json({ ok: false, error: 'unpaid_invoice', message: BLOCK_MESSAGE }, { status: 403 })
  }

  const { data: order, error: insertErr } = await svc
    .from('brand_orders')
    .insert({
      brand_id: brandId,
      profile_id: profileId,
      owner_name: ownerName,
      salon_name: salonName,
      grade,
      status: 'pending',
      items,
      total_qty: totalQty,
      total_amount: totalAmount,
      promo_applied: promoApplied,
      points_earned: pointsEarned,
    })
    .select('id')
    .single()

  if (insertErr || !order?.id) {
    return NextResponse.json(
      { ok: false, error: 'insert_failed', message: insertErr?.message || '발주 실패' },
      { status: 500 },
    )
  }

  const itemSummary = (items as Array<{ name?: string; qty?: number; line_amount?: number }>)
    .map((i) => `${i.name || ''} ${i.qty || 0}ea · ₩${Number(i.line_amount || 0).toLocaleString()}`)
    .join(', ')

  await svc.from('brand_messages').insert({
    brand_id: brandId,
    message_type: 'auto_order',
    target_type: 'all',
    title: `${ownerName} 원장님 발주 접수`,
    body: `${ownerName} 원장님(${salonName})이 발주를 요청했습니다. ${itemSummary}`,
    send_count: 1,
  })

  return NextResponse.json({ ok: true, order_id: order.id })
}
