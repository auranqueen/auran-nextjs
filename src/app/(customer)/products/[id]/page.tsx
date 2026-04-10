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
    .select('*, brands(name, logo_url, origin_country, origin, default_earn_points), categories(target_tracks)')
    .eq('id', params.id)
    .single()

  if (!product) return notFound()

  let exclusiveLocked = false
  if ((product as { is_exclusive?: boolean }).is_exclusive === true) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      exclusiveLocked = true
    } else {
      const { data: ur } = await supabase.from('users').select('id,role').eq('auth_id', user.id).maybeSingle()
      if (!ur?.id) {
        exclusiveLocked = true
      } else if ((ur as { role?: string }).role === 'admin') {
        exclusiveLocked = false
      } else {
        const { count } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', ur.id)
          .eq('payment_applied', true)
        exclusiveLocked = (count ?? 0) === 0
      }
    }
  }

  return <ProductDetailClient product={product} exclusiveLocked={exclusiveLocked} />
}
