import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

async function requireAdminViaService() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, user: null }

  const svc = tryCreateServiceClient()
  if (!svc) {
    if (user.email === 'admin@auran.kr') return { ok: true as const, status: 200, user }
    return { ok: false as const, status: 500, user }
  }
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

  const svc = tryCreateServiceClient()
  if (!svc) {
    // fallback: use normal session client (admin RLS permitting)
    const supabase = createClient()
    const [usersRes, brandsRes] = await Promise.all([
      supabase
        .from('users')
        .select('id,auth_id,email,name,role,status,created_at')
        .in('role', ['partner', 'owner', 'brand'])
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('brands')
        .select('id,name,status,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(200),
    ])
    if (usersRes.error) return NextResponse.json({ ok: false, error: usersRes.error.message }, { status: 500 })
    if (brandsRes.error) return NextResponse.json({ ok: false, error: brandsRes.error.message }, { status: 500 })
    const rows = [
      ...(usersRes.data || []).map((r: any) => ({ type: 'user', ...r })),
      ...(brandsRes.data || []).map((r: any) => ({ type: 'brand', ...r })),
    ]
    return NextResponse.json({ ok: true, rows, via: 'session' })
  }

  const [usersRes, brandsRes] = await Promise.all([
    svc
      .from('users')
      .select('id,auth_id,email,name,role,status,created_at')
      .in('role', ['partner', 'owner', 'brand'])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200),
    svc
      .from('brands')
      .select('id,name,status,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (usersRes.error) return NextResponse.json({ ok: false, error: usersRes.error.message }, { status: 500 })
  if (brandsRes.error) return NextResponse.json({ ok: false, error: brandsRes.error.message }, { status: 500 })

  const rows = [
    ...(usersRes.data || []).map((r: any) => ({ type: 'user', ...r })),
    ...(brandsRes.data || []).map((r: any) => ({ type: 'brand', ...r })),
  ]

  return NextResponse.json({ ok: true, rows })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminViaService()
  if (!admin.ok) return NextResponse.json({ ok: false, reason: 'not_admin' }, { status: admin.status })

  const body = await req.json().catch(() => ({}))
  const type = typeof body?.type === 'string' ? body.type : 'user'

  const svc = tryCreateServiceClient()
  if (!svc) {
    // fallback: use normal session client (admin RLS permitting)
    const supabase = createClient()
    if (type === 'user') {
      const authId = typeof body?.auth_id === 'string' ? body.auth_id : ''
      if (!authId) return NextResponse.json({ ok: false, error: 'missing_auth_id' }, { status: 400 })
      const { data: updated, error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('auth_id', authId)
        .in('role', ['partner', 'owner', 'brand'])
        .select('auth_id,role,status')
        .maybeSingle()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      if (!updated) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
      return NextResponse.json({ ok: true, updated, via: 'session' })
    }
    if (type === 'brand') {
      const id = typeof body?.id === 'string' ? body.id : ''
      if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })
      const { data: updated, error } = await supabase
        .from('brands')
        .update({ status: 'active' })
        .eq('id', id)
        .select('id,status')
        .maybeSingle()
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      if (!updated) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
      return NextResponse.json({ ok: true, updated, via: 'session' })
    }
    return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
  }

  // 계정 승인: users.status = active
  if (type === 'user') {
    const authId = typeof body?.auth_id === 'string' ? body.auth_id : ''
    if (!authId) return NextResponse.json({ ok: false, error: 'missing_auth_id' }, { status: 400 })

    const { data: updated, error } = await svc
      .from('users')
      .update({ status: 'active' })
      .eq('auth_id', authId)
      .in('role', ['partner', 'owner', 'brand'])
      .select('auth_id,role,status')
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!updated) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, updated })
  }

  // 입점 승인: brands.status = active
  if (type === 'brand') {
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ ok: false, error: 'missing_id' }, { status: 400 })

    const { data: updated, error } = await svc
      .from('brands')
      .update({ status: 'active' })
      .eq('id', id)
      .select('id,status')
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!updated) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true, updated })
  }

  return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
}

