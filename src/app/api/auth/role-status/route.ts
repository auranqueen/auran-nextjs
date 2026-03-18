import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'not_logged_in' }, { status: 401 })

  const svc = createServiceClient()

  const { data: u } = await svc
    .from('users')
    .select('role,status')
    .eq('auth_id', user.id)
    .maybeSingle()

  const role = (u as any)?.role || null
  const status = (u as any)?.status || null

  return NextResponse.json({ ok: true, role, status })
}

