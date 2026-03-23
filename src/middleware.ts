import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { SerializeOptions } from 'cookie'

type CookieToSet = { name: string; value: string; options: SerializeOptions }

/** Supabase 세션 갱신 쿠키를 리다이렉트 응답에도 실어 보냄 */
function redirectPreservingSupabaseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value)
  })
  return to
}

function createMiddlewareSupabase(req: NextRequest) {
  let res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            req.cookies.set(name, value)
          })
          res = NextResponse.next()
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  return { supabase, response: res }
}

async function getDbRole(supabase: ReturnType<typeof createServerClient>, authId: string): Promise<string | null> {
  // 1) profiles.role 우선
  try {
    const { data } = await supabase.from('profiles').select('role').eq('auth_id', authId).single()
    if (typeof (data as any)?.role === 'string') return (data as any).role
  } catch {}
  // 2) users.role fallback
  try {
    const { data } = await supabase.from('users').select('role').eq('auth_id', authId).single()
    if (typeof (data as any)?.role === 'string') return (data as any).role
  } catch {}
  return null
}

async function getUserStatus(supabase: ReturnType<typeof createServerClient>, authId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('users').select('status').eq('auth_id', authId).single()
    const s = (data as any)?.status
    return typeof s === 'string' ? s : null
  } catch {}
  return null
}

const PRODUCTION_ORIGIN = 'https://www.auran.kr'

function isSoftAuthPath(pathname: string): boolean {
  if (pathname === '/myworld' || pathname.startsWith('/myworld/')) return true
  if (pathname === '/my/gifts' || pathname.startsWith('/my/gifts/')) return true
  return false
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl
  const host = url.hostname || ''

  // auran-deploy로 들어온 요청은 무조건 프로덕션으로 보냄 (로그인/캐시 관계없이 동일 도메인 유지)
  if (host.includes('auran-deploy.vercel.app')) {
    const to = new URL(url.pathname + url.search, PRODUCTION_ORIGIN)
    return NextResponse.redirect(to.toString(), 302)
  }

  const isRSCRequest = req.headers.get('RSC') === '1'
  const isInternalRequest = !!req.headers.get('Next-Router-Prefetch')
  if (isRSCRequest || isInternalRequest) {
    return NextResponse.next()
  }

  const { pathname } = url
  const protectedPaths = ['/wallet', '/checkout']
  const isProtectedPath = protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isSuperConsole = pathname.startsWith('/super-console')
  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin = pathname.startsWith('/admin')
  const softAuth = isSoftAuthPath(pathname)
  if (!isSuperConsole && !isDashboard && !isAdmin && !isProtectedPath && !softAuth) return NextResponse.next()

  // super-console 로그인 페이지는 예외(비로그인 접근 허용)
  if (pathname === '/super-console/login') return NextResponse.next()

  const { supabase, response: res } = createMiddlewareSupabase(req)

  // 세션 갱신(쿠키) 후 사용자 판별 — getUser() 단독 호출보다 지연·비용 감소에 유리
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) {
    if (softAuth) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set('redirect', `${pathname}${url.search || ''}`)
      loginUrl.searchParams.set('role', 'customer')
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(loginUrl))
    }
    const redirectTarget = `${pathname}${url.search || ''}`
    if (isProtectedPath) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set('redirect', redirectTarget)
      loginUrl.searchParams.set('returnUrl', redirectTarget)
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(loginUrl))
    }
    if (isSuperConsole) {
      const superLoginUrl = req.nextUrl.clone()
      superLoginUrl.pathname = '/super-console/login'
      superLoginUrl.searchParams.set('next', pathname)
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(superLoginUrl))
    }
    // dashboards: if not logged in, keep original path for post-login return
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    if (isDashboard) loginUrl.searchParams.set('redirect', redirectTarget)
    return redirectPreservingSupabaseCookies(res, NextResponse.redirect(loginUrl))
  }

  let role = await getDbRole(supabase, user.id)
  // If RLS blocks role lookup, fall back to email allowlist for admin entry
  if (!role && user.email === 'admin@auran.kr') role = 'admin'
  const normalizedRole = role === 'owner' ? 'salon' : role

  // admin routes: admin only (and keeps session refreshed via middleware cookies)
  if (isAdmin) {
    if (normalizedRole !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/super-console/login'
      url.searchParams.set('next', pathname)
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(url))
    }
    return res
  }

  // super-console: admin only
  if (isSuperConsole) {
    if (normalizedRole !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(url))
    }
    return res
  }

  // dashboards: auto-route to role-matching dashboard root
  if (isDashboard) {
    const map: Record<string, string> = {
      customer: '/dashboard/customer',
      partner: '/dashboard/partner',
      salon: '/dashboard/owner',
      brand: '/dashboard/brand',
      admin: '/admin',
    }
    const target = normalizedRole && map[normalizedRole] ? map[normalizedRole] : '/dashboard/customer'
    if (target === '/admin') {
      // admin은 대시보드 경로로 접근 시 홈으로 보내고 슈퍼콘솔로만 진입
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(url))
    }
    if (!pathname.startsWith(target)) {
      const url = req.nextUrl.clone()
      url.pathname = target
      url.search = ''
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(url))
    }

    // 고객 대시보드 루트(/dashboard/customer)는 비활성화 → 앱 홈으로
    if (pathname === '/dashboard/customer' || pathname === '/dashboard/customer/') {
      const url = req.nextUrl.clone()
      url.pathname = '/home'
      url.search = ''
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(url))
    }

    // partner/owner/brand는 본사 승인 전 접근 차단 (users.status !== 'active')
    if (normalizedRole === 'partner' || normalizedRole === 'salon' || normalizedRole === 'brand') {
      const status = await getUserStatus(supabase, user.id)
      if (status && status !== 'active') {
        const url = req.nextUrl.clone()
        url.pathname = '/auth/pending-approval'
        url.searchParams.set('role', normalizedRole === 'salon' ? 'owner' : normalizedRole)
        return redirectPreservingSupabaseCookies(res, NextResponse.redirect(url))
      }
    }
  }

  return res
}

export const config = {
  // auran-deploy 리다이렉트를 위해 모든 경로에서 실행. 정적/API 제외
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/).*)',
    '/super-console/:path*',
    '/dashboard/:path*',
    '/admin/:path*',
  ],
}