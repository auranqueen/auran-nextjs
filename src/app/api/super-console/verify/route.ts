import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  // current session user (cookie-based)
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })

  // Use service role to bypass any RLS for role lookup
  const svc = createServiceClient()

  // Prefer users.role; fallback to profiles.role
  const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  const role = (u as any)?.role || null
  if (role === 'admin') return NextResponse.json({ ok: true, role: 'admin' })

  const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  const pRole = (p as any)?.role || null
  if (pRole === 'admin') return NextResponse.json({ ok: true, role: 'admin' })

  return NextResponse.json({ ok: false, role: role || pRole || null, reason: 'not_admin' }, { status: 403 })
}

