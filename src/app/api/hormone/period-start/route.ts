import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { date } = await req.json()
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '날짜 형식 오류' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { data: hc } = await supabase
      .from('hormone_cycle')
      .select('last_period_date, cycle_length, track')
      .eq('auth_id', user.id)
      .single()

    let newCycleLength = Math.max(21, Math.min(60, Number(hc?.cycle_length || 28)))

    if (hc?.last_period_date) {
      const prev = new Date(hc.last_period_date)
      const next = new Date(date)
      const diff = Math.floor((next.getTime() - prev.getTime()) / 86400000)
      if (diff >= 21 && diff <= 45) {
        newCycleLength = diff
      }
    }

    const newDate = new Date(date)
    newDate.setDate(newDate.getDate() + newCycleLength)
    const expectedPeriodDate = newDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

    const isPregnantOrPostpartum = hc?.track === 'pregnant' || hc?.track === 'postpartum'

    const payload: any = {
      last_period_date: date,
      period_started_at: date,
      cycle_length: newCycleLength,
      expected_period_date: expectedPeriodDate,
      updated_at: new Date().toISOString(),
    }
    if (isPregnantOrPostpartum) {
      payload.track = 'general'
    }

    const { error } = await supabase
      .from('hormone_cycle')
      .update(payload)
      .eq('auth_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      cycle_length: newCycleLength,
      expected_period_date: expectedPeriodDate,
      track_changed: isPregnantOrPostpartum ? 'general' : null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
