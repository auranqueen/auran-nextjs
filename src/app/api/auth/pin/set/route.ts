import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
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
    const payload = {
      payment_pin_hash: hash,
      payment_pin_set_at: new Date().toISOString(),
      pin_failed_count: 0,
      pin_locked_until: null,
    }
    // RLS 우회: 서비스 롤로 users 업데이트 (본인 auth_id만 갱신)
    const service = tryCreateServiceClient()
    const client = service || supabase

    let updatedRow: { id: string } | null = null
    let updateError: { code?: string; message?: string } | null = null

    const runUpdate = async () => {
      const r = await client
        .from('users')
        .update(payload)
        .eq('auth_id', user.id)
        .select('id')
        .maybeSingle()
      return r
    }

    const result = await runUpdate()
    updatedRow = result.data
    updateError = result.error

    // 행이 없고 서비스 롤이 있으면: users 행 생성 후 재시도 (카카오 등 콜백에서 누락된 경우)
    if (!updatedRow && !updateError && service) {
      const email = user.email || `${user.id}@no-email.auran`
      const provider = (user.app_metadata?.provider as string) || 'email'
      const { error: upsertErr } = await service.from('users').upsert(
        {
          auth_id: user.id,
          email,
          name: user.user_metadata?.name || email.split('@')[0] || '사용자',
          role: 'customer',
          status: 'active',
          provider: provider === 'kakao' ? 'kakao' : provider === 'google' ? 'google' : 'email',
          referral_code: `A${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
          points: 0,
          charge_balance: 0,
        },
        { onConflict: 'auth_id' }
      )
      if (!upsertErr) {
        const retry = await runUpdate()
        updatedRow = retry.data
        updateError = retry.error
      }
    }

    if (updateError) {
      const msg =
        updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')
          ? '회원 정보를 찾을 수 없습니다. 로그아웃 후 다시 로그인해 주세요.'
          : 'PIN 저장에 실패했습니다.'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    if (!updatedRow) {
      return NextResponse.json(
        { error: '회원 정보를 찾을 수 없습니다. 서비스 롤 키를 확인하거나 로그아웃 후 다시 로그인해 주세요.' },
        { status: 404 }
      )
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
