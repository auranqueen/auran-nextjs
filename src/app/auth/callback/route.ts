import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const role = url.searchParams.get('role') || 'customer'
  const origin = url.origin

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // users 테이블 upsert
      const { data: existing } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_id', data.user.id)
        .single()

      if (!existing) {
        const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase()
        await supabase.from('users').insert({
          auth_id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '사용자',
          avatar_url: data.user.user_metadata?.avatar_url,
          role,
          provider: data.user.app_metadata?.provider || 'email',
          referral_code: referralCode,
          status: 'active',
          points: 0,
          charge_balance: 0,
        })
        // 트래픽 로그
        await supabase.from('traffic_logs').insert({
          user_id: data.user.id,
          source: data.user.app_metadata?.provider || 'direct',
          action: 'signup',
        })
      }

      const userRole = existing?.role || role
      if (userRole === 'admin') return NextResponse.redirect(`${origin}/admin`)
      return NextResponse.redirect(`${origin}/dashboard/${userRole}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
