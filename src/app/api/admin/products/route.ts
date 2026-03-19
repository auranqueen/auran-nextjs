import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

async function requireAdminApi() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, supabase, user: null }

  const svc = tryCreateServiceClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
    if ((u as any)?.role === 'admin') return { ok: true as const, status: 200, supabase: svc, user }
    const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
    if ((p as any)?.role === 'admin') return { ok: true as const, status: 200, supabase: svc, user }
  } else {
    if (user.email === 'admin@auran.kr') return { ok: true as const, status: 200, supabase, user }
  }

  return { ok: false as const, status: 403, supabase, user }
}

function normalizeStatus(input: string | null) {
  const s = (input || '').toLowerCase()
  if (s === 'pending') return 'pending'
  if (s === 'active') return 'active'
  if (s === 'rejected') return 'discontinued' // schema-safe mapping
  return 'pending'
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)

  const status = normalizeStatus(req.nextUrl.searchParams.get('status'))

  const { data: rows, error } = await auth.supabase
    .from('products')
    .select('id,name,thumb_img,retail_price,status,created_at,approved_at,brands(name)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return json({ ok: false, error: error.message }, 500)

  const [pendingC, activeC, rejectedC] = await Promise.all([
    auth.supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    auth.supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    auth.supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'discontinued'),
  ])

  return json({
    ok: true,
    status,
    counts: {
      pending: pendingC.count || 0,
      active: activeC.count || 0,
      rejected: rejectedC.count || 0,
    },
    rows: rows || [],
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)

  const body = await req.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : ''

  if (action === 'approve') {
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id) return json({ ok: false, error: 'missing_id' }, 400)
    const { error } = await auth.supabase
      .from('products')
      .update({ status: 'active', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true })
  }

  if (action === 'reject') {
    const id = typeof body?.id === 'string' ? body.id : null
    if (!id) return json({ ok: false, error: 'missing_id' }, 400)
    const { error } = await auth.supabase
      .from('products')
      .update({ status: 'discontinued', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true })
  }

  if (action === 'bulk_approve') {
    const { error } = await auth.supabase
      .from('products')
      .update({ status: 'active', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('status', 'pending')
    if (error) return json({ ok: false, error: error.message }, 500)
    return json({ ok: true })
  }

  return json({ ok: false, error: 'invalid_action' }, 400)
}

