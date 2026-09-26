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
  const { action, id, stock, is_active, payload } = body

  if (action === 'load') {
    const [{ data: gifts }, { data: products }] = await Promise.all([
      svc
        .from('gift_items')
        .select('*, product:products(id, name, thumb_img, brand_id)')
        .order('created_at', { ascending: false }),
      svc
        .from('products')
        .select('id, name, brand_id, thumb_img')
        .eq('is_active', true)
        .order('name'),
    ])
    return NextResponse.json({ gifts: gifts || [], products: products || [] })
  }

  if (action === 'add') {
    const { error } = await svc.from('gift_items').insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'updateStock') {
    const { error } = await svc.from('gift_items').update({ stock }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'toggleActive') {
    const { error } = await svc.from('gift_items').update({ is_active }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const { error } = await svc.from('gift_items').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
