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
    return NextResponse.json({ ok: true, items: [], areteCompanyIds: [] })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: items, error } = await db
    .from('brand_archive_items')
    .select('*')
    .in('company_id', companyIds)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const { data: profile } = await db.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  let areteCompanyIds: string[] = []
  if (profile?.id) {
    const { data: areteRows } = await db
      .from('brand_arete_members')
      .select('company_id')
      .eq('owner_id', profile.id)
      .eq('status', 'active')
    areteCompanyIds = (areteRows || [])
      .map((r: { company_id: string }) => String(r.company_id))
      .filter(Boolean)
  }

  return NextResponse.json({ ok: true, items: items || [], areteCompanyIds })
}