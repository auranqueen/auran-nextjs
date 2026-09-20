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
  const { action, q, draft, order, id } = body
  if (action === 'search') {
    const { data } = await svc.from('products').select('id,name').ilike('name', `%${q.trim()}%`).limit(8)
    return NextResponse.json({ results: data ?? [] })
  }
  if (action === 'save') {
    const { error } = await svc.from('bundle_templates').update({
      theme_name: draft.theme_name, target_phase: draft.target_phase, product_ids: draft.product_ids,
      usage_guide: draft.usage_guide, owner_tip: draft.owner_tip, is_active: draft.is_active, updated_at: new Date().toISOString(),
    }).eq('id', draft.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'addNew') {
    const { data, error } = await svc.from('bundle_templates')
      .insert({ theme_name: '새 리추얼', target_phase: null, product_ids: [], display_order: order })
      .select('id,theme_name,target_phase,product_ids,usage_guide,owner_tip,is_active,display_order').single()
    if (error || !data) return NextResponse.json({ error: error?.message ?? '추가 실패' }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }
  if (action === 'delete') {
    const { error } = await svc.from('bundle_templates').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
