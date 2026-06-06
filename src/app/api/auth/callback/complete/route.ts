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

  let existingByEmail: { id: string; role: string | null } | null = null
  if (!existing) {
    const { data } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', emailOrFallback)
      .maybeSingle()
    existingByEmail = data
    if (existingByEmail?.id) {
      await supabase.from('users').update({ auth_id: user.id }).eq('id', existingByEmail.id)
    }
  }
  const existingUser = existing ?? existingByEmail

  if (!existingUser) {
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
      .select('full_name, username')
      .eq('auth_id', user.id)
      .maybeSingle()
    const displayName = String(
      profile?.full_name || profile?.username || meta.full_name || meta.name || ''
    ).trim()
    const welcomeBody = displayName
      ? `세상에서 제일 예쁜 ${displayName}님이 오셨네요 💜 ${displayName}님만을 위한 뷰티 플랫폼이에요. 피부분석부터 시작해봐요!`
      : '세상에서 제일 예쁜 분이 오셨네요 💜 회원님만을 위한 뷰티 플랫폼이에요. 피부분석부터 시작해봐요!'
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
    try {
      const { tryCreateAdminClient } = await import('@/lib/supabase/admin')
      const adminClient = tryCreateAdminClient() || supabase
      const { data: newUser } = await adminClient
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (newUser?.id) {
        await adminClient.from('toast_transactions').insert({
          user_id: newUser.id,
          amount: 10000,
          transaction_type: 'earn',
          source_type: 'signup',
          reference_id: 'signup',
        } as any)
        await adminClient.from('users')
          .update({ points: 10000 })
          .eq('id', newUser.id)
        await adminClient.from('notifications').insert({
          user_id: newUser.id,
          type: 'toast',
          title: '🎁 가입 선물 10,000T가 도착했어요!',
          body: '오랜 합류 환영해요 💜 토스트 10,000T를 드릴게요. 지갑에서 확인해보세요!',
          link_url: '/my',
          is_read: false,
        } as any)
      }
    } catch (e) { console.error('[signup gift]', e) }
    const { sendSignupAlimtalkIfNeeded } = await import('@/lib/signup/sendSignupAlimtalk')
    await sendSignupAlimtalkIfNeeded(user.id)
  }

  const rawRole = existingUser?.role ?? meta.role ?? (position === 'salon' ? 'owner' : position) ?? 'customer'
  const userRole = rawRole === 'salon' ? 'owner' : rawRole
  const finalPosition = userRole === 'owner' ? 'salon' : userRole

  return NextResponse.json({ ok: true, position: finalPosition })
}
