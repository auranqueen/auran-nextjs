import { redirect } from 'next/navigation'
import { tryCreateServiceClient } from '@/lib/supabase/service'

type SupabaseServerClient = {
  auth: { getUser: () => Promise<{ data: { user: any | null } }> }
  from: (table: string) => any
}

export async function requireAdmin(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/super-console/login')

  // 0) service_role로 우선 검사 (RLS/정책 영향 제거)
  const svc = tryCreateServiceClient()
  if (svc) {
    const { data: u } = await svc.from('users').select('role,name,email').eq('auth_id', user.id).maybeSingle()
    if ((u as any)?.role === 'admin') return { user, adminName: (u as any)?.name || 'AURAN Admin' }
    const { data: p } = await svc.from('profiles').select('role,email').eq('auth_id', user.id).maybeSingle()
    if ((p as any)?.role === 'admin') return { user, adminName: '관리자' }
  } else {
    // service key가 없는 배포 환경에서도 최소한 기본 관리자 계정은 통과
    if (user.email === 'admin@auran.kr') return { user, adminName: '관리자' }
  }

  // 1) users.role 우선
  try {
    const { data } = await supabase.from('users').select('role,name,email').eq('auth_id', user.id).single()
    if (data?.role === 'admin') return { user, adminName: data.name || 'AURAN Admin' }
  } catch {}

  // 2) profiles.role fallback (and ensure users row exists)
  try {
    const { data: p } = await supabase.from('profiles').select('role,email').eq('auth_id', user.id).single()
    if (p?.role === 'admin') {
      const email = user.email || p.email || `admin-${user.id}@no-email.auran`
      await supabase.from('users').upsert(
        {
          auth_id: user.id,
          email,
          name: '관리자',
          role: 'admin',
          provider: (user.app_metadata?.provider || 'email'),
          status: 'active',
          points: 0,
          charge_balance: 0,
        },
        { onConflict: 'auth_id' }
      )
      return { user, adminName: '관리자' }
    }
  } catch {}

  // Not admin
  redirect('/')
}

