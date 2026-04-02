import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from './client'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name, description, storage_thumb_url, thumb_img, retail_price')
    .eq('id', params.id)
    .maybeSingle()

  if (!product) return {}

  const imageUrl = product.storage_thumb_url || product.thumb_img || ''
  const title = `${product.name} - AURAN`
  const description = product.description || '오랜 뷰티 셀렉트샵'
  const price = Number(product.retail_price || 0).toLocaleString()

  return {
    title,
    description,
    openGraph: {
      title,
      description: `${description} | ${price}원`,
      images: imageUrl ? [{
        url: imageUrl,
        width: 800,
        height: 800,
        alt: product.name,
        type: 'image/jpeg',
      }] : [],
      type: 'website',
      siteName: 'AURAN',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
  }
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: product } = await supabase
    .from('products')
    .select('*, brands(name, logo_url), categories(target_tracks)')
    .eq('id', params.id)
    .single()

  if (!product) return notFound()

  return <ProductDetailClient product={product} />
}
