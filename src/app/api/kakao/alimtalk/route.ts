import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { sendAlimtalkSms } from '@/lib/aligo/sendAlimtalk'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

async function requireAdminApi() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, user: null as any }

  const svc = tryCreateServiceClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role').eq('auth_id', user.id).maybeSingle()
    if ((u as any)?.role === 'admin') return { ok: true as const, status: 200, user }
    const { data: p } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
    if ((p as any)?.role === 'admin') return { ok: true as const, status: 200, user }
  } else {
    if (user.email === 'admin@auran.kr') return { ok: true as const, status: 200, user }
  }

  return { ok: false as const, status: 403, user }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi()
  if (!auth.ok) return json({ ok: false, reason: auth.status === 401 ? 'not_logged_in' : 'forbidden' }, auth.status)

  const body = await req.json().catch(() => ({}))
  const phone = typeof body?.phone === 'string' ? body.phone.replace(/\D/g, '') : ''
  const message = typeof body?.message === 'string' ? body.message : ''
  const title = typeof body?.title === 'string' ? body.title : 'AURAN 테스트'
  if (!phone || phone.length < 10) return json({ ok: false, error: 'invalid_phone' }, 400)
  if (!message.trim()) return json({ ok: false, error: 'message_required' }, 400)

  const { data: onRow } = await (tryCreateServiceClient() || createClient())
    .from('admin_settings')
    .select('value')
    .eq('category', 'alimtalk')
    .eq('key', 'enabled')
    .maybeSingle()
  if (Number(onRow?.value ?? 1) !== 1) return json({ ok: false, error: 'alimtalk_disabled' }, 400)

  const r = await sendAlimtalkSms({ phone, message, title })
  return json({ ok: r.ok, skipped: r.skipped, raw: r.raw })
}
