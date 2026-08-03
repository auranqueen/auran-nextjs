import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
async function assertCompanyAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  companyId: string,
) {
  const { data: companyBrands } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
  const brandIds = (companyBrands || []).map((b: { id: string }) => b.id)
  if (brandIds.length === 0) return false
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return true
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .limit(1)
  return Boolean(owned && owned.length > 0)
}
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const orderId = typeof body?.order_id === 'string' ? body.order_id.trim() : ''
  const courier = typeof body?.courier === 'string' ? body.courier.trim() : ''
  const trackingNo = typeof body?.tracking_no === 'string' ? body.tracking_no.trim() : ''
  if (!companyId || !orderId || !courier || !trackingNo) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }
  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!me?.id || (me.role !== 'brand' && me.role !== 'ops')) {
    return NextResponse.json({ ok: false, error: 'forbidden_role' }, { status: 403 })
  }
  const allowed = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }
  const { data: order } = await supabase
    .from('brand_tier_orders')
    .select('id, company_id, approved_at, shipped_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!order?.id || String(order.company_id) !== companyId) {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 })
  }
  if (!order.approved_at) {
    return NextResponse.json({ ok: false, error: 'not_approved_yet' }, { status: 400 })
  }
  if (order.shipped_at) {
    return NextResponse.json({ ok: false, error: 'already_shipped' }, { status: 400 })
  }
  const svc = tryCreateServiceClient()
  const db = svc ?? supabase
  const { error } = await db
    .from('brand_tier_orders')
    .update({
      tracking_carrier: courier,
      tracking_number: trackingNo,
      shipped_at: new Date().toISOString(),
    })
    .eq('id', orderId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
