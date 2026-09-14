import { NextRequest, NextResponse } from 'next/server'
import type { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

type SupabaseServer = ReturnType<typeof createClient>

export type PinSessionOk = {
  ok: true
  staffId: string | null
  staffCompanyId: string | null
  userPk: string
  userRole: string
  skipped: boolean
}

export type PinSessionFail = {
  ok: false
  error: string
  status: number
}

export type PinSessionResult = PinSessionOk | PinSessionFail

export type VerifyPinSessionOpts = {
  companyId?: string | null
  brandId?: string | null
  /** admin 역할은 PIN 세션 없이 통과. 기본 false */
  allowAdmin?: boolean
}

export function pinSessionError(result: PinSessionFail) {
  return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
}

/** 쓰기 API용. 통과면 null, 실패면 그대로 return 할 NextResponse */
export async function pinSessionDenied(
  req: NextRequest,
  supabase: SupabaseServer,
  opts?: VerifyPinSessionOpts,
): Promise<NextResponse | null> {
  const pin = await verifyPinSession(req, supabase, opts)
  return pin.ok ? null : pinSessionError(pin)
}

function readPinToken(req: NextRequest): string | null {
  const header = req.headers.get('x-brand-pin-token')?.trim()
  if (header) return header
  const auth = req.headers.get('authorization')?.trim() || ''
  if (auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim()
    if (t) return t
  }
  return null
}

export async function verifyPinSession(
  req: NextRequest,
  supabase: SupabaseServer,
  opts?: VerifyPinSessionOpts,
): Promise<PinSessionResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_logged_in', status: 401 }

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!me?.id) return { ok: false, error: 'user_missing', status: 400 }

  if (opts?.allowAdmin && me.role === 'admin') {
    return {
      ok: true,
      staffId: null,
      staffCompanyId: null,
      userPk: String(me.id),
      userRole: 'admin',
      skipped: true,
    }
  }

  const token = readPinToken(req)
  if (!token) return { ok: false, error: 'pin_session_required', status: 401 }
  if (token.startsWith('fail:')) return { ok: false, error: 'pin_session_invalid', status: 401 }

  // Rule 2 — service-role lookup columns (PIN 컬럼 없음)
  // brand_pin_sessions: id, brand_id, staff_id, session_token, expires_at, is_locked
  // brand_staff: id, role, is_active, company_id
  // brands: id, company_id (스코프 확인용)
  const db = tryCreateAdminClient() ?? supabase

  const { data: session } = await db
    .from('brand_pin_sessions')
    .select('id, brand_id, staff_id, session_token, expires_at, is_locked')
    .eq('session_token', token)
    .maybeSingle()

  if (!session?.id || !session.staff_id) {
    return { ok: false, error: 'pin_session_invalid', status: 401 }
  }
  if (session.is_locked) {
    return { ok: false, error: 'pin_session_locked', status: 401 }
  }
  const expiresAt = session.expires_at ? new Date(String(session.expires_at)).getTime() : 0
  if (!expiresAt || expiresAt <= Date.now()) {
    return { ok: false, error: 'pin_session_expired', status: 401 }
  }

  const { data: staff } = await db
    .from('brand_staff')
    .select('id, role, is_active, company_id')
    .eq('id', session.staff_id)
    .maybeSingle()

  if (!staff?.id || !staff.is_active) {
    return { ok: false, error: 'pin_session_staff_inactive', status: 403 }
  }

  let companyId = typeof opts?.companyId === 'string' ? opts.companyId.trim() : ''
  const brandId = typeof opts?.brandId === 'string' ? opts.brandId.trim() : ''
  if (brandId) {
    const { data: brand } = await db
      .from('brands')
      .select('id, company_id')
      .eq('id', brandId)
      .maybeSingle()
    if (!brand?.id) return { ok: false, error: 'brand_not_found', status: 404 }
    const brandCompany = brand.company_id ? String(brand.company_id) : ''
    if (companyId && brandCompany && companyId !== brandCompany) {
      return { ok: false, error: 'pin_session_company_mismatch', status: 403 }
    }
    if (!companyId) companyId = brandCompany
  }

  const staffCompanyId = staff.company_id ? String(staff.company_id) : ''
  if (companyId && staffCompanyId !== companyId) {
    return { ok: false, error: 'pin_session_company_mismatch', status: 403 }
  }

  return {
    ok: true,
    staffId: String(staff.id),
    staffCompanyId,
    userPk: String(me.id),
    userRole: String(me.role || ''),
    skipped: false,
  }
}
