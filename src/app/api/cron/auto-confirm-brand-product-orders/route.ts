import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export const dynamic = 'force-dynamic'

// 트랙A 전용: auto_confirm_at 지난 '배송완료' brand_product_orders 자동 구매확정
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  const qSecret = req.nextUrl.searchParams.get('secret') || ''
  const secret = bearer || qSecret

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CRON_SECRET) return json({ ok: false, error: 'CRON_SECRET not configured' }, 503)
    if (secret !== process.env.CRON_SECRET) return json({ ok: false, error: 'unauthorized' }, 401)
  } else if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const service = tryCreateAdminClient()
  if (!service) return json({ ok: false, error: 'service_unavailable' }, 503)

  const nowIso = new Date().toISOString()

  const { data, error } = await service
    .from('brand_product_orders')
    .update({ status: '구매확정', confirmed_at: nowIso })
    .eq('status', '배송완료')          // 트랙A + 배송완료만
    .lt('auto_confirm_at', nowIso)     // 자동확정 예정시각 경과
    .select('id')                      // 확정 건수 확인용

  if (error) return json({ ok: false, error: error.message }, 500)
  return json({ ok: true, confirmed: data?.length ?? 0 })
}
