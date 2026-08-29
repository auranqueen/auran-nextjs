import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

async function assertCompanyAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  companyId: string,
) {
  const { data: companyBrands } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
  const brandIds = (companyBrands || []).map((b: { id: string }) => b.id)
  if (brandIds.length === 0) return { allowed: false, brandIds: [] as string[] }
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return { allowed: true, brandIds }
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return { allowed: Boolean(owned?.id), brandIds }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const companyId = (req.nextUrl.searchParams.get('company_id') || '').trim()
  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'missing_company' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const { allowed } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: sessions, error } = await db
    .from('education_sessions')
    .select('*')
    .eq('company_id', companyId)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  const list = sessions || []
  const sessionIds = list.map((s: { id: string }) => s.id)
  const countMap: Record<string, number> = {}

  if (sessionIds.length > 0) {
    const { data: apps } = await db
      .from('education_applications')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('status', 'applied')

    for (const a of apps || []) {
      const sid = String((a as { session_id: string }).session_id)
      countMap[sid] = (countMap[sid] || 0) + 1
    }
  }

  const rows = list.map((s: Record<string, unknown>) => ({
    ...s,
    applied_count: countMap[String(s.id)] || 0,
  }))

  return NextResponse.json({ ok: true, sessions: rows })
}