import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const role = typeof body?.role === 'string' ? body.role : 'partner'
  const normalizedRole = role === 'salon' ? 'owner' : role
  if (!['partner', 'owner', 'brand'].includes(normalizedRole)) {
    return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    // fallback: at minimum mark my own users row as pending via session client (RLS permitting)
    const { data: myRow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!myRow?.id) return NextResponse.json({ ok: false, error: 'user_row_missing' }, { status: 404 })
    const { error } = await supabase.from('users').update({ role: normalizedRole, status: 'pending' }).eq('id', myRow.id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, via: 'session' })
  }

  // get public.users row
  const { data: u } = await svc.from('users').select('id,auth_id,email,name,role,status').eq('auth_id', user.id).maybeSingle()
  if (!u?.id) return NextResponse.json({ ok: false, error: 'user_row_missing' }, { status: 404 })

  // ensure role/status pending
  await svc
    .from('users')
    .update({ role: normalizedRole, status: 'pending' })
    .eq('id', u.id)

  // owner: create salon application if none
  if (normalizedRole === 'owner') {
    const { data: existingSalon } = await svc.from('salons').select('id,status').eq('owner_id', u.id).maybeSingle()
    if (!existingSalon?.id) {
      await svc.from('salons').insert({
        owner_id: u.id,
        name: (u as any)?.salon_name || `${u.name || '원장'} 살롱`,
        status: 'pending',
      })
    } else if (existingSalon.status !== 'pending' && existingSalon.status !== 'active') {
      await svc.from('salons').update({ status: 'pending' }).eq('id', existingSalon.id)
    }
  }

  // brand: create brand application if none
  if (normalizedRole === 'brand') {
    const { data: existingBrand } = await svc.from('brands').select('id,status').eq('user_id', u.id).maybeSingle()
    if (!existingBrand?.id) {
      await svc.from('brands').insert({
        user_id: u.id,
        name: (u as any)?.brand_name || u.name || '브랜드',
        origin: (u as any)?.brand_origin || null,
        status: 'pending',
      })
    } else if (existingBrand.status !== 'pending' && existingBrand.status !== 'active') {
      await svc.from('brands').update({ status: 'pending' }).eq('id', existingBrand.id)
    }
  }

  return NextResponse.json({ ok: true })
}

