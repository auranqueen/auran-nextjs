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
  const { action, cPayload, rPayload, productPayload } = body
  if (action === 'list') {
    const [c, r] = await Promise.all([
      svc.from('commission_settings').select('role,track,rate').order('role'),
      svc.from('referral_settings').select('level,rate').order('level'),
    ])
    return NextResponse.json({ commission: c.data || [], referral: r.data || [] })
  }
  if (action === 'list_products') {
    const [p, pc] = await Promise.all([
      svc.from('products').select('id,name,retail_price,status').order('created_at', { ascending: false }).limit(300),
      svc.from('product_commissions').select('product_id,base_rate,partner_rate,owner_rate,live_rate').limit(500),
    ])
    return NextResponse.json({ products: p.data || [], pRows: pc.data || [] })
  }
  if (action === 'save') {
    const [cRes, rRes] = await Promise.all([
      svc.from('commission_settings').upsert(cPayload, { onConflict: 'role,track' }),
      svc.from('referral_settings').upsert(rPayload, { onConflict: 'level' }),
    ])
    if (cRes.error) return NextResponse.json({ error: cRes.error.message }, { status: 500 })
    if (rRes.error) return NextResponse.json({ error: rRes.error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'save_product') {
    const { error } = await svc.from('product_commissions').upsert(productPayload, { onConflict: 'product_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
