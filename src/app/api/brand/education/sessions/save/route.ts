import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { assertStaffPermissionFromSession } from '@/lib/brand/assertStaffPermission'
import { pinSessionError, verifyPinSession } from '@/lib/brand/verifyPinSession'

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

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const sessionDate = typeof body?.session_date === 'string' ? body.session_date.trim() : ''
  const startTime = typeof body?.start_time === 'string' ? body.start_time.trim() : ''
  const endTime = typeof body?.end_time === 'string' ? body.end_time.trim() : ''
  const format = typeof body?.format === 'string' ? body.format.trim() : ''
  const location = typeof body?.location === 'string' ? body.location.trim() : null
  let link = typeof body?.link === 'string' ? body.link.trim() : null
  const capacity =
    body?.capacity != null && body.capacity !== '' ? Math.trunc(Number(body.capacity)) : null
  const assetUrl =
    typeof body?.asset_url === 'string' && body.asset_url.trim() ? body.asset_url.trim() : null

  if (!companyId) return NextResponse.json({ ok: false, error: 'missing_company' }, { status: 400 })
  if (!title) return NextResponse.json({ ok: false, error: 'title_required' }, { status: 400 })
  if (!sessionDate) return NextResponse.json({ ok: false, error: 'session_date_required' }, { status: 400 })
  if (!startTime || !endTime) {
    return NextResponse.json({ ok: false, error: 'times_required' }, { status: 400 })
  }
  if (!['online', 'offline'].includes(format)) {
    return NextResponse.json({ ok: false, error: 'invalid_format' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const { allowed } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const pin = await verifyPinSession(req, supabase, { companyId })
  if (!pin.ok) return pinSessionError(pin)
  const staffAllowed = await assertStaffPermissionFromSession(supabase, pin, companyId, 'education_manage')
  if (!staffAllowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_permission' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  if (format === 'online') {
    const { data: zoomRow } = await db
      .from('company_integrations')
      .select('id')
      .eq('company_id', companyId)
      .eq('provider', 'zoom')
      .eq('is_active', true)
      .maybeSingle()
    if (zoomRow?.id) {
      // TODO: Zoom API meeting create -> replace link
    }
  }

  const { data: session, error } = await db
    .from('education_sessions')
    .insert({
      company_id: companyId,
      title,
      session_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      format,
      location: location || null,
      link: link || null,
      capacity: capacity != null && Number.isFinite(capacity) ? capacity : null,
      asset_url: assetUrl,
    })
    .select('*')
    .single()

  if (error || !session) {
    return NextResponse.json({ ok: false, error: error?.message || 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, session })
}