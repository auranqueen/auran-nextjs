import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'unauthorized', message: '로그인이 필요합니다' }, { status: 401 })
  }

  const svc = tryCreateAdminClient()
  if (!svc) {
    return NextResponse.json({ ok: false, error: 'service_unavailable', message: '서버 오류' }, { status: 500 })
  }

  const { data: userRow } = await svc
    .from('users')
    .select('id, origin_track, name, salon_name')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!userRow?.id || userRow.origin_track !== 'B') {
    return NextResponse.json({ ok: false, error: 'track_b_only', message: '트랙B 원장만 이용할 수 있어요' }, { status: 403 })
  }

  const { data: profile } = await supabase.from('profiles').select('id, full_name, owner_store_name').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const companyId = typeof body?.company_id === 'string' ? body.company_id.trim() : ''
  const lines = Array.isArray(body?.lines) ? body.lines : []
  const clientSubtotal = Math.trunc(Number(body?.subtotal) || 0)
  const clientFinalAmount = Math.trunc(Number(body?.final_amount) || 0)
  const ownerName =
    typeof body?.owner_name === 'string' && body.owner_name.trim()
      ? body.owner_name.trim()
      : String(profile.full_name || userRow.name || '원장님')
  const salonName =
    typeof body?.salon_name === 'string' && body.salon_name.trim()
      ? body.salon_name.trim()
      : String(profile.owner_store_name || userRow.salon_name || '')

  if (!companyId || lines.length === 0 || clientFinalAmount < 1000) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
  }

  for (const line of lines) {
    if (!line?.brand_id || !Array.isArray(line.items) || line.items.length === 0) {
      return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
    }
  }

  const lineBrandIds = Array.from(new Set(lines.map((l: { brand_id?: string }) => String(l.brand_id || '')).filter(Boolean)))
  const { data: brandCheckRows } = await svc
    .from('brands')
    .select('id, company_id')
    .in('id', lineBrandIds)
  if (!brandCheckRows || brandCheckRows.length !== lineBrandIds.length) {
    return NextResponse.json({ ok: false, error: 'invalid_brand', message: '브랜드 정보가 올바르지 않습니다' }, { status: 400 })
  }
  const invalidBrand = brandCheckRows.some((b) => String(b.company_id || '') !== companyId)
  if (invalidBrand) {
    return NextResponse.json({ ok: false, error: 'invalid_brand', message: '브랜드 정보가 올바르지 않습니다' }, { status: 400 })
  }

  const rawLineTotal = lines.reduce((s: number, l: any) => s + Math.trunc(Number(l.line_amount) || 0), 0)
  const expectedFinal = rawLineTotal
  if (Math.abs(expectedFinal - clientFinalAmount) > 10) {
    return NextResponse.json({ ok: false, error: 'amount_mismatch' }, { status: 400 })
  }

  // brand_id NOT NULL 스키마 호환: 대표 브랜드 = 첫 line (실제 라인은 hq_stock_order_lines)
  const primaryBrandId = String(lines[0].brand_id)
  const flatItems = lines.flatMap((l: any) => (Array.isArray(l.items) ? l.items : []))

  const { data: order, error } = await svc
    .from('hq_stock_orders')
    .insert({
      brand_id: primaryBrandId,
      company_id: companyId,
      profile_id: profile.id,
      status: '결제대기',
      items: flatItems,
      subtotal: clientSubtotal,
      final_amount: clientFinalAmount,
      owner_name: ownerName,
      salon_name: salonName,
    })
    .select('id, final_amount, status')
    .single()

  if (error || !order?.id) {
    return NextResponse.json(
      { ok: false, error: 'insert_failed', message: error?.message || '발주 생성 실패' },
      { status: 500 },
    )
  }

  for (const line of lines) {
    const { error: lineErr } = await svc.from('hq_stock_order_lines').insert({
      order_id: order.id,
      brand_id: String(line.brand_id),
      items: line.items,
      line_amount: Math.trunc(Number(line.line_amount) || 0),
      status: '결제대기',
    })
    if (lineErr) {
      await svc.from('hq_stock_order_lines').delete().eq('order_id', order.id)
      await svc.from('hq_stock_orders').delete().eq('id', order.id)
      return NextResponse.json(
        { ok: false, error: 'line_insert_failed', message: lineErr.message || '라인 생성 실패' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    ok: true,
    order_id: order.id,
    final_amount: order.final_amount,
    status: order.status,
  })
}
