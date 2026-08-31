import { NextRequest, NextResponse } from 'next/server'
import { tryCreateServiceClient } from '@/lib/supabase/service'

function todayMonthDate() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')
  if (secret && auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const svc = tryCreateServiceClient()
  if (!svc) return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 500 })

  const billingMonth = todayMonthDate()
  let invoicesCreated = 0
  const errors: string[] = []

  const { data: companies } = await svc.from('brand_companies').select('id')
  for (const company of (companies || []) as { id: string }[]) {
    const companyId = company.id
    const { data: members } = await svc
      .from('brand_arete_members')
      .select('owner_id')
      .eq('company_id', companyId)
      .eq('status', 'active')

    for (const m of (members || []) as { owner_id: string }[]) {
      const ownerId = m.owner_id
      const { data: existing } = await svc
        .from('brand_arete_invoices')
        .select('id')
        .eq('company_id', companyId)
        .eq('owner_id', ownerId)
        .eq('billing_month', billingMonth)
        .maybeSingle()
      if (existing?.id) continue

      const { error: invErr } = await svc.from('brand_arete_invoices').insert({
        company_id: companyId,
        owner_id: ownerId,
        billing_month: billingMonth,
        amount: 1000000,
        status: 'unpaid',
      })
      if (invErr) {
        errors.push(`invoice ${companyId}/${ownerId}: ${invErr.message}`)
        continue
      }
      invoicesCreated += 1
    }
  }

  return NextResponse.json({
    ok: true,
    billing_month: billingMonth,
    invoices_created: invoicesCreated,
    errors,
  })
}
