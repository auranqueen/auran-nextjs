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
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 800)
    )
    const { data } = (await Promise.race([
      supabase.from('profiles').select('role, active_role').eq('auth_id', authId).maybeSingle(),
      timeoutPromise,
    ])) as { data: any }
    const r = (data as any)?.active_role || (data as any)?.role
    if (typeof r === 'string') return r
  } catch {}
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 800)
    )
    const { data } = (await Promise.race([
      supabase.from('users').select('role').eq('auth_id', authId).single(),
      timeoutPromise,
    ])) as { data: any }
    if (typeof (data as any)?.role === 'string') return (data as any).role
  } catch {}
  return null
}

async function getUserStatus(supabase: ReturnType<typeof createServerClient>, authId: string): Promise<string | null> {
  try {
    const { data } = (await Promise.race([
      supabase.from('users').select('status').eq('auth_id', authId).single(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800)),
    ])) as { data: any }
    const s = (data as any)?.status
    return typeof s === 'string' ? s : null
  } catch {}
  return null
}

/** 서명된 role/status 캐시 (DB 조회 스킵용). ROLE_CACHE_SECRET 없으면 비활성. */
const ROLE_CACHE_COOKIE = 'auran_role_cache'
const ROLE_CACHE_TTL_MS = 60_000

function getRoleCacheSecret(): string | null {
  const s = process.env.ROLE_CACHE_SECRET
  return typeof s === 'string' && s.length >= 16 ? s : null
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type RoleCachePayload = { role: string; status: string | null }

/** 쿠키 형식: v1.<base64url JSON>.<hmacHex> — 서명 메시지 = body(JSON 문자열) */
async function readRoleCache(
  req: NextRequest,
  authId: string,
): Promise<RoleCachePayload | null> {
  const secret = getRoleCacheSecret()
  if (!secret) return null
  const raw = req.cookies.get(ROLE_CACHE_COOKIE)?.value
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null
  const [, bodyB64, sigHex] = parts
  if (!bodyB64 || !sigHex || !/^[0-9a-f]+$/i.test(sigHex)) return null
  let bodyJson: string
  try {
    const pad = bodyB64.length % 4 === 0 ? '' : '='.repeat(4 - (bodyB64.length % 4))
    bodyJson = atob(bodyB64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  } catch {
    return null
  }
  const expected = await hmacSha256Hex(secret, bodyJson)
  if (!timingSafeEqualHex(expected.toLowerCase(), sigHex.toLowerCase())) return null
  let parsed: { u?: string; r?: string; s?: string | null; t?: number }
  try {
    parsed = JSON.parse(bodyJson)
  } catch {
    return null
  }
  if (typeof parsed.u !== 'string' || parsed.u !== authId) return null
  if (typeof parsed.r !== 'string' || !parsed.r) return null
  if (typeof parsed.t !== 'number' || !Number.isFinite(parsed.t)) return null
  if (Date.now() - parsed.t > ROLE_CACHE_TTL_MS || Date.now() - parsed.t < -5_000) return null
  const status =
    parsed.s === null || parsed.s === undefined
      ? null
      : typeof parsed.s === 'string'
        ? parsed.s
        : null
  return { role: parsed.r, status }
}

async function writeRoleCacheCookie(
  res: NextResponse,
  authId: string,
  role: string,
  status: string | null,
) {
  const secret = getRoleCacheSecret()
  if (!secret || !role) return
  const bodyJson = JSON.stringify({
    u: authId,
    r: role,
    s: status,
    t: Date.now(),
  })
  const sigHex = await hmacSha256Hex(secret, bodyJson)
  const bodyB64 = btoa(bodyJson).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  res.cookies.set(ROLE_CACHE_COOKIE, `v1.${bodyB64}.${sigHex}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60,
  })
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
    ;(async () => {
      try {
        const ip = (req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim()
        const referrer = req.headers.get('referer') || req.headers.get('referrer') || ''
        const userAgent = req.headers.get('user-agent') || ''
        const page = req.nextUrl.pathname
        const isAsset = /\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf)$/.test(page)
        const isApi = page.startsWith('/api/')
        if (!isAsset && !isApi) {
          await supabaseAdmin().from('visitor_logs').insert({
            ip: ip.replace(/(\d+)$/, '***'),
            referrer: referrer.slice(0, 500),
            user_agent: userAgent.slice(0, 300),
            page: page.slice(0, 200),
          })
        }
      } catch (e) {
        // 방문자 로그 실패해도 무시
      }
    })()
    return NextResponse.next()
  }

  const { pathname } = url
  if (pathname === '/home' || pathname.startsWith('/home/')) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  if (
    pathname.startsWith('/api/payment') ||
    pathname.startsWith('/api/payapp') ||
    pathname.startsWith('/api/payments/payapp') ||
    pathname.startsWith('/api/payments/brand-self')
  ) {
    return NextResponse.next()
  }
  const protectedPaths = ['/wallet', '/checkout']
  const isProtectedPath = protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  const isSuperConsole = pathname.startsWith('/super-console')
  if (pathname.startsWith('/dashboard/customer/chat') || pathname.startsWith('/dashboard/owner/chat')) return NextResponse.next()
  const isDashboard = pathname.startsWith('/dashboard')
  const isAdmin = pathname.startsWith('/admin')
  const isBrand = pathname.startsWith('/brand') && !pathname.startsWith('/brands') && !pathname.match(/^\/brand\/[^/]+$/) && !pathname.match(/^\/brand\/[^/]+\//)
  const isLogiLogin = pathname.match(/^\/logi\/[^/]+$/) !== null
  const softAuth = isSoftAuthPath(pathname)
  const isHome = pathname === '/'
  if (!isHome && !isSuperConsole && !isDashboard && !isAdmin && !isBrand && !isProtectedPath && !softAuth && !isLogiLogin) return NextResponse.next()

  // super-console 로그인 페이지는 예외(비로그인 접근 허용)
  if (pathname === '/super-console/login') return NextResponse.next()

  const { supabase, response: res } = createMiddlewareSupabase(req)

  // getUser()로 토큰 로컬 검증, 네트워크 왕복 없음
  const { data } = await supabase.auth.getUser()
  const user = data.user ?? null

  if (!user) {
    if (false) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      return redirectPreservingSupabaseCookies(res, NextResponse.redirect(loginUrl))
    }
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
    if (isDashboard) {
      loginUrl.searchParams.set('redirect', redirectTarget)
      const dashRole = pathname.split('/')[2]
      if (dashRole === 'owner' || dashRole === 'brand' || dashRole === 'partner' || dashRole === 'admin') {
        loginUrl.searchParams.set('role', dashRole)
      }
    }
    return redirectPreservingSupabaseCookies(res, NextResponse.redirect(loginUrl))
  }

  // 빠른 경로: 서명 캐시가 유효하면 getDbRole/getUserStatus DB 조회 스킵 (함수 본문은 변경하지 않음)
  const roleCache = await readRoleCache(req, user.id)
  let role: string | null
  let statusFromCache: string | null | undefined
  let usedRoleCache = false
  let pendingRoleCache: RoleCachePayload | null = null

  if (roleCache) {
    role = roleCache.role
    statusFromCache = roleCache.status
    usedRoleCache = true
  } else {
    role = await getDbRole(supabase, user.id)
    // If RLS blocks role lookup, fall back to email allowlist for admin entry
    if (!role && user.email === 'admin@auran.kr') role = 'admin'
    if (role) pendingRoleCache = { role, status: null }
  }

  const attachPendingRoleCache = async (response: NextResponse) => {
    if (!usedRoleCache && pendingRoleCache?.role) {
      await writeRoleCacheCookie(
        response,
        user.id,
        pendingRoleCache.role,
        pendingRoleCache.status,
      )
    }
    return response
  }

  const redirectWithCache = async (to: NextResponse) => {
    return attachPendingRoleCache(redirectPreservingSupabaseCookies(res, to))
  }

  const normalizedRole = role === 'owner' ? 'salon' : role

  if (user && isHome) {
    if (normalizedRole === 'admin' && req.nextUrl.searchParams.get('preview') !== 'guest')
      return redirectWithCache(NextResponse.redirect(new URL('/admin', req.url)))
    if (normalizedRole === 'brand')
      return redirectWithCache(NextResponse.redirect(new URL('/dashboard/brand', req.url)))
    if (normalizedRole === 'salon' || normalizedRole === 'owner')
      return redirectWithCache(NextResponse.redirect(new URL('/dashboard/owner', req.url)))
    if (normalizedRole === 'partner')
      return redirectWithCache(NextResponse.redirect(new URL('/dashboard/partner', req.url)))
  }

  // admin routes: admin only (and keeps session refreshed via middleware cookies)
  if (isAdmin) {
    const appRole = (user?.app_metadata as { role?: string } | undefined)?.role
      ?? (user as any)?.raw_app_meta_data?.role
      ?? ''
    const isSuperAdmin = appRole === 'super_admin'
    if (normalizedRole !== 'admin' && !isSuperAdmin) {
      const url = req.nextUrl.clone()
      url.pathname = '/super-console/login'
      url.searchParams.set('next', pathname)
      return redirectWithCache(NextResponse.redirect(url))
    }
    return attachPendingRoleCache(res)
  }

  // super-console: admin only
  if (isSuperConsole) {
    if (normalizedRole !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return redirectWithCache(NextResponse.redirect(url))
    }
    return attachPendingRoleCache(res)
  }

  if (isBrand) {
    if (normalizedRole !== 'brand') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return redirectWithCache(NextResponse.redirect(url))
    }
    return attachPendingRoleCache(res)
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
    if (pathname.startsWith('/dashboard/logi')) {
      // 물류허브는 role 강제라우팅 예외 — 페이지 자체(소유권/컴퍼니멤버십+PIN게이트)에서 인증 처리
      return attachPendingRoleCache(res)
    }
    if (pathname.startsWith('/dashboard/admin')) {
      const appRole = (user as any)?.app_metadata?.role ?? ''
      const isSuperAdmin = appRole === 'super_admin'
      if (normalizedRole !== 'admin' && !isSuperAdmin) {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/'
        redirectUrl.search = ''
        return redirectWithCache(NextResponse.redirect(redirectUrl))
      }
      return attachPendingRoleCache(res)
    }
    if (target === '/admin') {
      // admin은 대시보드 경로로 접근 시 홈으로 보내고 슈퍼콘솔로만 진입
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return redirectWithCache(NextResponse.redirect(url))
    }
    if (!pathname.startsWith(target)) {
      const url = req.nextUrl.clone()
      url.pathname = target
      url.search = ''
      return redirectWithCache(NextResponse.redirect(url))
    }

    // 고객 대시보드 루트(/dashboard/customer)는 비활성화 → 앱 홈으로
    if (pathname === '/dashboard/customer' || pathname === '/dashboard/customer/') {
      const url = req.nextUrl.clone()
      url.pathname = '/'
      url.search = ''
      return redirectWithCache(NextResponse.redirect(url))
    }

    // partner/owner/brand는 본사 승인 전 접근 차단 (users.status !== 'active')
    if (normalizedRole === 'partner' || normalizedRole === 'salon' || normalizedRole === 'brand') {
      const status =
        usedRoleCache && statusFromCache !== undefined
          ? statusFromCache
          : await getUserStatus(supabase, user.id)
      if (!usedRoleCache && pendingRoleCache) pendingRoleCache.status = status
      if (status && status !== 'active') {
        const url = req.nextUrl.clone()
        url.pathname = '/auth/pending-approval'
        url.searchParams.set('role', normalizedRole === 'salon' ? 'owner' : normalizedRole)
        return redirectWithCache(NextResponse.redirect(url))
      }
    }
  }

  return attachPendingRoleCache(res)
}

const supabaseAdmin = () => {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/super-console/:path*',
    '/my/:path*',
    '/auth/:path*',
    '/signup/:path*',
    '/login',
    '/',
    '/products/:path*',
    '/store/:path*',
    '/store-review',
    '/track/:path*',
    '/join/:path*',
    '/about/:path*',
  ],
}