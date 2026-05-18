// ===== [사이트맵] 제품 페이지 자동 생성 =====
// 구글/네이버 서치콘솔 제출용
import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, updated_at')
    .eq('is_active', true)

  const productUrls = (products || []).map(p => ({
    url: `https://auran.kr/products/${p.id}`,
    lastModified: p.updated_at || new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: 'https://auran.kr',
      lastModified: new Date().toISOString(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    ...productUrls,
  ]
}
