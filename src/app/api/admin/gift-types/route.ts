import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

async function adminDb() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, client: null as any }

  const appRole = (user.app_metadata as { role?: string } | undefined)?.role
  const client = tryCreateServiceClient() || supabase

  if (appRole === 'super_admin') return { ok: true as const, status: 200, client }

  const { data: u } = await client.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  if ((u as any)?.role === 'admin') return { ok: true as const, status: 200, client }
  const { data: p } = await client.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((p as any)?.role === 'admin') return { ok: true as const, status: 200, client }
  if (!tryCreateServiceClient() && user.email === 'admin@auran.kr') {
    return { ok: true as const, status: 200, client: supabase }
  }

  return { ok: false as const, status: 403, client: null as any }
}

export async function GET() {
  const auth = await adminDb()
  if (!auth.ok) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: auth.status })

  const { data, error } = await auth.client
    .from('gift_types')
    .select('id, name, emoji, is_active, order, created_at')
    .order('order', { ascending: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data || [] })
}

export async function POST(req: NextRequest) {
  const auth = await adminDb()
  if (!auth.ok) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name || '').trim()
  const emoji = String(body?.emoji || '🎁').trim() || '🎁'
  const is_active = body?.is_active !== false
  if (!name) return NextResponse.json({ ok: false, error: 'name_required' }, { status: 400 })

  const { data: maxRow } = await auth.client
    .from('gift_types')
    .select('order')
    .order('order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const order = typeof body?.order === 'number' ? body.order : Number((maxRow as any)?.order || 0) + 1

  const { data, error } = await auth.client
    .from('gift_types')
    .insert({ name, emoji, is_active, order } as any)
    .select('id, name, emoji, is_active, order, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await adminDb()
  if (!auth.ok) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || '')
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (body?.name != null) patch.name = String(body.name).trim()
  if (body?.emoji != null) patch.emoji = String(body.emoji).trim() || '🎁'
  if (body?.is_active != null) patch.is_active = !!body.is_active
  if (typeof body?.order === 'number') patch.order = body.order

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: 'nothing_to_update' }, { status: 400 })
  }

  const { data, error } = await auth.client
    .from('gift_types')
    .update(patch as any)
    .eq('id', id)
    .select('id, name, emoji, is_active, order, created_at')
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await adminDb()
  if (!auth.ok) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const id = String(body?.id || req.nextUrl.searchParams.get('id') || '')
  if (!id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 })

  const { error } = await auth.client.from('gift_types').delete().eq('id', id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
