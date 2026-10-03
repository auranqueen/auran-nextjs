import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { action } = await req.json()
    if (action !== 'post_menopause' && action !== 'resume') {
      return NextResponse.json({ error: 'action 오류' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const updatedAt = new Date().toISOString()
    let hcPayload: Record<string, unknown>
    let profilePayload: Record<string, unknown>

    if (action === 'post_menopause') {
      const { data: hc, error: hcErr } = await supabase
        .from('hormone_cycle')
        .select('menopause_reason')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (hcErr) return NextResponse.json({ error: hcErr.message }, { status: 500 })
      hcPayload = { track: 'menopause_post', cycle_type: 'menopause', menopause_reason: hc?.menopause_reason ?? 'natural', updated_at: updatedAt }
      profilePayload = { cycle_type: 'menopause', hormone_cycle_applicable: false }
    } else {
      hcPayload = { track: 'general', cycle_type: 'menstrual', menopause_reason: null, updated_at: updatedAt }
      profilePayload = { cycle_type: 'menstrual', hormone_cycle_applicable: true }
    }

    const { error: hcUpdateErr } = await supabase.from('hormone_cycle').update(hcPayload).eq('auth_id', user.id)
    if (hcUpdateErr) return NextResponse.json({ error: hcUpdateErr.message }, { status: 500 })

    const { error: profileErr } = await supabase.from('profiles').update(profilePayload).eq('auth_id', user.id)
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}