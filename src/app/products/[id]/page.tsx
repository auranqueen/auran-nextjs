import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from './client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getProduct(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*, brands(id, name)')
    .eq('id', id)
    .maybeSingle()
  if (error) return null
  return data
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await getProduct(params.id)
  if (!product) return { title: '제품 | AURAN' }
  const brandName = Array.isArray((product as any).brands)
    ? (product as any).brands?.[0]?.name || ''
    : (product as any).brands?.name || ''
  return {
    title: `${product.name} | AURAN`,
    description: String(product.description || '').slice(0, 160),
    keywords: [brandName, '스킨케어', '클리닉', '피부관리', product.category || ''],
    openGraph: {
      title: product.name,
      description: product.description || '',
      images: product.thumb_img ? [{ url: product.thumb_img }] : undefined,
      type: 'website',
      siteName: 'AURAN',
    },
    other: {
      'naver-site-verification': process.env.NAVER_SITE_VERIFICATION || '',
      'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION || '',
    },
  }
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)
  if (!product) notFound()

  const brandName = Array.isArray((product as any).brands)
    ? (product as any).brands?.[0]?.name || 'AURAN'
    : (product as any).brands?.name || 'AURAN'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.thumb_img,
    description: product.description || '',
    brand: { '@type': 'Brand', name: brandName },
    offers: {
      '@type': 'Offer',
      price: product.retail_price || 0,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
      url: `https://auran.kr/products/${product.id}`,
    },
    aggregateRating: Number(product.avg_rating || 0) > 0
      ? { '@type': 'AggregateRating', ratingValue: product.avg_rating, reviewCount: product.review_count || 0 }
      : undefined,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetailClient product={product} />
    </>
  )
}
