import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function createMiddlewareClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isSuperConsole = pathname.startsWith('/super-console')
  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin = pathname.startsWith('/admin')
  if (!isSuperConsole && !isDashboard && !isAdmin) return NextResponse.next()

  // super-console 로그인 페이지는 예외(비로그인 접근 허용)
  if (pathname === '/super-console/login') return NextResponse.next()

  const res = NextResponse.next()
  const supabase = createMiddlewareClient(req, res)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    if (isSuperConsole) {
      const url = req.nextUrl.clone()
      url.pathname = '/super-console/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
    // dashboards: if not logged in, send to normal login
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
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
      return NextResponse.redirect(url)
    }
    return res
  }

  // super-console: admin only
  if (isSuperConsole) {
    if (normalizedRole !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return NextResponse.redirect(url)
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
      return NextResponse.redirect(url)
    }
    if (!pathname.startsWith(target)) {
      const url = req.nextUrl.clone()
      url.pathname = target
      url.search = ''
      return NextResponse.redirect(url)
    }

    // partner/owner/brand는 본사 승인 전 접근 차단 (users.status !== 'active')
    if (normalizedRole === 'partner' || normalizedRole === 'salon' || normalizedRole === 'brand') {
      const status = await getUserStatus(supabase, user.id)
      if (status && status !== 'active') {
        const url = req.nextUrl.clone()
        url.pathname = '/auth/pending-approval'
        url.searchParams.set('role', normalizedRole === 'salon' ? 'owner' : normalizedRole)
        return NextResponse.redirect(url)
      }
    }
  }

  return res
}

export const config = {
  matcher: ['/super-console/:path*', '/dashboard/:path*', '/admin/:path*'],
}