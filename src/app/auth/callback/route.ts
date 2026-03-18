import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const PRODUCTION_HOSTS = ['www.auran.kr', 'auran.kr']

function getOrigin(request: NextRequest): string {
  const url = new URL(request.url)
  const host = url.hostname || ''
  // 프로덕션 도메인으로 들어온 요청은 항상 같은 도메인으로 리다이렉트 (NEXT_PUBLIC_APP_URL이 Vercel URL로 되어 있어도 auran.kr 유지)
  if (PRODUCTION_HOSTS.some(h => host === h)) {
    const protocol = url.protocol || 'https:'
    return `${protocol}//${host}`
  }
  return process.env.NEXT_PUBLIC_APP_URL || url.origin
}

const PRODUCTION_ORIGIN = 'https://www.auran.kr'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const host = url.hostname || ''
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error') || url.searchParams.get('error_description') || ''
  const position = url.searchParams.get('role') || 'customer'
  const redirect = url.searchParams.get('redirect') || ''
  const origin = getOrigin(request)

  // auran-deploy로 에러가 넘어온 경우: 프로덕션 로그인으로 보내서 재시도 유도
  if (host.includes('auran-deploy.vercel.app') && (errorParam || !code)) {
    const err = errorParam ? `&error=${encodeURIComponent(errorParam)}` : ''
    return NextResponse.redirect(`${PRODUCTION_ORIGIN}/login?role=${position}${err}`)
  }

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      const { data: existing } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_id', data.user.id)
        .single()

      const meta = data.user.user_metadata || {}
      const provider = data.user.app_metadata?.provider || 'email'
      const kakaoIdentity = data.user.identities?.find((i: any) => i.provider === 'kakao')
      const kakaoId: string | null =
        (kakaoIdentity?.identity_data?.id != null ? String(kakaoIdentity.identity_data.id) : null) ||
        (kakaoIdentity?.id != null ? String(kakaoIdentity.id) : null) ||
        null

      const emailOrFallback =
        data.user.email ||
        (provider === 'kakao' && kakaoId ? `kakao-${kakaoId}@no-email.auran` : null) ||
        `${data.user.id}@no-email.auran`

      if (!existing) {
        const dbRole = meta.role === 'salon' ? 'owner' : (position === 'salon' ? 'owner' : position || meta.role || 'customer')
        const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase()
        const status = dbRole === 'customer' ? 'active' : 'pending'
        // Kakao may not provide email. Use fallback email and upsert by auth_id
        const basePayload = {
          auth_id: data.user.id,
          email: emailOrFallback,
          name: meta.name || meta.full_name || (emailOrFallback?.split('@')[0] ?? '사용자'),
          avatar_url: meta.avatar_url || data.user.user_metadata?.avatar_url,
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
          // If email uniqueness collides, retry with auth-id based fallback
          const retryEmail = `auth-${data.user.id}@no-email.auran`
          const up2 = await supabase.from('users').upsert({ ...basePayload, email: retryEmail }, { onConflict: 'auth_id' })
          if (up2.error) throw up2.error
        }
        await supabase.from('traffic_logs').insert({
          user_id: data.user.id,
          source: provider || 'direct',
          action: 'signup',
        })
      }

      const rawRole = existing?.role ?? meta.role ?? (position === 'salon' ? 'owner' : position) ?? 'customer'
      const userRole = rawRole === 'salon' ? 'owner' : rawRole
      const finalPosition = userRole === 'owner' ? 'salon' : userRole
      const redirectSuffix = redirect && redirect.startsWith('/') ? `&redirect=${encodeURIComponent(redirect)}` : ''
      return NextResponse.redirect(`${origin}/auth/done?position=${finalPosition}${redirectSuffix}`)
    }
    if (code) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`)
    }
  }

  // PC: 이메일/폰 인증 후 리다이렉트가 해시(#access_token=...)로 올 수 있음. 서버는 해시를 못 받으므로 200 HTML로 해시 처리.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>로그인 처리 중</title></head><body><p>로그인 처리 중...</p><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script><script>
(function(){
  var u = window.location.href;
  var hash = (window.location.hash || '').slice(1);
  var q = new URLSearchParams(window.location.search);
  var role = q.get('role') || 'customer';
  var redirect = q.get('redirect') || '';
  var origin = ${JSON.stringify(origin)};
  var supabaseUrl = ${JSON.stringify(supabaseUrl)};
  var supabaseKey = ${JSON.stringify(supabaseAnon)};
  var params = new URLSearchParams(hash);
  var access_token = params.get('access_token');
  var refresh_token = params.get('refresh_token') || '';
  if (!access_token || !supabaseUrl || !supabaseKey) {
    window.location.href = origin + '/login?error=auth_failed';
    return;
  }
  var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
  supabase.auth.setSession({ access_token: access_token, refresh_token: refresh_token })
    .then(function() {
      var qs = '?position=' + encodeURIComponent(role);
      if (redirect && redirect.charAt(0) === '/') {
        qs += '&redirect=' + encodeURIComponent(redirect);
      }
      return fetch(origin + '/api/auth/callback/complete' + qs);
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var pos = (d && d.position) ? d.position : role;
      var url = origin + '/auth/done?position=' + encodeURIComponent(pos);
      if (redirect && redirect.charAt(0) === '/') {
        url += '&redirect=' + encodeURIComponent(redirect);
      }
      window.location.replace(url);
    })
    .catch(function() { window.location.href = origin + '/login?error=auth_failed'; });
})();
</script></body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
