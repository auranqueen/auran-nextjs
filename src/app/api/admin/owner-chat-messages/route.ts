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
  const { selected } = await req.json().catch(() => ({}))
  if (!selected) return NextResponse.json({ messages: [] })
  const { data: ch } = await svc.from('chat_channels').select('id').eq('user_id', selected).maybeSingle()
  if (!ch?.id) return NextResponse.json({ messages: [] })
  const { data: messages } = await svc.from('consultation_messages').select('*').eq('channel_id', ch.id).order('created_at', { ascending: true })
  return NextResponse.json({ messages: messages || [] })
}
