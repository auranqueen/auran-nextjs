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
  const { action, id, content, payload, query, is_published, published_at } = body

  if (action === 'load') {
    const { data, error } = await svc
      .from('magazines')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data || [] })
  }

  // [ANCHOR: load-curator]
  if (action === 'loadCurator') {
    const { data, error } = await svc
      .from('magazines')
      .select('id, title, category, is_published, author_type, created_by, created_at, slug')
      .eq('author_type', 'curator')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const rows = (data || []) as unknown as { created_by: string | null }[]
    const ids = Array.from(new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)))
    const names: Record<string, string> = {}
    if (ids.length > 0) {
      const { data: profs } = await svc.from('profiles').select('*').in('auth_id', ids)
      for (const p of (profs || []) as unknown as Record<string, unknown>[]) {
        names[String(p.auth_id)] = String(p.full_name || p.name || p.nickname || p.email || '-')
      }
    }
    return NextResponse.json({
      items: rows.map((r) => ({ ...r, author_name: r.created_by ? names[r.created_by] || '-' : '-' })),
    })
  }

  if (action === 'saveContent') {
    const { error } = await svc.from('magazines').update({ content }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'searchProducts') {
    const { data, error } = await svc
      .from('products')
      .select('id, name, retail_price, sale_price')
      .ilike('name', `%${query}%`)
      .limit(15)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ products: data || [] })
  }

  if (action === 'save') {
    if (id) {
      const { error } = await svc.from('magazines').update(payload).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await svc.from('magazines').insert(payload)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete') {
    const { error } = await svc.from('magazines').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'togglePublish') {
    const patch: Record<string, unknown> = { is_published }
    if (published_at !== undefined) patch.published_at = published_at
    const { error } = await svc.from('magazines').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
