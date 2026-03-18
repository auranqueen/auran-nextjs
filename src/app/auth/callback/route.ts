import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const position = url.searchParams.get('role') || 'customer'
  const origin = url.origin

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
      if (!existing) {
        const dbRole = meta.role === 'salon' ? 'owner' : (position === 'salon' ? 'owner' : position || meta.role || 'customer')
        const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase()
        await supabase.from('users').insert({
          auth_id: data.user.id,
          email: data.user.email,
          name: meta.name || meta.full_name || data.user.email?.split('@')[0] || '사용자',
          avatar_url: meta.avatar_url || data.user.user_metadata?.avatar_url,
          phone: meta.phone || null,
          role: dbRole,
          provider: data.user.app_metadata?.provider || 'email',
          referral_code: referralCode,
          status: 'active',
          points: 0,
          charge_balance: 0,
        })
        await supabase.from('traffic_logs').insert({
          user_id: data.user.id,
          source: data.user.app_metadata?.provider || 'direct',
          action: 'signup',
        })
      }

      const rawRole = existing?.role ?? meta.role ?? (position === 'salon' ? 'owner' : position) ?? 'customer'
      const userRole = rawRole === 'salon' ? 'owner' : rawRole
      const finalPosition = userRole === 'owner' ? 'salon' : userRole
      return NextResponse.redirect(`${origin}/auth/done?position=${finalPosition}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
