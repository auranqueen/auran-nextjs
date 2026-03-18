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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // /super-console/* 는 admin만 접근
  if (!pathname.startsWith('/super-console')) return NextResponse.next()

  // 로그인 페이지는 예외(비로그인 접근 허용)
  if (pathname === '/super-console/login') return NextResponse.next()

  const res = NextResponse.next()
  const supabase = createMiddlewareClient(req, res)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/super-console/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const role = await getDbRole(supabase, user.id)
  if (role !== 'admin') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/super-console/:path*'],
}