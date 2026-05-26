import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '삭제 실패' }, { status: 401 })
    }

    const userId = user.id
    const supabaseAdmin = createAdminClient()

    const { error: msgError } = await supabaseAdmin
      .from('consultation_messages')
      .delete()
      .eq('sender_id', userId)

    if (msgError) {
      return NextResponse.json({ error: '삭제 실패' })
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      return NextResponse.json({ error: '삭제 실패' })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: '삭제 실패' })
  }
}
