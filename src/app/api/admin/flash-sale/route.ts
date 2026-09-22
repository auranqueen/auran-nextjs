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
  const { action, query, id, payload } = body
  if (action === 'search') {
    let req2 = svc.from('products').select('id,name,retail_price,flash_sale_price,flash_sale_start,flash_sale_end,is_flash_sale').order('created_at', { ascending: false }).limit(30)
    if (query) req2 = req2.ilike('name', `%${query}%`)
    const { data } = await req2
    return NextResponse.json({ products: data || [] })
  }
  if (action === 'active') {
    const now = new Date().toISOString()
    const { data } = await svc.from('products').select('id,name,flash_sale_price,flash_sale_end,is_flash_sale').eq('is_flash_sale', true).lt('flash_sale_start', now).gt('flash_sale_end', now).order('flash_sale_end', { ascending: true }).limit(50)
    return NextResponse.json({ active: data || [] })
  }
  if (action === 'update') {
    const { error } = await svc.from('products').update(payload).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
