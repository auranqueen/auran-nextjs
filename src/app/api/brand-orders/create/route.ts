import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import { insertBrandOrder } from '@/lib/brand/insertBrandOrder'

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

  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ ok: false, error: 'profile_missing', message: '프로필이 없습니다' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id.trim() : ''
  const profileId = typeof body?.profile_id === 'string' ? body.profile_id.trim() : ''
  const ownerName = typeof body?.owner_name === 'string' ? body.owner_name : ''
  const salonName = typeof body?.salon_name === 'string' ? body.salon_name : ''
  const grade = typeof body?.grade === 'string' ? body.grade : ''
  const items = Array.isArray(body?.items) ? body.items : null
  const totalQty = Math.trunc(Number(body?.total_qty) || 0)
  const totalAmount = Math.trunc(Number(body?.total_amount) || 0)
  const promoApplied = body?.promo_applied == null ? null : String(body.promo_applied)
  const pointsEarned = Math.trunc(Number(body?.points_earned) || 0)

  if (!brandId || !profileId || !items || items.length === 0) {
    return NextResponse.json({ ok: false, error: 'invalid_request', message: '잘못된 요청입니다' }, { status: 400 })
  }
  if (profileId !== profile.id) {
    return NextResponse.json({ ok: false, error: 'profile_mismatch', message: '프로필이 일치하지 않습니다' }, { status: 403 })
  }

  const result = await insertBrandOrder(svc, {
    brand_id: brandId,
    profile_id: profileId,
    owner_name: ownerName,
    salon_name: salonName,
    grade,
    items,
    total_qty: totalQty,
    total_amount: totalAmount,
    promo_applied: promoApplied,
    points_earned: pointsEarned,
  })

  if (!result.ok) {
    const status = result.error === 'unpaid_invoice' ? 403 : 500
    return NextResponse.json(
      { ok: false, error: result.error, message: result.message },
      { status },
    )
  }

  return NextResponse.json({ ok: true, order_id: result.order_id })
}
