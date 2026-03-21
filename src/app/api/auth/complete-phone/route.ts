import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ ok: false, reason: 'not_logged_in' }, 401)

  const body = await req.json().catch(() => ({}))
  const raw = typeof body?.phone === 'string' ? body.phone : ''
  const phone = raw.replace(/\D/g, '')
  if (phone.length < 10 || phone.length > 15) return json({ ok: false, error: 'invalid_phone' }, 400)

  const { error } = await supabase.from('users').update({ phone }).eq('auth_id', user.id)
  if (error) return json({ ok: false, error: error.message }, 500)

  const { sendSignupAlimtalkIfNeeded } = await import('@/lib/signup/sendSignupAlimtalk')
  await sendSignupAlimtalkIfNeeded(user.id)

  return json({ ok: true })
}
