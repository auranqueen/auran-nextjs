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
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id.trim() : ''
  const items = Array.isArray(body?.items) ? body.items : null
  const subtotal = Math.trunc(Number(body?.subtotal) || 0)
  const finalAmount = Math.trunc(Number(body?.final_amount) || 0)
  const ownerName =
    typeof body?.owner_name === 'string' && body.owner_name.trim()
      ? body.owner_name.trim()
      : String(profile.full_name || userRow.name || '원장님')
  const salonName =
    typeof body?.salon_name === 'string' && body.salon_name.trim()
      ? body.salon_name.trim()
      : String(profile.owner_store_name || userRow.salon_name || '')

  if (!brandId || !items || items.length === 0 || finalAmount < 1000) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
  }

  const { data: order, error } = await svc
    .from('hq_stock_orders')
    .insert({
      brand_id: brandId,
      profile_id: profile.id,
      status: '결제대기',
      items,
      subtotal,
      final_amount: finalAmount,
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

  return NextResponse.json({
    ok: true,
    order_id: order.id,
    final_amount: order.final_amount,
    status: order.status,
  })
}
