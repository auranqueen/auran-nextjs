import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPpurioSms } from '@/lib/ppurio/sendAlimtalk'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(req: NextRequest) {
  try {
    const { phone, step, code } = await req.json()
    const cleanPhone = String(phone || '').replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length < 10) {
      return NextResponse.json({ error: '올바른 휴대폰 번호를 입력해주세요' }, { status: 400 })
    }

    if (step === 'send') {
      const { data: user } = await adminSupabase
        .from('users')
        .select('id, email')
        .eq('phone', cleanPhone)
        .maybeSingle()
      if (!user) {
        return NextResponse.json({ error: '등록된 휴대폰 번호가 없어요' }, { status: 404 })
      }
      const verifyCode = genCode()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
      await adminSupabase.from('auth_verification_codes').insert({
        phone: cleanPhone,
        code: verifyCode,
        purpose: 'find_id',
        expires_at: expiresAt,
      })
      await sendPpurioSms({
        phone: cleanPhone,
        message: `[AURAN] 인증번호는 ${verifyCode}입니다. (5분 내 입력)`,
      })
      return NextResponse.json({ ok: true })
    }

    if (step === 'verify') {
      const { data: record } = await adminSupabase
        .from('auth_verification_codes')
        .select('id, code, expires_at, attempt_count')
        .eq('phone', cleanPhone)
        .eq('purpose', 'find_id')
        .eq('verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!record) {
        return NextResponse.json({ error: '인증번호를 다시 요청해주세요' }, { status: 400 })
      }
      if (new Date(record.expires_at) < new Date()) {
        return NextResponse.json({ error: '인증번호가 만료됐어요' }, { status: 400 })
      }
      if (record.attempt_count >= 5) {
        return NextResponse.json({ error: '시도 횟수를 초과했어요' }, { status: 429 })
      }
      if (record.code !== String(code)) {
        await adminSupabase.from('auth_verification_codes')
          .update({ attempt_count: record.attempt_count + 1 })
          .eq('id', record.id)
        return NextResponse.json({ error: '인증번호가 일치하지 않아요' }, { status: 400 })
      }
      await adminSupabase.from('auth_verification_codes')
        .update({ verified: true })
        .eq('id', record.id)
      const { data: user } = await adminSupabase
        .from('users')
        .select('email')
        .eq('phone', cleanPhone)
        .maybeSingle()
      if (!user?.email) {
        return NextResponse.json({ error: '계정을 찾을 수 없어요' }, { status: 404 })
      }
      const userId = user.email.includes('@auran.kr') ? user.email.split('@')[0] : user.email
      return NextResponse.json({ ok: true, userId })
    }

    return NextResponse.json({ error: 'invalid step' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
