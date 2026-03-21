import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

/** 이름/이메일로 고객 회원 검색 (선물 수신자 선택용, 서비스 롤) */
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, error: 'not_logged_in' }, 401)

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (q.length < 2) return json({ ok: true, users: [] })

  const svc = tryCreateServiceClient()
  if (!svc) return json({ ok: false, error: 'service_unavailable' }, 503)

  const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!me?.id) return json({ ok: false, error: 'profile_missing' }, 400)

  const safe = q.replace(/[%_,]/g, ' ').trim().slice(0, 80)
  if (safe.length < 2) return json({ ok: true, users: [] })

  const pattern = `%${safe}%`

  const [{ data: byName, error: e1 }, { data: byEmail, error: e2 }] = await Promise.all([
    svc.from('users').select('id,name,email').eq('role', 'customer').neq('id', me.id).ilike('name', pattern).limit(15),
    svc.from('users').select('id,name,email').eq('role', 'customer').neq('id', me.id).ilike('email', pattern).limit(15),
  ])

  if (e1 || e2) return json({ ok: false, error: e1?.message || e2?.message || 'search_failed' }, 500)

  const map = new Map<string, { id: string; name: string; email: string }>()
  for (const r of [...(byName || []), ...(byEmail || [])]) {
    if (r?.id) map.set(String(r.id), r as { id: string; name: string; email: string })
  }

  return json({ ok: true, users: Array.from(map.values()).slice(0, 20) })
}
