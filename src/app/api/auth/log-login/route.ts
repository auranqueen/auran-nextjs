import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email : null
    let role = typeof body.role === 'string' ? body.role : null
    if (role === 'salon') role = 'owner'
    let provider = typeof body.provider === 'string' ? body.provider : 'email'
    if (provider === 'password') provider = 'email'
    const status = body.status === 'failed' ? 'failed' : 'success'
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null
    const userAgent = req.headers.get('user-agent') || null

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let userId: string | null = null
    if (user?.id) {
      const { data: row } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      userId = (row as { id?: string } | null)?.id ?? null
    }

    await supabase.from('login_logs').insert({
      user_id: userId,
      email,
      role,
      provider,
      ip_address: ip,
      user_agent: userAgent,
      status,
    } as any)
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true })
}
