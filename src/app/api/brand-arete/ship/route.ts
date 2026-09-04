import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { notifyOwners } from '@/lib/brand/notifyOwners'
import { decrementStockForAreteItem, parseKitSnapshot, restoreAreteDecrements, type AppliedDecrement } from './decrementStock'

function monthKey(raw: string) {
  return String(raw || '').slice(0, 10)
}

function fail(status: number, error: string, message: string) {
  return NextResponse.json({ ok: false, error, message }, { status })
}

async function assertCompanyAccess(
  supabase: ReturnType<typeof createClient>,
  userPk: string,
  companyId: string,
) {
  const { data: companyBrands } = await supabase
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
  const brandIds = (companyBrands || []).map((b: { id: string }) => b.id)
  if (brandIds.length === 0) return false
  const { data: members } = await supabase
    .from('brand_members')
    .select('brand_id')
    .eq('user_id', userPk)
    .in('brand_id', brandIds)
    .limit(1)
  if (members && members.length > 0) return true
  const { data: owned } = await supabase
    .from('brands')
    .select('id')
    .in('id', brandIds)
    .eq('user_id', userPk)
    .limit(1)
  return Boolean(owned && owned.length > 0)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail(401, 'unauthorized', '로그인이 필요합니다')

  const svc = tryCreateAdminClient()
  if (!svc) return fail(500, 'service_unavailable', '서버 오류')

  const body = await req.json().catch(() => ({}))
  const invoiceId = typeof body?.invoice_id === 'string' ? body.invoice_id.trim() : ''
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const courier = typeof body?.courier === 'string' ? body.courier.trim() : ''
  const trackingNo = typeof body?.tracking_no === 'string' ? body.tracking_no.trim() : ''
  if (!invoiceId || !companyId || !courier || !trackingNo) {
    return fail(400, 'missing_fields', '택배사와 운송장 번호를 입력해주세요')
  }

  const { data: me } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!me?.id || (me.role !== 'brand' && me.role !== 'ops')) {
    return fail(403, 'forbidden_role', '발송 권한이 없어요')
  }
  const allowed = await assertCompanyAccess(supabase, me.id, companyId)
  if (!allowed) return fail(403, 'forbidden_company', '해당 브랜드 권한이 없어요')

  const { data: invoice } = await svc
    .from('brand_arete_invoices')
    .select('id, company_id, owner_id, billing_month, status, ship_status')
    .eq('id', invoiceId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!invoice?.id) return fail(404, 'invoice_not_found', '인보이스를 찾을 수 없어요')
  if (invoice.status !== 'paid') return fail(400, 'not_paid', '결제 완료된 인보이스만 발송할 수 있어요')
  if (invoice.ship_status) return fail(400, 'already_shipped', '이미 발송 처리됐거나 승인 상태가 아니에요')

  const month = monthKey(String(invoice.billing_month || ''))
  const { data: bundleRow } = await svc
    .from('brand_arete_monthly_bundles')
    .select('items')
    .eq('company_id', companyId)
    .eq('billing_month', month)
    .maybeSingle()
  const kit = parseKitSnapshot((bundleRow as { items?: unknown } | null)?.items)
  if (!kit.length) {
    return fail(400, 'bundle_empty', '해당 월 아레테 번들 구성이 없어요. 먼저 구성을 저장하세요.')
  }

  const { data: brandRow } = await svc
    .from('brands')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()
  if (!brandRow?.id) return fail(400, 'brand_missing', '브랜드 정보를 찾을 수 없어요')
  const repBrandId = String(brandRow.id)

  const applied: AppliedDecrement[] = []
  for (const item of kit) {
    const row = await decrementStockForAreteItem(svc, repBrandId, invoice.id, item)
    if (row) applied.push(row)
  }

  const now = new Date().toISOString()
  const { data: updated, error: updErr } = await svc
    .from('brand_arete_invoices')
    .update({
      kit_snapshot: kit,
      ship_status: 'shipped',
      tracking_no: trackingNo,
      courier,
      shipped_at: now,
    })
    .eq('id', invoice.id)
    .eq('status', 'paid')
    .is('ship_status', null)
    .select('id')
    .maybeSingle()

  if (updErr || !updated?.id) {
    await restoreAreteDecrements(svc, invoice.id, applied)
    return fail(400, 'update_failed', '발송 처리 실패, 재고는 복구됐어요')
  }

  const kitSummary = kit.map((k) => `${k.name || ''}×${k.qty || 0}`).join(', ')
  await notifyOwners(svc, {
    companyId,
    target: { type: 'one', ownerId: String(invoice.owner_id) },
    title: '아레테 월간번들 발송 안내',
    body: `아레테 월간번들이 발송됐어요. 택배사: ${courier} · 운송장: ${trackingNo}${kitSummary ? ` · 구성: ${kitSummary}` : ''}`,
  })

  return NextResponse.json({ ok: true })
}
