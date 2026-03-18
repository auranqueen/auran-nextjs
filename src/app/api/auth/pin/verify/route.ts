import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

const PIN_REGEX = /^\d{6}$/
const MAX_FAIL = 5
const LOCK_MINUTES = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: 'PIN 6자리를 입력해주세요.' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: row, error: fetchError } = await supabase
      .from('users')
      .select('payment_pin_hash, pin_failed_count, pin_locked_until')
      .eq('auth_id', user.id)
      .single()

    if (fetchError || !row) {
      return NextResponse.json({ error: 'PIN이 설정되지 않았습니다.' }, { status: 400 })
    }

    const lockedUntil = row.pin_locked_until ? new Date(row.pin_locked_until) : null
    if (lockedUntil && lockedUntil > new Date()) {
      const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)
      return NextResponse.json({ error: 'pin_locked', minutesLeft: mins }, { status: 423 })
    }

    const hash = row.payment_pin_hash
    if (!hash) {
      return NextResponse.json({ error: 'PIN이 설정되지 않았습니다.' }, { status: 400 })
    }

    const ok = bcrypt.compareSync(pin, hash)
    if (!ok) {
      const failCount = (row.pin_failed_count ?? 0) + 1
      const updates: Record<string, unknown> = { pin_failed_count: failCount }
      if (failCount >= MAX_FAIL) {
        const lockUntil = new Date()
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCK_MINUTES)
        updates.pin_locked_until = lockUntil.toISOString()
      }
      await supabase.from('users').update(updates).eq('auth_id', user.id)
      if (failCount >= MAX_FAIL) {
        return NextResponse.json({ error: 'pin_locked', minutesLeft: LOCK_MINUTES }, { status: 423 })
      }
      return NextResponse.json({ error: 'PIN이 일치하지 않습니다.' }, { status: 401 })
    }

    await supabase.from('users').update({
      pin_failed_count: 0,
      pin_locked_until: null,
    }).eq('auth_id', user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
