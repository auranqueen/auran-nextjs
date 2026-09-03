import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const { role } = await req.json()
  if (!role) return NextResponse.json({ error: 'role 필요' }, { status: 400 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  // roles 배열에 해당 role 있는지 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('roles, active_role')
    .eq('auth_id', user.id)
    .maybeSingle()

  const roles = (profile as any)?.roles || ['customer']
  if (!roles.includes(role)) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // active_role 업데이트
  const { error } = await supabase
    .from('profiles')
    .update({ active_role: role })
    .eq('auth_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const res = NextResponse.json({ ok: true, active_role: role })
  // 미들웨어 role/status 서명 캐시 무효화 (역할 전환 직후 구 캐시 사용 방지)
  res.cookies.set('auran_role_cache', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return res
}
