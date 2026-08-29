import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { getOwnerCompanyIds } from '@/lib/brand/getOwnerCompanyIds'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }

  const companyIds = await getOwnerCompanyIds(supabase, user.id)
  if (companyIds.length === 0) {
    return NextResponse.json({ ok: true, sessions: [] })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: sessions, error } = await db
    .from('education_sessions')
    .select('*')
    .in('company_id', companyIds)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const list = sessions || []
  const sessionIds = list.map((s: { id: string }) => s.id)
  const appliedSet = new Set<string>()

  if (sessionIds.length > 0) {
    const { data: apps } = await db
      .from('education_applications')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('owner_id', me.id)
      .eq('status', 'applied')

    for (const a of apps || []) {
      appliedSet.add(String((a as { session_id: string }).session_id))
    }
  }

  const rows = list.map((s: Record<string, unknown>) => {
    const applied = appliedSet.has(String(s.id))
    const { link, ...rest } = s
    if (applied) {
      return { ...rest, link, applied: true }
    }
    return { ...rest, applied: false }
  })

  return NextResponse.json({ ok: true, sessions: rows })
}