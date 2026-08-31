import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { assertStaffPermission } from '@/lib/brand/assertStaffPermission'
import { applyPointsDelta, type PointsTrack } from '@/lib/points/applyPointsDelta'

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

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const staffId = typeof body?.staff_id === 'string' ? body.staff_id.trim() : ''
  const ownerId = typeof body?.owner_id === 'string' ? body.owner_id.trim() : ''
  const track = typeof body?.track === 'string' ? body.track.trim() : ''
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const amount = Math.trunc(Number(body?.amount) || 0)

  if (!companyId || !ownerId || !track) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ ok: false, error: 'reason_required' }, { status: 400 })
  }
  if (!amount) {
    return NextResponse.json({ ok: false, error: 'amount_required' }, { status: 400 })
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

  const staffAllowed = await assertStaffPermission(supabase, staffId || null, companyId, 'report_view')
  if (!staffAllowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_staff' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const result = await applyPointsDelta(svc, {
    companyId,
    ownerId,
    track: track as PointsTrack,
    amount,
    reason,
    sourceType: 'manual',
    staffId: staffId || null,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || 'adjust_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, balance_after: result.balanceAfter })
}
