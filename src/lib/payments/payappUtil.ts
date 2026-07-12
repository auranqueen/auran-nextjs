export const PAYAPP_API_URL = 'https://api.payapp.kr/oapi/apiLoad.html'

export function formEncode(input: Record<string, string>): string {
  return new URLSearchParams(input).toString()
}

export function parsePayAppResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const trimmed = (text || '').trim()
  const qs = new URLSearchParams(trimmed)
  qs.forEach((v, k) => {
    out[k] = v
  })
  return out
}
