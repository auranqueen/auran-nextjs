import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateServiceClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const { owner_id, report_id, reason, warning_count } = body
  if (!owner_id) return NextResponse.json({ error: 'missing owner_id' }, { status: 400 })
  await svc.from('owner_warnings').insert({ owner_id, report_id, reason })
  await svc.from('profiles').update({ owner_warning_count: warning_count }).eq('id', owner_id)
  const { data: u } = await svc.from('users').select('id').eq('id', owner_id).maybeSingle()
  if (u?.id) {
    await svc.from('notifications').insert({
      user_id: u.id,
      type: 'promo',
      title: '⚠️ 경고가 발송됐어요',
      body: `사유: ${reason}\n3회 누적 시 자격 정지됩니다`,
      icon: '⚠️',
      is_read: false,
    })
  }
  return NextResponse.json({ ok: true })
}
