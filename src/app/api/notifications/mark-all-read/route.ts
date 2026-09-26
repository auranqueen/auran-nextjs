import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { data: uRow } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!uRow?.id) return NextResponse.json({ ok: false }, { status: 404 })

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', uRow.id)
    .eq('is_read', false)
    .neq('type', 'toast')

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}