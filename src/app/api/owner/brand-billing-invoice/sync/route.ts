import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'
import { calcPouchTier } from '@/lib/brand/brandBilling'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'not_logged_in' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const billingMonth = typeof body?.billing_month === 'string' ? body.billing_month.trim() : ''
  const totalAmount = Math.trunc(Number(body?.total_amount) || 0)
  const pointsTotal = Math.trunc(Number(body?.points_total) || 0)
  const pouchBasisAmountRaw = body?.pouch_basis_amount
  const pouchBasisAmount = pouchBasisAmountRaw === undefined || pouchBasisAmountRaw === null
    ? totalAmount
    : Math.trunc(Number(pouchBasisAmountRaw) || 0)

  if (!companyId || !billingMonth) {
    return NextResponse.json({ ok: false, error: 'company_id_and_billing_month_required' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) return NextResponse.json({ ok: false, error: 'profile_missing' }, { status: 400 })

  const svc = tryCreateServiceClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const pouchTier = calcPouchTier(pouchBasisAmount)

  const { data: row, error } = await svc
    .from('brand_billing_invoices')
    .upsert(
      {
        company_id: companyId,
        owner_id: profile.id,
        billing_month: billingMonth,
        total_amount: totalAmount,
        points_total: pointsTotal,
        pouch_tier: pouchTier,
      },
      { onConflict: 'company_id,owner_id,billing_month' },
    )
    .select('id, company_id, owner_id, billing_month, total_amount, points_total, pouch_tier, pouch_sent_qty, pouch_sent_note, status, paid_at')
    .single()

  if (error || !row) {
    return NextResponse.json({ ok: false, error: error?.message || 'upsert_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, invoice: row })
}
