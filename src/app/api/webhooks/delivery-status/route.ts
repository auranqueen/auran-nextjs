import { NextRequest, NextResponse } from 'next/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * DeliveryAPI 배송상태 웹훅 수신.
 *
 * 문서상 페이로드 예시 (tracking.polled / tracking.completed):
 * {
 *   event, requestId, timestamp,
 *   items: [{ courierCode, trackingNumber, clientId, currentStatus, isDelivered, hasChanged, ... }]
 * }
 * — 필드명이 문서 버전마다 다를 수 있어 방어적 파싱. 문서 재확인 필요.
 */

type WebhookItem = {
  courierCode?: string
  trackingNumber?: string
  tracking_number?: string
  clientId?: string
  currentStatus?: string
  deliveryStatus?: string
  deliveryStatusText?: string
  isDelivered?: boolean
  hasChanged?: boolean
  trackingData?: {
    isDelivered?: boolean
    deliveryStatus?: string
    deliveryStatusText?: string
  }
}

function isDeliveredItem(item: WebhookItem): boolean {
  if (item.isDelivered === true) return true
  if (item.trackingData?.isDelivered === true) return true
  const status = String(
    item.currentStatus || item.deliveryStatus || item.trackingData?.deliveryStatus || '',
  ).toUpperCase()
  if (status === 'DELIVERED') return true
  const text = String(
    item.deliveryStatusText || item.trackingData?.deliveryStatusText || '',
  )
  if (text.includes('배송완료') || text.includes('배달완료')) return true
  return false
}

function trackingOf(item: WebhookItem): string {
  return String(item.trackingNumber || item.tracking_number || '').trim()
}

export async function POST(req: NextRequest) {
  // 문서 재확인 필요: X-Webhook-Signature HMAC 검증 (DELIVERY_WEBHOOK_SECRET)
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 })
  }

  const admin = tryCreateAdminClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: 'service_unavailable' }, { status: 503 })
  }

  const items: WebhookItem[] = Array.isArray((body as { items?: unknown }).items)
    ? ((body as { items: WebhookItem[] }).items)
    : []

  // 단일 객체 형태로 오는 경우 대비 (문서 재확인 필요)
  if (items.length === 0 && (body as WebhookItem).trackingNumber) {
    items.push(body as WebhookItem)
  }

  const now = new Date().toISOString()
  const updated: string[] = []
  const errors: string[] = []

  for (const item of items) {
    if (!isDeliveredItem(item)) continue
    const trackingNo = trackingOf(item)
    if (!trackingNo) continue

    // 트랙A: brand_orders (shipping → done)
    const { data: brandOrder, error: aErr } = await admin
      .from('brand_orders')
      .select('id, status')
      .eq('tracking_no', trackingNo)
      .maybeSingle()
    if (aErr) errors.push(`A:${aErr.message}`)

    if (brandOrder?.id && brandOrder.status === 'shipping') {
      const { error } = await admin
        .from('brand_orders')
        .update({ status: 'done', updated_at: now })
        .eq('id', brandOrder.id)
      if (!error) updated.push(`A:${brandOrder.id}`)
      else errors.push(`A-update:${error.message}`)
      continue
    }

    // 트랙B: hq_stock_orders.tracking_no / courier 컬럼 존재 (confirmed)
    // 배송완료 → 구매확정
    const { data: hqOrder, error: hqErr } = await admin
      .from('hq_stock_orders')
      .select('id, status')
      .eq('tracking_no', trackingNo)
      .maybeSingle()
    if (hqErr) {
      errors.push(`B:${hqErr.message}`)
      continue
    }
    if (hqOrder?.id && hqOrder.status === '배송완료') {
      const { error } = await admin
        .from('hq_stock_orders')
        .update({ status: '구매확정', updated_at: now })
        .eq('id', hqOrder.id)
      if (!error) updated.push(`B:${hqOrder.id}`)
      else errors.push(`B-update:${error.message}`)
    }
  }

  return NextResponse.json({ ok: true, updated, ...(errors.length ? { errors } : {}) })
}
