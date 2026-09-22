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
  const { action, key, dbPhase, category, value, label } = body
  if (action === 'load') {
    const [settingsRes, countRes, listRes] = await Promise.all([
      svc.from('admin_settings').select('value').eq('category', 'hormone_comment').eq('key', key).maybeSingle(),
      svc.from('hormone_phase_learnings').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('phase', dbPhase),
      svc.from('hormone_phase_learnings').select('*').eq('status', 'approved').eq('phase', dbPhase).order('created_at', { ascending: false }).limit(20),
    ])
    return NextResponse.json({ value: settingsRes.data?.value ?? '', count: countRes.count ?? 0, list: listRes.data || [] })
  }
  if (action === 'save') {
    const { error } = await svc.from('admin_settings').upsert({ category, key, value, label }, { onConflict: 'category,key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
