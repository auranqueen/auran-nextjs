import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const svc = tryCreateAdminClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return { res: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  return { svc }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.svc) return auth.res
  const svc = auth.svc
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'list') {
    const { data, error } = await svc
      .from('body_care_cards')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  if (type === 'product_names') {
    const idsRaw = req.nextUrl.searchParams.get('ids') || ''
    const ids = idsRaw.split(',').filter(Boolean)
    if (!ids.length) return NextResponse.json({ ok: true, data: [] })
    const { data, error } = await svc
      .from('products')
      .select('id, name, clean_name')
      .in('id', ids)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  if (type === 'product_search') {
    const q = req.nextUrl.searchParams.get('q') || ''
    if (q.length < 1) return NextResponse.json({ ok: true, data: [] })
    const { data, error } = await svc
      .from('products')
      .select('id, name, clean_name')
      .eq('is_active', true)
      .ilike('name', `%${q}%`)
      .limit(15)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.svc) return auth.res
  const svc = auth.svc
  const body = await req.json().catch(() => ({}))
  const { action } = body

  if (action === 'add') {
    const { data: maxRow } = await svc
      .from('body_care_cards')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = ((maxRow as any)?.sort_order ?? 0) + 1
    const { data, error } = await svc
      .from('body_care_cards')
      .insert({ ...body.payload, sort_order: nextOrder })
      .select()
      .single()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data })
  }

  if (action === 'update') {
    const { id, payload } = body
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    const { error } = await svc
      .from('body_care_cards')
      .update(payload)
      .eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const { id } = body
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    const { error } = await svc
      .from('body_care_cards')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
}
