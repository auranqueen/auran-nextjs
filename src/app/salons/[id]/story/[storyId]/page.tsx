import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { tryCreateAdminClient } from '@/lib/supabase/admin'
import StoryDetailClient, { type StoryDetailData } from './StoryDetailClient'

function stripHtml(html: string) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadStory(salonId: string, storyId: string): Promise<StoryDetailData | null> {
  const service = tryCreateAdminClient()
  if (!service) return null

  const { data: story } = await service
    .from('brand_product_salon_story')
    .select(
      'id, salon_id, story_type, title, content, banner_image_url_pc, banner_image_url_mobile, is_published, created_at',
    )
    .eq('id', storyId)
    .eq('salon_id', salonId)
    .eq('is_published', true)
    .maybeSingle()

  if (!story) return null

  const { data: salon } = await service.from('salons').select('id, name').eq('id', salonId).maybeSingle()

  let products: StoryDetailData['products'] = []
  if (story.story_type === 'homecare') {
    const { data: links } = await service
      .from('brand_product_salon_story_products')
      .select('brand_product_id, display_order')
      .eq('story_id', storyId)
      .order('display_order', { ascending: true })
    const productIds = ((links as any[]) || []).map((l) => String(l.brand_product_id)).filter(Boolean)
    if (productIds.length) {
      const { data: rows } = await service
        .from('brand_products')
        .select('id, brand_id, name, thumb_img, consumer_price, customer_toast_rate')
        .in('id', productIds)
        .eq('status', 'active')
      products = productIds
        .map((pid) => ((rows as any[]) || []).find((r) => String(r.id) === pid))
        .filter(Boolean)
        .map((r: any) => ({
          id: String(r.id),
          brand_id: String(r.brand_id),
          name: String(r.name || ''),
          thumb_img: r.thumb_img ?? null,
          consumer_price: r.consumer_price != null ? Number(r.consumer_price) : null,
          customer_toast_rate: r.customer_toast_rate != null ? Number(r.customer_toast_rate) : null,
        }))
    }
  }

  return {
    story: {
      id: String(story.id),
      story_type: story.story_type as 'treatment' | 'homecare',
      title: String(story.title || ''),
      content: String(story.content || ''),
      banner_image_url_pc: story.banner_image_url_pc ?? null,
      banner_image_url_mobile: story.banner_image_url_mobile ?? null,
      created_at: String(story.created_at || ''),
    },
    salon: {
      id: String(salon?.id || salonId),
      name: String(salon?.name || '살롱'),
    },
    products,
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string; storyId: string }
}): Promise<Metadata> {
  const data = await loadStory(params.id, params.storyId)
  if (!data) {
    return { title: '스토리 | AURAN' }
  }
  const description = stripHtml(data.story.content).slice(0, 120)
  const image = data.story.banner_image_url_pc || data.story.banner_image_url_mobile || '/og-image.png'
  return {
    title: `${data.story.title} | ${data.salon.name}`,
    description: description || data.story.title,
    openGraph: {
      title: data.story.title,
      description: description || data.story.title,
      images: [{ url: image }],
      type: 'article',
    },
  }
}

export default async function SalonStoryPage({ params }: { params: { id: string; storyId: string } }) {
  const data = await loadStory(params.id, params.storyId)
  if (!data) notFound()
  return <StoryDetailClient data={data} />
}
