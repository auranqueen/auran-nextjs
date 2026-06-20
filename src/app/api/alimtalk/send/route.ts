import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPpurioAlimtalk } from '@/lib/ppurio/sendAlimtalk'
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const { data: u } = await supabase.from('users').select('role').eq('auth_id', user.id).maybeSingle()
  if (!['admin','super_admin'].includes((u as any)?.role)) {
    const appRole = (user.app_metadata as any)?.role
    if (!['admin','super_admin'].includes(appRole)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
    }
  }
  const body = await req.json().catch(() => ({}))
  const phone = String(body?.phone || '').replace(/[^0-9]/g, '')
  const message = String(body?.message || '').trim()
  const title = String(body?.title || 'AURAN 오렌')
  if (!phone || phone.length < 10) return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  if (!message) return NextResponse.json({ ok: false, error: 'missing_message' }, { status: 400 })
  try {
    await sendPpurioAlimtalk({ phone, message, title })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'send_failed' }, { status: 500 })
  }
}
