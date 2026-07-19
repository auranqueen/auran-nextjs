import { NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: false, error: 'user_not_found' }, { status: 404 })
  const body = await req.json()
  const { subscribed } = body
  if (typeof subscribed !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  }
  if (subscribed) {
    const { error } = await service
      .from('brand_product_salon_subscribers')
      .upsert(
        { salon_id: params.id, customer_id: me.id },
        { onConflict: 'salon_id,customer_id' }
      )
    if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  } else {
    const { error } = await service
      .from('brand_product_salon_subscribers')
      .delete()
      .eq('salon_id', params.id)
      .eq('customer_id', me.id)
    if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: true, subscribed: false })
  const service = tryCreateAdminClient()
  if (!service) return NextResponse.json({ ok: true, subscribed: false })
  const { data: me } = await service.from('users').select('id').eq('auth_id', user.id).single()
  if (!me) return NextResponse.json({ ok: true, subscribed: false })
  const { data } = await service
    .from('brand_product_salon_subscribers')
    .select('id')
    .eq('salon_id', params.id)
    .eq('customer_id', me.id)
    .maybeSingle()
  return NextResponse.json({ ok: true, subscribed: !!data })
}
