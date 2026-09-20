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
  const { owner_id } = await req.json().catch(() => ({}))
  if (!owner_id) return NextResponse.json({ error: 'missing owner_id' }, { status: 400 })
  await svc.from('profiles').update({ owner_is_suspended: true }).eq('id', owner_id)
  return NextResponse.json({ ok: true })
}
