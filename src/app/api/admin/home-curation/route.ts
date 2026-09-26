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
  const { action } = body

  // seasonId = UI month (1~12). DB 컬럼은 month (season_id 아님)
  if (action === 'init') {
    const { data } = await svc
      .from('admin_settings')
      .select('key,value')
      .eq('category', 'concern_best')
      .order('key')
    return NextResponse.json({ items: data || [] })
  }

  if (action === 'saveMapping') {
    const { seasonId, productId, func_tag, issue_key, priority } = body
    const month = Number(seasonId)
    const { data: existing } = await svc
      .from('season_product_mapping')
      .select('id')
      .eq('month', month)
      .eq('product_id', productId)
      .maybeSingle()
    if (existing) return NextResponse.json({ ok: true, skipped: true })
    const { error: insErr } = await svc.from('season_product_mapping').insert({
      month,
      product_id: productId,
      concern_tag: '',
      func_tag: func_tag ?? null,
      issue_key: issue_key ?? null,
      priority: priority ?? 1,
      is_active: true,
    })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'getMappings') {
    const { seasonId } = body
    const month = Number(seasonId)
    const { data, error: selErr } = await svc
      .from('season_product_mapping')
      .select('*, products(id,name,thumb_img,storage_thumb_url)')
      .eq('month', month)
      .eq('is_active', true)
      .order('priority')
    if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
    return NextResponse.json({ mappings: data ?? [] })
  }

  if (action === 'removeMapping') {
    const { id } = body
    const { error: delErr } = await svc.from('season_product_mapping').delete().eq('id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'removeAllMappings') {
    const { seasonId } = body
    const month = Number(seasonId)
    const { error: delErr } = await svc
      .from('season_product_mapping')
      .delete()
      .eq('month', month)
      .eq('is_active', true)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'addIssue') {
    const { key, value } = body
    const { error: insErr } = await svc.from('admin_settings').insert({
      category: 'monthly_issue',
      key: key ?? value,
      value,
    })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'removeIssue') {
    const { key } = body
    const { error: delErr } = await svc
      .from('admin_settings')
      .delete()
      .eq('category', 'monthly_issue')
      .eq('key', key)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'addConcern') {
    const { key, value } = body
    const { error: insErr } = await svc.from('admin_settings').insert({
      category: 'concern_best',
      key: key ?? value,
      value,
    })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'removeConcern') {
    const { key } = body
    const { error: delErr } = await svc
      .from('admin_settings')
      .delete()
      .eq('category', 'concern_best')
      .eq('key', key)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
