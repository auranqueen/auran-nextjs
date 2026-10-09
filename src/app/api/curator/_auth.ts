import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

/** 큐레이터 전용 API 공통 인증 — 실패 시 { res }, 성공 시 서비스롤 클라이언트와 auth uid */
export async function requireCurator() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { res: NextResponse.json({ error: 'not_logged_in' }, { status: 401 }) }

  const svc = tryCreateAdminClient()
  if (!svc) return { res: NextResponse.json({ error: 'service_unavailable' }, { status: 500 }) }

  const [{ data: pr }, { data: ur }] = await Promise.all([
    svc.from('profiles').select('active_role, role').eq('auth_id', user.id).maybeSingle(),
    svc.from('users').select('role').eq('auth_id', user.id).maybeSingle(),
  ])
  const p = pr as unknown as { active_role?: string | null; role?: string | null } | null
  const u = ur as unknown as { role?: string | null } | null
  const role = String(p?.active_role || p?.role || u?.role || '')
  if (role !== 'curator') return { res: NextResponse.json({ error: 'curator_only' }, { status: 403 }) }

  return { svc, userId: user.id }
}
