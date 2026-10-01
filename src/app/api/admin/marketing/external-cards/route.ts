import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  const svc = tryCreateAdminClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  return { svc }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.svc) return auth.error
  const svc = auth.svc
  const type = req.nextUrl.searchParams.get('type')

  if (type === 'cards') {
    const { data, error } = await svc.from('external_care_cards_v2').select('*').order('created_at', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  if (type === 'customers') {
    const { data, error } = await svc.from('external_customers').select('*').is('owner_id', null).order('total_amount', { ascending: false })
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  if (type === 'customer_search') {
    const q = req.nextUrl.searchParams.get('q') || ''
    if (!q) return NextResponse.json({ ok: true, data: [] })
    const { data, error } = await svc.from('external_customers').select('*').is('owner_id', null).ilike('name', `%${q}%`).limit(5)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  if (type === 'product_search') {
    const q = req.nextUrl.searchParams.get('q') || ''
    const mode = req.nextUrl.searchParams.get('mode') || 'purchase'
    if (!q) return NextResponse.json({ ok: true, data: [] })
    const columns = mode === 'purchase'
      ? 'id,name,retail_price,owner_comment,review_points_text,review_points_photo,review_points_video,brands(name)'
      : 'id,name,owner_comment'
    const { data, error } = await svc.from('products').select(columns).ilike('name', `%${q}%`).eq('is_active', true).limit(6)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, data: data || [] })
  }

  return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.svc) return auth.error
  const svc = auth.svc
  const body = await req.json().catch(() => ({}))
  const action = body?.action

  if (action === 'save') {
    const { customer_name, memo, card_id, card_payload } = body
    if (!customer_name) return NextResponse.json({ ok: false, error: 'missing_customer_name' }, { status: 400 })
    const cleanPayload = {
      ...card_payload,
      phone: card_payload?.phone || null,
      address: card_payload?.address || null,
      channel: card_payload?.channel || null,
    }
    const { data, error } = await svc.rpc('save_external_card', {
      p_customer_name: customer_name,
      p_memo: memo ?? null,
      p_card_id: card_id ?? null,
      p_card_payload: cleanPayload,
    })
    if (error || !(data as any)?.ok) return NextResponse.json({ ok: false, error: (data as any)?.error || error?.message }, { status: 500 })
    return NextResponse.json({ ok: true, customer_id: (data as any).customer_id })
  }

  if (action === 'delete_card') {
    const { id } = body
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    const { error } = await svc.from('external_care_cards_v2').delete().eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_customer') {
    const { id } = body
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
    const { data, error } = await svc.rpc('delete_external_customer', { p_customer_id: id })
    if (error || !(data as any)?.ok) return NextResponse.json({ ok: false, error: (data as any)?.error || error?.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
}