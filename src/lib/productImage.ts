/** 상품 썸네일 URL 정규화 (프로토콜 상대 URL 등) */
export function normalizeProductThumbUrl(url: string | null | undefined): string | null {
  if (url == null) return null
  const u = String(url).trim()
  if (!u) return null
  if (u.startsWith('//')) return `https:${u}`
  return u
}
