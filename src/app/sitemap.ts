// ===== [사이트맵] 제품·발행 스토리 페이지 =====
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
  ]
}
