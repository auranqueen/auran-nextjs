import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import MagazineDetailClient from './MagazineDetailClient'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('magazines')
    .select('title, subtitle, thumbnail_url, slug, meta_title, meta_description')
    .or(`id.eq.${params.id},slug.eq.${params.id}`)
    .maybeSingle()

  const title = row?.meta_title || row?.title || 'AURAN MAGAZINE'
  const description =
    row?.meta_description || `호르몬 주기 맞춘 스킨케어, 경험해봤어요? 🌙 ${row?.subtitle || ''}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: row?.thumbnail_url ? [{ url: row.thumbnail_url }] : [{ url: '/og-image.png' }],
      type: 'article',
    },
  }
}

export default async function MagazineDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('magazines')
    .select('title, subtitle, thumbnail_url, slug, meta_title, meta_description, published_at, updated_at')
    .or(`id.eq.${params.id},slug.eq.${params.id}`)
    .maybeSingle()

  const headline = row?.meta_title || row?.title || 'AURAN MAGAZINE'
  const description =
    row?.meta_description || `호르몬 주기 맞춘 스킨케어, 경험해봤어요? 🌙 ${row?.subtitle || ''}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    image: row?.thumbnail_url || undefined,
    datePublished: row?.published_at || undefined,
    dateModified: row?.updated_at || undefined,
    author: {
      '@type': 'Organization',
      name: 'AURAN',
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MagazineDetailClient />
    </>
  )
}
