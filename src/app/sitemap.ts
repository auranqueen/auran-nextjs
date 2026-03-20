import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('products').select('id,updated_at').eq('status', 'active')
  const productUrls = (data || []).map((p: any) => ({
    url: `https://auran.kr/products/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))
  return [{ url: 'https://auran.kr', lastModified: new Date(), priority: 1 }, ...productUrls]
}
