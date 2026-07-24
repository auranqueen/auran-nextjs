/**
 * DeliveryAPI (deliveryapi.co.kr) 서버 전용 클라이언트.
 *
 * 문서상 추적 구독 엔드포인트는 POST /v1/webhooks/register 입니다.
 * (요청에 언급된 /v1/tracking/subscribe 는 공개 문서에 없음 → register 사용)
 */

const API_BASE = 'https://api.deliveryapi.co.kr'

export const COURIER_CODE_MAP: Record<string, string> = {
  CJ대한통운: 'cj',
  한진: 'hanjin',
  로젠: 'logen',
  우체국: 'post',
  롯데: 'lotte',
}

export function toCourierCode(courierLabelOrCode: string): string {
  const raw = courierLabelOrCode.trim()
  if (COURIER_CODE_MAP[raw]) return COURIER_CODE_MAP[raw]
  const lower = raw.toLowerCase()
  if (['cj', 'hanjin', 'logen', 'post', 'lotte'].includes(lower)) return lower
  return lower
}

function authHeader(): string {
  const key = process.env.DELIVERY_API_KEY?.trim()
  const secret = process.env.DELIVERY_API_SECRET?.trim()
  if (!key || !secret) {
    throw new Error('DELIVERY_API_KEY / DELIVERY_API_SECRET 미설정')
  }
  return `Bearer ${key}:${secret}`
}

async function deliveryFetch(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (json as { message?: string; error?: string })?.message
      || (json as { error?: string })?.error
      || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json as Record<string, unknown>
}

/** 웹훅 수신 URL을 DeliveryAPI에 엔드포인트로 등록하고 endpointId 반환 */
async function ensureWebhookEndpoint(callbackUrl: string): Promise<string> {
  const cached = process.env.DELIVERY_WEBHOOK_ENDPOINT_ID?.trim()
  if (cached) return cached

  const json = await deliveryFetch('/v1/webhooks/endpoints', { url: callbackUrl })
  const data = (json.data || json) as { endpointId?: string }
  const endpointId = data.endpointId
  if (!endpointId) throw new Error('웹훅 엔드포인트 등록 실패: endpointId 없음')
  return endpointId
}

export type SubscribeTrackingResult = {
  ok: boolean
  requestId?: string
  endpointId?: string
  error?: string
}

/**
 * 운송장 배송상태 변경 웹훅 구독 등록.
 * @param courierCode DeliveryAPI 코드 (cj, hanjin, …) 또는 한글 택배사명
 * @param trackingNumber 운송장 번호
 * @param callbackUrl 웹훅 수신 전체 URL (예: https://auran.kr/api/webhooks/delivery-status)
 * @param clientId 선택 — 웹훅 페이로드에 함께 전달 (주문 id 등)
 */
export async function subscribeTracking(
  courierCode: string,
  trackingNumber: string,
  callbackUrl: string,
  clientId?: string,
): Promise<SubscribeTrackingResult> {
  try {
    const code = toCourierCode(courierCode)
    const endpointId = await ensureWebhookEndpoint(callbackUrl)
    const json = await deliveryFetch('/v1/webhooks/register', {
      endpointId,
      recurring: true,
      items: [
        {
          courierCode: code,
          trackingNumber: trackingNumber.trim(),
          ...(clientId ? { clientId } : {}),
        },
      ],
      ...(clientId ? { metadata: { orderId: clientId } } : {}),
    })
    const data = (json.data || json) as { requestId?: string; endpointId?: string }
    return {
      ok: true,
      requestId: data.requestId,
      endpointId: data.endpointId || endpointId,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
