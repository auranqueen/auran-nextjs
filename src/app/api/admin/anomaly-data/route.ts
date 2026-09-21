import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateServiceClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { action, userId, id } = body
  if (action === 'list') {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
    const [abuseRes, paymentsRes, brandsRes] = await Promise.all([
      svc.from('point_history').select('id,user_id,description,amount,created_at').eq('type', 'earn').gte('created_at', since).gt('amount', 5000).order('created_at', { ascending: false }).limit(50),
      svc.from('payments').select('id,user_id,order_id,message,created_at').eq('status', 'error').order('created_at', { ascending: false }).limit(50),
      svc.from('brands').select('id,name,status,created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    ])
    return NextResponse.json({
      abuse: abuseRes.data || [],
      paymentErrors: paymentsRes.data || [],
      pendingBrands: brandsRes.data || [],
    })
  }
  if (action === 'suspend') {
    const { data: u, error: findErr } = await svc.from('users').select('auth_id').eq('id', userId).maybeSingle()
    if (findErr || !u?.auth_id) return NextResponse.json({ error: 'user not found' }, { status: 404 })
    const { error: dbErr } = await svc.from('users').update({ status: 'suspended' }).eq('id', userId)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
    const { error: authErr } = await svc.auth.admin.updateUserById(u.auth_id, { ban_duration: '876000h' })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'payment_checked') {
    const { error } = await svc.from('payments').update({ status: 'checked' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'hold_brand') {
    const { error } = await svc.from('brands').update({ status: 'hold' }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
