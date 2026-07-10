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

export async function POST(req: NextRequest) {
  const admin = await requireAdminViaService()
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: 'not_admin' }, { status: admin.status })
  }

  const body = await req.json().catch(() => ({}))
  const salonId = typeof body?.salon_id === 'string' ? body.salon_id.trim() : ''
  const action = body?.action === 'approve' || body?.action === 'reject' ? body.action : null

  if (!salonId) {
    return NextResponse.json({ ok: false, error: 'missing_salon_id' }, { status: 400 })
  }
  if (!action) {
    return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    return NextResponse.json(
      { ok: false, error: 'service_client_unavailable', stage: 'service_client' },
      { status: 500 }
    )
  }

  const { data: salon, error: salonFetchError } = await svc
    .from('salons')
    .select('id,owner_id,status')
    .eq('id', salonId)
    .maybeSingle()

  if (salonFetchError) {
    return NextResponse.json(
      { ok: false, error: salonFetchError.message, stage: 'salon_fetch' },
      { status: 500 }
    )
  }
  if (!salon) {
    return NextResponse.json({ ok: false, error: 'salon_not_found', stage: 'salon_fetch' }, { status: 404 })
  }

  if (action === 'reject') {
    const { data: updated, error } = await svc
      .from('salons')
      .update({ status: 'rejected' })
      .eq('id', salonId)
      .select('id,status')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message, stage: 'salons' }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'salon_not_found', stage: 'salons' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  }

  const ownerId = (salon as { owner_id?: string | null }).owner_id
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: 'missing_owner_id', stage: 'owner_id' }, { status: 400 })
  }

  const { data: updatedUser, error: userError } = await svc
    .from('users')
    .update({ status: 'active', role: 'owner' })
    .eq('id', ownerId)
    .select('id,role,status')
    .maybeSingle()

  if (userError) {
    return NextResponse.json({ ok: false, error: userError.message, stage: 'users' }, { status: 500 })
  }
  if (!updatedUser) {
    return NextResponse.json({ ok: false, error: 'owner_not_found', stage: 'users' }, { status: 404 })
  }

  const { data: updatedSalon, error: salonError } = await svc
    .from('salons')
    .update({ status: 'active' })
    .eq('id', salonId)
    .select('id,status')
    .maybeSingle()

  if (salonError) {
    return NextResponse.json(
      { ok: false, error: salonError.message, stage: 'salons' },
      { status: 500 }
    )
  }
  if (!updatedSalon) {
    return NextResponse.json({ ok: false, error: 'salon_not_found', stage: 'salons' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
