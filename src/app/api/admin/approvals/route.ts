import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function requireAdminViaService() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, user: null }

  const svc = createServiceClient()
  const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  const role = (u as any)?.role || null
  if (role === 'admin') return { ok: true as const, status: 200, user }

  const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  const pRole = (p as any)?.role || null
  if (pRole === 'admin') return { ok: true as const, status: 200, user }

  return { ok: false as const, status: 403, user }
}

export async function GET() {
  const admin = await requireAdminViaService()
  if (!admin.ok) return NextResponse.json({ ok: false, reason: 'not_admin' }, { status: admin.status })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('users')
    .select('id,auth_id,email,name,role,status,created_at')
    .in('role', ['partner', 'owner', 'brand'])
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rows: data || [] })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminViaService()
  if (!admin.ok) return NextResponse.json({ ok: false, reason: 'not_admin' }, { status: admin.status })

  const body = await req.json().catch(() => ({}))
  const authId = typeof body?.auth_id === 'string' ? body.auth_id : ''
  if (!authId) return NextResponse.json({ ok: false, error: 'missing_auth_id' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('users')
    .update({ status: 'active', approved_at: new Date().toISOString() })
    .eq('auth_id', authId)
    .in('role', ['partner', 'owner', 'brand'])

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

