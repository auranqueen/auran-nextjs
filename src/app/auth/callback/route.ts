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
  const roleParam = url.searchParams.get('role')
  const position = roleParam || 'customer'
  const origin = getOrigin(request)

  let dashboardPath = '/home'
  if (roleParam) {
    if (roleParam === 'owner' || roleParam === 'salon') dashboardPath = '/dashboard/owner'
    else if (roleParam === 'partner') dashboardPath = '/dashboard/partner'
    else if (roleParam === 'brand') dashboardPath = '/dashboard/brand'
    else if (roleParam === 'admin') dashboardPath = '/admin'
  }

  // auran-deploy로 에러가 넘어온 경우: 프로덕션 대시보드로 보내서 재시도 유도 (/login 사용 안 함)
  if (host.includes('auran-deploy.vercel.app') && (errorParam || !code)) {
    const q = errorParam ? `?error=${encodeURIComponent(errorParam)}` : ''
    return NextResponse.redirect(`${PRODUCTION_ORIGIN}${dashboardPath}${q}`)
  }

  if (errorParam && !code) {
    return NextResponse.redirect(
      `${origin}${dashboardPath}?error=${encodeURIComponent(errorParam)}`
    )
  }

  // PKCE: code_verifier는 브라우저 쿠키에만 있어 서버에서 교환 실패하는 경우가 있음 → /auth/exchange 에서 클라이언트 교환
  if (code) {
    const next = request.nextUrl.clone()
    next.pathname = '/auth/exchange'
    return NextResponse.redirect(next)
  }

  // PC: 이메일/폰 인증 후 리다이렉트가 해시(#access_token=...)로 올 수 있음. 서버는 해시를 못 받으므로 200 HTML로 해시 처리.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  // 카카오 등 해시(#access_token=...) 리다이렉트: 클라이언트에서 현재 창 origin 사용해 같은 도메인 유지
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>로그인 처리 중</title></head><body><p>로그인 처리 중...</p><script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script><script>
(function(){
  var hash = (window.location.hash || '').slice(1);
  var q = new URLSearchParams(window.location.search);
  var role = q.get('role') || 'customer';
  var redirect = q.get('redirect') || '';
  var origin = window.location.origin || ${JSON.stringify(origin)};
  var supabaseUrl = ${JSON.stringify(supabaseUrl)};
  var supabaseKey = ${JSON.stringify(supabaseAnon)};
  var params = new URLSearchParams(hash);
  var access_token = params.get('access_token');
  var refresh_token = params.get('refresh_token') || '';
  if (!access_token || !supabaseUrl || !supabaseKey) {
    var dashFail = '/home';
    if (role === 'owner' || role === 'salon') dashFail = '/dashboard/owner';
    else if (role === 'partner') dashFail = '/dashboard/partner';
    else if (role === 'brand') dashFail = '/dashboard/brand';
    else if (role === 'admin') dashFail = '/admin';
    window.location.replace(origin + dashFail + '?error=auth_failed');
    return;
  }
  var supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
  supabase.auth.setSession({ access_token: access_token, refresh_token: refresh_token })
    .then(function() {
      var qs = '?position=' + encodeURIComponent(role);
      if (redirect && redirect.charAt(0) === '/') {
        qs += '&redirect=' + encodeURIComponent(redirect);
      }
      return fetch(origin + '/api/auth/callback/complete' + qs, { credentials: 'same-origin' });
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
    .catch(function() {
      var dashCatch = '/home';
      if (role === 'owner' || role === 'salon') dashCatch = '/dashboard/owner';
      else if (role === 'partner') dashCatch = '/dashboard/partner';
      else if (role === 'brand') dashCatch = '/dashboard/brand';
      else if (role === 'admin') dashCatch = '/admin';
      window.location.replace(origin + dashCatch + '?error=auth_failed');
    });
})();
</script></body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
