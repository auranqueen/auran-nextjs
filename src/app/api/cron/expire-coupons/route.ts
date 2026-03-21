import { NextRequest, NextResponse } from 'next/server'
import { expireUnusedCouponsPastEnd } from '@/lib/coupon/expireUserCoupons'

function json(data: object, status = 200) {
  return NextResponse.json(data, { status })
}

export const dynamic = 'force-dynamic'

/**
 * 만료된 쿠폰 템플릿에 묶인 미사용 user_coupons → status expired
 * Vercel Cron 또는 수동 호출: Authorization: Bearer $CRON_SECRET
 */
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

  const { updated } = await expireUnusedCouponsPastEnd()
  return json({ ok: true, updated })
}
