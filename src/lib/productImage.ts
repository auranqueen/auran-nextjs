/** 상품 썸네일 URL 정규화 (프로토콜 상대 URL 등) */
export function normalizeProductThumbUrl(url: string | null | undefined): string | null {
  if (url == null) return null
  const u = String(url).trim()
  if (!u) return null
  if (u.startsWith('//')) return `https:${u}`
  return u
}

/** detail_imgs / detail_images 배열에서 유효한 URL 목록 */
export function productDetailImageUrls(product: {
  detail_imgs?: unknown
  detail_images?: unknown
}): string[] {
  const a = product.detail_imgs
  const b = product.detail_images
  const raw = Array.isArray(a) && a.length ? a : Array.isArray(b) && b.length ? b : []
  const out: string[] = []
  for (const item of raw) {
    const n = normalizeProductThumbUrl(item == null ? null : String(item))
    if (n) out.push(n)
  }
  return out
}

function firstDetailImageUrl(product: { detail_imgs?: unknown; detail_images?: unknown }): string | null {
  const urls = productDetailImageUrls(product)
  return urls[0] ?? null
}

/**
 * 목록/히어로용: 썸네일이 없으면 storage 또는 상세 이미지 첫 장(실제 DB URL만 사용)
 */
export function productDisplayImageUrl(product: {
  thumb_img?: unknown
  storage_thumb_url?: unknown
  detail_imgs?: unknown
  detail_images?: unknown
}): string | null {
  const t = normalizeProductThumbUrl(product.thumb_img as string | null | undefined)
  if (t) return t
  const s = normalizeProductThumbUrl(product.storage_thumb_url as string | null | undefined)
  if (s) return s
  return firstDetailImageUrl(product)
}
