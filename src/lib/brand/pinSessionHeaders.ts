/** 브라우저 PIN 게이트가 저장한 세션 토큰을 쓰기 API 요청에 붙인다. */
export function pinSessionHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) }
  try {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('brand_pin_token') : null
    if (t) headers['x-brand-pin-token'] = t
  } catch {
    /* sessionStorage 불가 환경 */
  }
  return headers
}
