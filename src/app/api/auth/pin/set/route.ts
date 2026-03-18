import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

const PIN_REGEX = /^\d{6}$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: 'PIN은 6자리 숫자여야 합니다.' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const hash = bcrypt.hashSync(pin, 10)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        payment_pin_hash: hash,
        payment_pin_set_at: new Date().toISOString(),
        pin_failed_count: 0,
        pin_locked_until: null,
      })
      .eq('auth_id', user.id)

    if (updateError) {
      return NextResponse.json({ error: 'PIN 저장에 실패했습니다.' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
