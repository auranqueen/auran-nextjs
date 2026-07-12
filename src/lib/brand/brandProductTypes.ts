export type BrandProductEventBanner = {
  emoji?: string | null
  title?: string | null
  desc?: string | null
  starts_at?: string | null
  ends_at?: string | null
  image_url?: string | null
}

export type BrandProductSaveBody = {
  id?: string
  name: string
  supply_price: number
  description?: string | null
  thumb_img?: string | null
  images?: string[]
  status: string
  category_id?: string | null
  category?: string | null
  tag?: string | null
  event_banner?: BrandProductEventBanner | null
  ingredient_main?: string | null
  ingredient_full?: string | null
  detail_content?: string | null
  detail_images?: string[]
  skin_concern?: string[]
  skin_type?: string[]
}

export type BrandProductRow = BrandProductSaveBody & {
  id: string
  brand_id: string
  brand_user_id: string
  origin_country: string
  created_at?: string
  updated_at?: string
}

export function buildEventBanner(input: {
  emoji?: string | null
  title?: string | null
  desc?: string | null
  starts_at?: string | null
  ends_at?: string | null
  image_url?: string | null
}): BrandProductEventBanner | null {
  const banner = {
    emoji: input.emoji?.trim() || null,
    title: input.title?.trim() || null,
    desc: input.desc?.trim() || null,
    starts_at: input.starts_at?.trim() || null,
    ends_at: input.ends_at?.trim() || null,
    image_url: input.image_url?.trim() || null,
  }
  return Object.values(banner).some(Boolean) ? banner : null
}

export function parseEventBanner(raw: unknown): BrandProductEventBanner | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as BrandProductEventBanner
  return {
    emoji: b.emoji ?? null,
    title: b.title ?? null,
    desc: b.desc ?? null,
    starts_at: b.starts_at ?? null,
    ends_at: b.ends_at ?? null,
    image_url: b.image_url ?? null,
  }
}

export function stringArrayOrEmpty(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean)
}
