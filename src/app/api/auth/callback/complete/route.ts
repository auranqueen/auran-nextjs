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

  const searchParams = request.nextUrl.searchParams
  const position = searchParams.get('position') || 'customer'

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
      marketing_agreed: searchParams.get('marketing') === 'true',
      marketing_agreed_at: searchParams.get('marketing') === 'true' ? new Date().toISOString() : null,
      research_consent: searchParams.get('research') === 'true',
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
      if (newUser?.id && dbRole !== 'owner' && dbRole !== 'partner' && dbRole !== 'brand') {
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
          body: '오렌 합류 환영해요 💜 토스트 10,000T를 드릴게요. 지갑에서 확인해보세요!',
          link_url: '/my',
          is_read: false,
        } as any)
      }
      // owner 가입 시 salons 자동 생성
      if (dbRole === 'owner' && newUser?.id) {
        try {
          const { data: existingSalon } = await adminClient
            .from('salons')
            .select('id')
            .eq('owner_id', newUser.id)
            .maybeSingle()
          if (!existingSalon) {
            const { error: salonErr } = await adminClient.from('salons').insert({
              owner_id: newUser.id,
              name: displayName ? `${displayName} 샵` : '내 샵',
              description: '',
              area: '',
              address: '',
              phone: '',
              services: [],
              open_hours: {
                mon: '10:00-20:00',
                tue: '10:00-20:00',
                wed: '10:00-20:00',
                thu: '10:00-20:00',
                fri: '10:00-20:00',
                sat: '10:00-18:00',
                sun: null,
              },
              status: 'inactive',
              staff_count: 1,
              room_count: 1,
              review_count: 0,
              avg_rating: 0,
            })
            if (!salonErr) {
              await adminClient.from('notifications').insert({
                user_id: newUser.id,
                type: 'personal',
                title: '🌸 오렌에 오신 걸 환영해요!',
                body: '샵 설정에서 기본 정보를 등록하고 첫 고객을 맞이해보세요 💜',
                link_url: '/dashboard/owner?v=2',
                is_read: false,
              } as any)
            }
          }
        } catch (e) { console.error('[salon auto create]', e) }
      }
    } catch (e) { console.error('[signup gift]', e) }
    const { sendSignupAlimtalkIfNeeded } = await import('@/lib/signup/sendSignupAlimtalk')
    await sendSignupAlimtalkIfNeeded(user.id)
  }

    // 기존 유저도 토스트 미지급 시 idempotent 지급
    try {
      const { tryCreateAdminClient } = await import('@/lib/supabase/admin')
      const adminClient2 = tryCreateAdminClient() || supabase
      const { data: anyUser } = await adminClient2
        .from('users')
        .select('id, role, points')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (anyUser?.id && !['owner','partner','brand'].includes(anyUser.role ?? '')) {
        const { data: alreadyGiven } = await adminClient2
          .from('toast_transactions')
          .select('id')
          .eq('user_id', anyUser.id)
          .eq('reference_id', 'signup')
          .maybeSingle()
        if (!alreadyGiven) {
          await adminClient2.from('toast_transactions').insert({
            user_id: anyUser.id,
            amount: 10000,
            transaction_type: 'earn',
            source_type: 'signup',
            reference_id: 'signup',
          } as any)
          await adminClient2.from('users')
            .update({ points: (anyUser.points ?? 0) + 10000 })
            .eq('id', anyUser.id)
          await adminClient2.from('notifications').insert({
            user_id: anyUser.id,
            type: 'toast',
            title: '🎁 가입 선물 10,000T가 도착했어요!',
            body: '오렌 합류 환영해요 💜 토스트 10,000T를 드릴게요. 지갑에서 확인해보세요!',
            link_url: '/my',
            is_read: false,
          } as any)
        }
      }
    } catch (e) { console.error('idempotent toast grant error:', e) }

  const rawRole = existingUser?.role ?? meta.role ?? (position === 'salon' ? 'owner' : position) ?? 'customer'
  const userRole = rawRole === 'salon' ? 'owner' : rawRole
  const finalPosition = userRole === 'owner' ? 'salon' : userRole

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
    const userAgent = request.headers.get('user-agent') || null
    const { data: logUserRow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    await supabase.from('login_logs').insert({
      user_id: (logUserRow as { id?: string } | null)?.id ?? null,
      email: emailOrFallback,
      role: userRole,
      provider,
      ip_address: ip,
      user_agent: userAgent,
      status: 'success',
    } as any)
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true, position: finalPosition })
}
