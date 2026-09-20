import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

const ZERO = { total: 0, joined: 0, pct: 0 }

function json(body: { total: number; joined: number; pct: number }, status = 200) {
  return NextResponse.json(body, { status })
}

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json(ZERO, 401)

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle()

  if ((me as { role?: string } | null)?.role !== 'admin' && (me as { role?: string } | null)?.role !== 'super_admin') {
    return json(ZERO, 401)
  }

  const svc = tryCreateAdminClient()
  if (!svc) return json(ZERO)

  try {
    const { count: totalCount, error: totalErr } = await svc
      .from('external_customers')
      .select('id', { count: 'exact', head: true })
    if (totalErr) return json(ZERO)

    const { count: joinedCount, error: joinedErr } = await svc
      .from('external_customers')
      .select('id', { count: 'exact', head: true })
      .eq('auran_joined', true)
      .not('auran_user_id', 'is', null)
    if (joinedErr) return json(ZERO)

    const total = totalCount ?? 0
    const joined = joinedCount ?? 0
    const pct = total > 0 ? Math.round((joined / total) * 100) : 0
    return json({ total, joined, pct })
  } catch {
    return json(ZERO)
  }
}
