import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { data, error } = await supabase
    .from('users')
    .select('id, points')
    .eq('auth_id', user.id)
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  const monthStart = today.slice(0, 7) + '-01'

  const { data: monthToast, error: toastErr } = await supabase
    .from('toast_transactions')
    .select('amount')
    .eq('user_id', data.id)
    .eq('source_type', 'attendance')
    .gte('created_at', monthStart)

  if (toastErr) {
    return NextResponse.json({ ok: false, error: toastErr.message }, { status: 500 })
  }

  const rows = monthToast || []
  const attendanceCount = rows.length
  const attendanceTotal = rows.reduce((s: number, t: { amount?: number | null }) => s + (Number(t.amount) || 0), 0)

  return NextResponse.json({
    ok: true,
    points: data?.points ?? 0,
    attendanceCount,
    attendanceTotal,
  })
}
