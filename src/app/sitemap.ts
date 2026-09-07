// ===== [사이트맵] 제품·발행 스토리·매거진 페이지 =====
import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { tryCreateAdminClient } from '@/lib/supabase/admin'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient()

  const { data: products } = await supabase.from('products').select('id, updated_at').eq('is_active', true)

  const productUrls = (products || []).map((p) => ({
    url: `https://auran.kr/products/${p.id}`,
    lastModified: p.updated_at || new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  let storyUrls: MetadataRoute.Sitemap = []
  let magazineUrls: MetadataRoute.Sitemap = []
  const service = tryCreateAdminClient()
  if (service) {
    const { data: stories } = await service
      .from('brand_product_salon_story')
      .select('id, salon_id, updated_at, created_at')
      .eq('is_published', true)
    storyUrls = (stories || []).map((s) => ({
      url: `https://auran.kr/salons/${s.salon_id}/story/${s.id}`,
      lastModified: s.updated_at || s.created_at || new Date().toISOString(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    const { data: magazines } = await service
      .from('magazines')
      .select('id, slug, updated_at, published_at')
      .eq('is_published', true)
    magazineUrls = (magazines || []).map((m) => ({
      url: m.slug ? `https://auran.kr/magazine/${m.slug}` : `https://auran.kr/magazine/${m.id}`,
      lastModified: m.updated_at || m.published_at || new Date().toISOString(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  }

  return [
    {
      url: 'https://auran.kr',
      lastModified: new Date().toISOString(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    ...productUrls,
    ...storyUrls,
    ...magazineUrls,
  ]
}
