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
  const { data: rows } = await service
    .from('brand_product_orders')
    .select('id, order_no, status, final_amount, courier, tracking_no, ordered_at, delivered_at')
    .eq('customer_id', me.id)
    .not('status', 'in', '("결제대기","취소")')
    .order('ordered_at', { ascending: false })
    .limit(50)
  const orderIds = (rows || []).map(r => r.id)
  const { data: itemRows } = orderIds.length > 0
    ? await service.from('brand_product_order_items').select('order_id, brand_product_id, product_name, quantity').in('order_id', orderIds)
    : { data: [] }
  const withItems = (rows || []).map(r => ({
    ...r,
    items: (itemRows || []).filter(i => i.order_id === r.id),
  }))
  return NextResponse.json({ ok: true, orders: withItems })
}
