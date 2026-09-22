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
  const { action, payload } = body
  if (action === 'list') {
    const [{ data: links }, { data: p }] = await Promise.all([
      svc.from('invite_links').select('*').order('created_at', { ascending: false }).limit(200),
      svc.from('admin_settings').select('value').eq('category', 'points_action').eq('key', 'ai_analysis_complete').maybeSingle(),
    ])
    return NextResponse.json({ links: links || [], analysisPoint: Number(p?.value ?? 500) })
  }
  if (action === 'generate') {
    const { data: u } = await svc.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const createdBy = (u as any)?.id || null
    const { error } = await svc.from('invite_links').insert({ ...payload, created_by: createdBy })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
