import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const track = (req.nextUrl.searchParams.get('track') || '').trim()
  const companyId = (req.nextUrl.searchParams.get('company_id') || '').trim()

  if (!['REWARD', 'ARETE'].includes(track)) {
    return NextResponse.json({ ok: false, error: 'invalid_track' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_missing' }, { status: 400 })
  }

  const svc = tryCreateServiceClient()
  const db = svc ?? supabase

  let ledgerQ = db
    .from('brand_points_ledger')
    .select('id, company_id, owner_id, track, amount, balance_after, reason, source_type, created_at')
    .eq('owner_id', profile.id)
    .eq('track', track)
    .order('created_at', { ascending: false })
    .limit(100)

  if (companyId) {
    ledgerQ = ledgerQ.eq('company_id', companyId)
  }

  const { data: rows, error } = await ledgerQ
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  let balance = 0
  if (companyId) {
    const { data: pointRow } = await db
      .from('brand_points')
      .select('balance')
      .eq('company_id', companyId)
      .eq('owner_id', profile.id)
      .eq('track', track)
      .maybeSingle()
    balance = Math.trunc(Number((pointRow as { balance?: number } | null)?.balance) || 0)
  } else if ((rows || []).length > 0) {
    balance = Math.trunc(Number((rows as { balance_after?: number }[])[0]?.balance_after) || 0)
  }

  return NextResponse.json({ ok: true, balance, rows: rows || [] })
}
