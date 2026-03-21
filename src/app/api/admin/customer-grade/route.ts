/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { isValidCustomerGrade } from '@/lib/customerGrade'

function json(data: any, status = 200) {
  return NextResponse.json(data, { status })
}

async function requireAdminApi() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, supabase, user: null as any }

  const svc = tryCreateServiceClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
    if ((u as any)?.role === 'admin') return { ok: true as const, status: 200, supabase: svc, user }
    const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
    if ((p as any)?.role === 'admin') return { ok: true as const, status: 200, supabase: svc, user }
  } else {
    if (user.email === 'admin@auran.kr') return { ok: true as const, status: 200, supabase, user }
  }

  return { ok: false as const, status: 403, supabase, user }
}

/** 어드민: 고객(users) 등급 변경 — 서비스 롤 */
export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)

  const body = await req.json().catch(() => ({}))
  const user_id = typeof body?.user_id === 'string' ? body.user_id.trim() : ''
  const customer_grade = typeof body?.customer_grade === 'string' ? body.customer_grade.trim() : ''

  if (!user_id) return json({ ok: false, error: 'user_id_required' }, 400)
  if (!isValidCustomerGrade(customer_grade)) return json({ ok: false, error: 'invalid_grade' }, 400)

  const svc = tryCreateServiceClient()
  if (!svc) {
    return json(
      {
        ok: false,
        error: 'service_role_unconfigured',
        message: 'SUPABASE_SERVICE_ROLE_KEY가 필요합니다.',
      },
      503
    )
  }

  const { data: row, error: findErr } = await svc
    .from('users')
    .select('id,role')
    .eq('id', user_id)
    .maybeSingle()

  if (findErr || !row) return json({ ok: false, error: 'user_not_found' }, 400)
  if ((row as any).role !== 'customer') return json({ ok: false, error: 'not_customer' }, 400)

  const { error: upErr } = await svc.from('users').update({ customer_grade } as any).eq('id', user_id)
  if (upErr) return json({ ok: false, error: upErr.message }, 500)

  return json({ ok: true })
}
