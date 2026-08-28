import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { handleSceneUploaderOnBrandProductConfirm } from '@/lib/orenScene/scenePaymentNotifications'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const { data: order } = await service
    .from('brand_product_orders')
    .select('id, customer_id, status, source_scene_post_id, customer_toast_amount')
    .eq('id', params.id)
    .maybeSingle()
  if (!order || order.customer_id !== me.id) {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 })
  }
  if (order.status !== '배송완료') {
    return NextResponse.json({ ok: false, error: 'invalid_status_transition' }, { status: 400 })
  }
  const { error } = await service
    .from('brand_product_orders')
    .update({ status: '구매확정', confirmed_at: new Date().toISOString() })
    .eq('id', order.id)
  if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  await handleSceneUploaderOnBrandProductConfirm(service, order)
  return NextResponse.json({ ok: true })
}
