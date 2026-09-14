import { timingSafeEqual, randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

const SESSION_MS = 30 * 60 * 1000
const MAX_FAILS = 3
const PIN_REGEX = /^\d{4,8}$/
const ROLE_LABEL: Record<string, string> = {
  ceo: '대표',
  director: '이사',
  manager: '과장',
  staff: '담당자',
  ops_manager: '물류팀장',
  ops_staff: '물류직원',
}

type StaffPinRow = {
  id: string
  name: string
  role: string
  pin: string | null
  is_active: boolean
  company_id: string
}

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

function pinsEqual(input: string, stored: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(stored)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function failTokenFor(staffId: string) {
  return `fail:${staffId}`
}

function roleLabel(role: string) {
  return ROLE_LABEL[role] || role
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  let body: {
    company_id?: string
    brand_id?: string
    staff_id?: string
    staff_name?: string
    pin?: string
    purpose?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
  if (!PIN_REGEX.test(pin)) {
    return NextResponse.json({ ok: false, error: 'invalid_pin' }, { status: 400 })
  }

  const purpose = body.purpose === 'emergency' ? 'emergency' : 'login'
  let companyId = String(body.company_id || '').trim()
  let brandId = String(body.brand_id || '').trim()
  const staffIdIn = String(body.staff_id || '').trim()
  const staffNameIn = String(body.staff_name || '').trim()

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'brand') {
    return NextResponse.json({ ok: false, error: 'brand_only' }, { status: 403 })
  }

  const admin = tryCreateAdminClient()
  const db = admin ?? supabase

  if (!companyId && brandId) {
    const { data: brandRow } = await db
      .from('brands')
      .select('id, company_id')
      .eq('id', brandId)
      .maybeSingle()
    companyId = brandRow?.company_id ? String(brandRow.company_id) : ''
    if (!brandId && brandRow?.id) brandId = String(brandRow.id)
  }
  if (!brandId && companyId) {
    const { data: hubBrand } = await db.from('brands').select('id').eq('company_id', companyId).limit(1).maybeSingle()
    brandId = hubBrand?.id ? String(hubBrand.id) : ''
  }
  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  const { allowed } = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden_company' }, { status: 403 })
  }

  let staff: StaffPinRow | null = null
  if (staffIdIn) {
    const { data, error } = await db
      .from('brand_staff')
      // 서비스롤 조회 컬럼: id, name, role, pin, is_active, company_id — 응답 JSON에는 pin 미포함
      .select('id, name, role, pin, is_active, company_id')
      .eq('id', staffIdIn)
      .eq('company_id', companyId)
      .maybeSingle()
    if (error || !data?.id) {
      return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 })
    }
    staff = data as StaffPinRow
  } else if (staffNameIn) {
    const { data: named } = await db
      .from('brand_staff')
      // 서비스롤 조회 컬럼: id, name, role, pin, is_active, company_id — 응답 JSON에는 pin 미포함
      .select('id, name, role, pin, is_active, company_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('name', staffNameIn)
    const rows = (named || []) as StaffPinRow[]
    staff = rows.find((s) => s.pin && pinsEqual(pin, String(s.pin))) || rows[0] || null
    if (!staff) {
      return NextResponse.json({ ok: false, error: 'pin_mismatch', fail_count: 1 }, { status: 401 })
    }
  } else {
    return NextResponse.json({ ok: false, error: 'missing_params' }, { status: 400 })
  }

  if (!staff.is_active) {
    return NextResponse.json({ ok: false, error: 'staff_inactive' }, { status: 403 })
  }

  const failToken = failTokenFor(staff.id)
  const nowIso = new Date().toISOString()
  const { data: failRow } = await db
    .from('brand_pin_sessions')
    .select('id, pin_fail_count, is_locked, expires_at')
    .eq('session_token', failToken)
    .maybeSingle()

  const failExpires = failRow?.expires_at ? new Date(String(failRow.expires_at)).getTime() : 0
  const lockActive = Boolean(failRow?.is_locked) && failExpires > Date.now()
  if (lockActive) {
    return NextResponse.json(
      { ok: false, error: 'locked', fail_count: MAX_FAILS, locked: true },
      { status: 401 },
    )
  }

  const storedPin = staff.pin != null ? String(staff.pin) : ''
  if (!storedPin || !pinsEqual(pin, storedPin)) {
    const prev = failExpires > Date.now() ? Number(failRow?.pin_fail_count || 0) : 0
    const next = prev + 1
    const locked = next >= MAX_FAILS
    const expiresAt = new Date(Date.now() + SESSION_MS).toISOString()
    if (failRow?.id) {
      await db
        .from('brand_pin_sessions')
        .update({ pin_fail_count: next, is_locked: locked, expires_at: expiresAt })
        .eq('id', failRow.id)
    } else if (brandId) {
      await db.from('brand_pin_sessions').insert({
        brand_id: brandId,
        staff_id: staff.id,
        session_token: failToken,
        pin_fail_count: next,
        is_locked: locked,
        expires_at: expiresAt,
      })
    }
    if (locked && brandId) {
      await db.from('brand_access_logs').insert({
        brand_id: brandId,
        staff_id: staff.id,
        staff_name: staff.name,
        action_type: 'pin_fail_locked',
        module: 'auth',
        target_desc: `PIN 3회 오류 잠금 — ${staff.name} ${roleLabel(staff.role)}`,
      })
      await db.from('brand_messages').insert({
        brand_id: brandId,
        message_type: 'auto_order',
        target_type: 'all',
        title: '🔒 PIN 잠금 발생',
        body: `${staff.name} ${roleLabel(staff.role)}의 PIN이 3회 오류로 잠겼습니다. 확인이 필요합니다.`,
        send_count: 1,
      })
    }
    return NextResponse.json(
      {
        ok: false,
        error: locked ? 'locked' : 'pin_mismatch',
        fail_count: next,
        locked,
      },
      { status: 401 },
    )
  }

  if (purpose === 'login') {
    const { data: company } = await db
      .from('brand_companies')
      .select('work_hours_start, work_hours_end')
      .eq('id', companyId)
      .maybeSingle()
    const start = (company as { work_hours_start?: string | null } | null)?.work_hours_start ?? null
    const end = (company as { work_hours_end?: string | null } | null)?.work_hours_end ?? null
    if (!isWithinWorkHours(start, end)) {
      await db.from('brand_admin_alerts').insert({
        company_id: companyId,
        staff_id: staff.id,
        type: 'after_hours_login',
        message: `${staff.name}님이 근무시간 외 접속을 시도했어요 (${formatKstClock()})`,
      })
      return NextResponse.json(
        {
          ok: false,
          error: 'after_hours',
          work_hours_start: start,
          work_hours_end: end,
        },
        { status: 403 },
      )
    }
  }

  if (failRow?.id) {
    await db
      .from('brand_pin_sessions')
      .update({ pin_fail_count: 0, is_locked: false, expires_at: nowIso })
      .eq('id', failRow.id)
  }

  let sessionToken: string | null = null
  if (purpose === 'login' && brandId) {
    sessionToken = randomUUID()
    const expiresAt = new Date(Date.now() + SESSION_MS).toISOString()
    const { error: sessErr } = await db.from('brand_pin_sessions').insert({
      brand_id: brandId,
      staff_id: staff.id,
      session_token: sessionToken,
      pin_fail_count: 0,
      is_locked: false,
      expires_at: expiresAt,
    })
    if (sessErr || !sessionToken) {
      return NextResponse.json({ ok: false, error: 'session_create_failed' }, { status: 500 })
    }
    await db.from('brand_access_logs').insert({
      brand_id: brandId,
      staff_id: staff.id,
      staff_name: staff.name,
      action_type: 'login',
      module: 'auth',
      target_desc: `PIN 인증 성공 — ${staff.name} ${roleLabel(staff.role)}`,
    })
  }

  return NextResponse.json({
    ok: true,
    session_token: sessionToken,
    staff: { id: staff.id, name: staff.name, role: staff.role },
  })
}
