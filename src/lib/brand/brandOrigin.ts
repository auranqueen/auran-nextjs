/** 브랜드명 → origin_country (서버 전용) */
export const BRAND_ORIGIN_MAP: Record<string, string> = {
  '보케르케어': '독일',
}

const DEFAULT_ORIGIN = '대한민국'

export function resolveBrandOriginCountry(brandName: string | null | undefined): string {
  const key = String(brandName || '').trim()
  if (!key) return DEFAULT_ORIGIN
  return BRAND_ORIGIN_MAP[key] ?? DEFAULT_ORIGIN
}
