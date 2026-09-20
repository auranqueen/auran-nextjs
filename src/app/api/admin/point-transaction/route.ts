import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { user_id, amount, reason } = await request.json()
  if (!user_id || typeof amount !== 'number' || amount <= 0) return NextResponse.json({ error: 'INVALID_PARAMS' }, { status: 400 })
  const { data: target } = await supabase.from('users').select('id, points').eq('id', user_id).single()
  if (!target) return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 })
  const nextBalance = Number(target.points || 0) + amount
  const now = new Date().toISOString()
  const [h, upd] = await Promise.all([
    supabase.from('point_history').insert({
      user_id,
      type: 'admin',
      amount,
      balance: nextBalance,
      description: reason || '관리자 수동 지급',
      created_at: now,
    }),
    supabase.from('users').update({ points: nextBalance }).eq('id', user_id),
  ])
  if (h.error) return NextResponse.json({ error: 'DB_ERROR', message: h.error.message }, { status: 500 })
  if (upd.error) return NextResponse.json({ error: 'DB_ERROR', message: upd.error.message }, { status: 500 })
  return NextResponse.json({ success: true, balance_after: nextBalance })
}
