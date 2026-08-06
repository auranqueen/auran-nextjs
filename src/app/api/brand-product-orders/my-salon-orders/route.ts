import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const { data: salon } = await service.from('salons').select('id').eq('owner_id', me.id).maybeSingle()
  if (!salon) return NextResponse.json({ ok: true, orders: [] })
  const { data: rows } = await service
    .from('brand_product_orders')
    .select('id, order_no, status, recipient_name, recipient_phone, address, final_amount, owner_amount, courier, tracking_no, ordered_at, checkout_batch_id')
    .eq('salon_id', salon.id)
    .not('status', 'in', '("결제대기","취소")')
    .order('ordered_at', { ascending: false })
    .limit(50)
  const orderIds = (rows || []).map(r => r.id)
  const { data: itemRows } = orderIds.length > 0
    ? await service.from('brand_product_order_items').select('order_id, product_name, quantity').in('order_id', orderIds)
    : { data: [] }
  const withItems = (rows || []).map(r => ({
    ...r,
    items: (itemRows || []).filter(i => i.order_id === r.id),
  }))
  return NextResponse.json({ ok: true, orders: withItems })
}
