import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
const TRACK_A_AUTO_CONFIRM_DAYS = 14
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const body = await req.json()
  const { target_status, courier, tracking_no } = body
  if (!['배송중', '배송완료'].includes(target_status)) {
    return NextResponse.json({ ok: false, error: 'invalid_target_status' }, { status: 400 })
  }
  const { data: order } = await service
    .from('brand_product_orders')
    .select('id, salon_id, status')
    .eq('id', params.id)
    .maybeSingle()
  if (!order) return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 })
  const { data: salon } = await service
    .from('salons')
    .select('id, owner_id')
    .eq('id', order.salon_id)
    .single()
  if (!salon || salon.owner_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }
  const { data: owner } = await service.from('users').select('origin_track').eq('id', me.id).single()
  if (!owner || owner.origin_track !== 'A') {
    return NextResponse.json({ ok: false, error: 'not_track_a' }, { status: 403 })
  }
  if (target_status === '배송중') {
    if (!courier || !tracking_no) {
      return NextResponse.json({ ok: false, error: 'tracking_info_required' }, { status: 400 })
    }
    if (order.status !== '결제완료') {
      return NextResponse.json({ ok: false, error: 'invalid_status_transition' }, { status: 400 })
    }
    const { error: shipErr } = await service
      .from('brand_product_orders')
      .update({ status: '배송중', courier, tracking_no, shipped_at: new Date().toISOString() })
      .eq('id', order.id)
    if (shipErr) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }
  if (target_status === '배송완료') {
    if (order.status !== '배송중') {
      return NextResponse.json({ ok: false, error: 'invalid_status_transition' }, { status: 400 })
    }
    const now = new Date()
    const autoConfirmAt = new Date(now.getTime() + TRACK_A_AUTO_CONFIRM_DAYS * 24 * 60 * 60 * 1000)
    const { error: deliverErr } = await service
      .from('brand_product_orders')
      .update({ status: '배송완료', delivered_at: now.toISOString(), auto_confirm_at: autoConfirmAt.toISOString() })
      .eq('id', order.id)
    if (deliverErr) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
