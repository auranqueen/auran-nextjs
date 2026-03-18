import { redirect } from 'next/navigation'

type SupabaseServerClient = {
  auth: { getUser: () => Promise<{ data: { user: any | null } }> }
  from: (table: string) => any
}

export async function requireAdmin(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/super-console/login')

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

