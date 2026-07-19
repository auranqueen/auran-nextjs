import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export const dynamic = 'force-dynamic'

// 트랙A 전용: 생성 3시간 지난 '결제대기' brand_product_orders 자동 취소
const CUTOFF_HOURS = 3 // 트랙A 전용 운영 임계치 (하드코딩, 트랙B와 무관)

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

  const cutoffIso = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await service
    .from('brand_product_orders')
    .update({ status: '취소' })
    .eq('status', '결제대기')          // 트랙A + 결제대기만
    .lt('created_at', cutoffIso)      // 3시간 안전 마진
    .select('id')                     // 취소 건수 확인용

  if (error) return json({ ok: false, error: error.message }, 500)
  return json({ ok: true, cancelled: data?.length ?? 0 })
}
