import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!code) {
    return NextResponse.json({ ok: true, referrerId: null })
  }

  const svc = tryCreateServiceClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })
  }

  const { data: linkRow } = await svc
    .from('invite_links')
    .select('created_by')
    .eq('code', code)
    .maybeSingle()

  if (linkRow?.created_by) {
    return NextResponse.json({ ok: true, referrerId: String(linkRow.created_by) })
  }

  const { data: refUser } = await svc
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle()

  return NextResponse.json({ ok: true, referrerId: refUser?.id ? String(refUser.id) : null })
}
