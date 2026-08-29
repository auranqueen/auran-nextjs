import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const companyId = (req.nextUrl.searchParams.get('company_id') || '').trim()
  if (!companyId) {
    return NextResponse.json({ ok: false, error: 'missing_company' }, { status: 400 })
  }

  const { data: me } = await supabase.from('users').select('id, role').eq('auth_id', user.id).maybeSingle()
  if (!me?.id || me.role !== 'owner') {
    return NextResponse.json({ ok: false, error: 'owner_only' }, { status: 403 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  const { data: profile } = await db.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_not_found' }, { status: 404 })
  }

  const { data: member } = await db
    .from('brand_arete_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('owner_id', profile.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!member?.id) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const now = new Date()
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const { data: guide, error } = await db
    .from('brand_arete_guide_images')
    .select('image_url, title')
    .eq('company_id', companyId)
    .eq('billing_month', billingMonth)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, guide: guide || null })
}