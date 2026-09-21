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
  const { action, detailId, form } = body
  if (action === 'list') {
    const [{ data: companies }, { data: brands }] = await Promise.all([
      svc.from('brand_companies').select('id,name,logo_url,payapp_active,payapp_user_id,payapp_key,payapp_linkval,created_at').order('created_at', { ascending: false }),
      svc.from('brands').select('company_id'),
    ])
    const countMap: Record<string, number> = {}
    for (const b of brands || []) {
      const cid = (b as any).company_id
      if (!cid) continue
      countMap[cid] = (countMap[cid] || 0) + 1
    }
    const merged = (companies || []).map((c: any) => ({ ...c, brand_count: countMap[c.id] || 0 }))
    return NextResponse.json({ companies: merged })
  }
  if (action === 'save') {
    const { error } = await svc.from('brand_companies').update({
      name: form.name.trim(),
      logo_url: form.logoUrl.trim() || null,
      payapp_active: form.payappActive,
      payapp_user_id: form.payappUserId.trim() || null,
      payapp_key: form.payappKey.trim() || null,
      payapp_linkval: form.payappLinkval.trim() || null,
    }).eq('id', detailId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
