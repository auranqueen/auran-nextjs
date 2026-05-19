import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import MagazineDetailClient from './MagazineDetailClient'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('magazines')
    .select('title, subtitle, thumbnail_url')
    .eq('id', params.id)
    .maybeSingle()

  const description = `호르몬 주기 맞춘 스킨케어, 경험해봤어요? 🌙 ${row?.subtitle || ''}`

  return {
    title: `${row?.title || 'AURAN MAGAZINE'}`,
    description,
    openGraph: {
      title: row?.title || 'AURAN MAGAZINE',
      description,
      images: row?.thumbnail_url ? [{ url: row.thumbnail_url }] : [{ url: '/og-image.png' }],
      type: 'article',
    },
  }
}

export default function MagazineDetailPage() {
  return <MagazineDetailClient />
}
