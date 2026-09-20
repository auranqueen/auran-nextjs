import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const svc = tryCreateServiceClient() ?? supabase
  const { data: profile } = await svc.from('profiles').select('role').eq('auth_id', user.id).maybeSingle()
  if ((profile as any)?.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { data: me } = await svc.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  const { data: owners } = await svc.from('users').select('id,name,email').eq('role', 'owner').eq('status', 'active')
  return NextResponse.json({ myId: (me as any)?.id || null, owners: owners || [] })
}
