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
  if (brandIds.length === 0) return { allowed: false }
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return { allowed: true }
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .maybeSingle()
  return { allowed: Boolean(owned?.id) }
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const companyId = (req.nextUrl.searchParams.get('company_id') || '').trim()
  const ownerId = (req.nextUrl.searchParams.get('owner_id') || '').trim()
  const track = (req.nextUrl.searchParams.get('track') || '').trim()

  if (!companyId || !ownerId || !track) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }
  if (!['REWARD', 'ARETE'].includes(track)) {
    return NextResponse.json({ ok: false, error: 'invalid_track' }, { status: 400 })
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

  const [{ data: rows, error }, { data: pointRow }] = await Promise.all([
    db
      .from('brand_points_ledger')
      .select('id, company_id, owner_id, track, amount, balance_after, reason, source_type, created_by_staff_id, created_at')
      .eq('company_id', companyId)
      .eq('owner_id', ownerId)
      .eq('track', track)
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('brand_points')
      .select('balance')
      .eq('company_id', companyId)
      .eq('owner_id', ownerId)
      .eq('track', track)
      .maybeSingle(),
  ])

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    balance: Math.trunc(Number((pointRow as { balance?: number } | null)?.balance) || 0),
    rows: rows || [],
  })
}
