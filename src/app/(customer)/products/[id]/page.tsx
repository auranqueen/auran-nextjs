import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ProductDetailClient from './client'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: product } = await supabase
    .from('products')
    .select('name, storage_thumb_url, thumb_img')
    .eq('id', params.id)
    .maybeSingle()

  const description = '내 피부 주기를 아는 유일한 플랫폼 💜 맑원장이 직접 고른 제품이에요.'
  const imageUrl = product?.storage_thumb_url || product?.thumb_img || ''

  return {
    title: `${product?.name || '제품 상세'} · AURAN`,
    description,
    openGraph: {
      title: product?.name,
      description,
      images: imageUrl ? [{ url: imageUrl }] : [{ url: '/og-image.png' }],
      type: 'website',
      siteName: 'AURAN',
      locale: 'ko_KR',
    },
    twitter: {
      card: 'summary_large_image',
      title: product?.name || '제품 상세',
      description,
      images: imageUrl ? [imageUrl] : ['/og-image.png'],
    },
  }
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: product } = await supabase
    .from('products')
    .select('*, brands(name, logo_url, origin_country, origin, default_earn_points, access_tier, share_rate), categories(target_tracks)')
    .eq('id', params.id)
    .single()

  if (!product) return notFound()

  let exclusiveLocked = false
  const brand = (product as { brands?: { access_tier?: string | null } | null }).brands
  const accessTier = String(brand?.access_tier ?? 'public')

  if (accessTier === 'public') {
    exclusiveLocked = false
  } else if (accessTier === 'consult_required') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      exclusiveLocked = true
    } else {
      const { data: ur } = await supabase
        .from('users')
        .select('customer_grade, renobel_unlocked')
        .eq('auth_id', user.id)
        .maybeSingle()
      const grade = String((ur as { customer_grade?: string | null } | null)?.customer_grade ?? '')
      const renobelOk = (ur as { renobel_unlocked?: boolean | null } | null)?.renobel_unlocked === true
      const gradeOk = ['LUMIÈRE', 'ESSENCE', 'LÉGENDE', 'CÉLESTE'].includes(grade)
      exclusiveLocked = !(renobelOk || gradeOk)
    }
  }

  return <ProductDetailClient product={product} exclusiveLocked={exclusiveLocked} />
}
