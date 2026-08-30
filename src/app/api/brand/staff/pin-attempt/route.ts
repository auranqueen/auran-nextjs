import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

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
    .limit(1)
  return { allowed: Boolean(owned && owned.length > 0) }
}

function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t).trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function nowMinutesKst(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value || 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value || 0)
  return h * 60 + m
}

function formatKstClock(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date())
}

function isWithinWorkHours(start: string | null, end: string | null): boolean {
  const startM = parseTimeToMinutes(start)
  const endM = parseTimeToMinutes(end)
  if (startM == null || endM == null) return true
  const now = nowMinutesKst()
  if (startM <= endM) return now >= startM && now <= endM
  return now >= startM || now <= endM
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  let body: { company_id?: string; staff_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const companyId = String(body.company_id || '').trim()
  const staffId = String(body.staff_id || '').trim()
  if (!companyId || !staffId) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const { allowed } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  const admin = tryCreateAdminClient()
  const db = admin ?? supabase

  const { data: staff, error: staffErr } = await db
    .from('brand_staff')
    .select('id, name, company_id, is_active')
    .eq('id', staffId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (staffErr || !staff) {
    return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 })
  }

  const { data: company } = await db
    .from('brand_companies')
    .select('work_hours_start, work_hours_end')
    .eq('id', companyId)
    .maybeSingle()

  const start = (company as { work_hours_start?: string | null } | null)?.work_hours_start ?? null
  const end = (company as { work_hours_end?: string | null } | null)?.work_hours_end ?? null

  if (isWithinWorkHours(start, end)) {
    return NextResponse.json({ ok: true })
  }

  const staffName = String((staff as { name?: string }).name || '직원')
  const message = `${staffName}님이 근무시간 외 접속을 시도했어요 (${formatKstClock()})`

  await db.from('brand_admin_alerts').insert({
    company_id: companyId,
    staff_id: staffId,
    type: 'after_hours_login',
    message,
  })

  return NextResponse.json({
    ok: false,
    error: 'after_hours',
    work_hours_start: start,
    work_hours_end: end,
  })
}
