import { NextRequest, NextResponse } from 'next/server'
import { subscribeTracking, toCourierCode } from '@/lib/delivery/deliveryApiClient'

export const runtime = 'nodejs'

/**
 * 클라이언트(발송 처리 UI)에서 운송장 저장 직후 호출.
 * 시크릿 키는 서버에서만 사용.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const courier = typeof body?.courier === 'string' ? body.courier.trim() : ''
    const trackingNumber = typeof body?.trackingNumber === 'string' ? body.trackingNumber.trim() : ''
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : undefined
    if (!courier || !trackingNumber) {
      return NextResponse.json({ ok: false, error: 'courier_and_tracking_required' }, { status: 400 })
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    if (!appUrl) {
      return NextResponse.json({ ok: false, error: 'NEXT_PUBLIC_APP_URL_missing' }, { status: 500 })
    }
    const callbackUrl = `${appUrl}/api/webhooks/delivery-status`

    const result = await subscribeTracking(
      toCourierCode(courier),
      trackingNumber,
      callbackUrl,
      orderId,
    )
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || 'subscribe_failed' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, requestId: result.requestId, endpointId: result.endpointId })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
