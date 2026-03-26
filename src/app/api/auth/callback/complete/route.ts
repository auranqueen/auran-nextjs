import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * After client-side setSession (e.g. from hash fragment on /auth/callback),
 * ensure users table row exists and return position for redirect.
 * PC 이메일/폰 인증 후 콜백에서 해시로 세션 설정한 경우 호출.
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const position = request.nextUrl.searchParams.get('position') || 'customer'

  const { data: existing } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  const meta = user.user_metadata || {}
  const provider = user.app_metadata?.provider || 'email'
  const kakaoIdentity = user.identities?.find((i: any) => i.provider === 'kakao')
  const kakaoId: string | null =
    (kakaoIdentity?.identity_data?.id != null ? String(kakaoIdentity.identity_data.id) : null) ||
    (kakaoIdentity?.id != null ? String(kakaoIdentity.id) : null) ||
    null

  const emailOrFallback =
    user.email ||
    (provider === 'kakao' && kakaoId ? `kakao-${kakaoId}@no-email.auran` : null) ||
    `${user.id}@no-email.auran`

  if (!existing) {
    const dbRole = meta.role === 'salon' ? 'owner' : (position === 'salon' ? 'owner' : position || meta.role || 'customer')
    const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    const status = dbRole === 'customer' ? 'active' : 'pending'
    const basePayload = {
      auth_id: user.id,
      email: emailOrFallback,
      name: meta.name || meta.full_name || (emailOrFallback?.split('@')[0] ?? '사용자'),
      avatar_url: meta.avatar_url || user.user_metadata?.avatar_url,
      phone: meta.phone || null,
      role: dbRole,
      provider,
      kakao_id: provider === 'kakao' ? kakaoId : null,
      referral_code: referralCode,
      status,
      points: 0,
      charge_balance: 0,
    }
    const up = await supabase.from('users').upsert(basePayload, { onConflict: 'auth_id' })
    if (up.error) {
      const retryEmail = `auth-${user.id}@no-email.auran`
      await supabase.from('users').upsert({ ...basePayload, email: retryEmail }, { onConflict: 'auth_id' })
    }
    await supabase.from('traffic_logs').insert({
      user_id: user.id,
      source: provider || 'direct',
      action: 'signup',
    })
    const { issueSignupCouponsForAuthUser } = await import('@/lib/coupon/issueSignup')
    await issueSignupCouponsForAuthUser(user.id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, nickname')
      .eq('id', user.id)
      .maybeSingle()
    const displayName = String(profile?.name || profile?.nickname || '').trim()
    const welcomeBody = displayName
      ? `세상에서 제일 예쁜 ${displayName}님이 오셨네요 💜 유미님만을 위한 뷰티 플랫폼이에요. 피부분석부터 시작해봐요!`
      : '세상에서 제일 예쁜 분이 오셨네요 💜 유미님만을 위한 뷰티 플랫폼이에요. 피부분석부터 시작해봐요!'
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: '🌸 AURAN에 오신 걸 환영해요!',
      body: welcomeBody,
      type: 'personal',
      is_read: false,
      link_url: '/skin-analysis',
    })
    const { insertSignupWelcomeNotification } = await import('@/lib/notifications/signupWelcome')
    await insertSignupWelcomeNotification(supabase, user.id)
    const { sendSignupAlimtalkIfNeeded } = await import('@/lib/signup/sendSignupAlimtalk')
    await sendSignupAlimtalkIfNeeded(user.id)
  }

  const rawRole = existing?.role ?? meta.role ?? (position === 'salon' ? 'owner' : position) ?? 'customer'
  const userRole = rawRole === 'salon' ? 'owner' : rawRole
  const finalPosition = userRole === 'owner' ? 'salon' : userRole

  return NextResponse.json({ ok: true, position: finalPosition })
}
