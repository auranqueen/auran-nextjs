import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import JournalPublicClient from './JournalPublicClient'

const METADATA_BASE = new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://auran.kr')

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()

  const { data: journal } = await supabase
    .from('skin_journals')
    .select('id,user_id,photo_url')
    .eq('id', params.id)
    .maybeSingle()

  if (!journal) {
    return {
      title: 'AURAN · Journal',
    }
  }

  const { data: author } = await supabase
    .from('users')
    .select('id,name')
    .eq('id', journal.user_id)
    .maybeSingle()

  const nick = author?.name || '사용자'
  const photo = journal.photo_url
  const fallbackOgImage = new URL('/og-image.png', METADATA_BASE).toString()
  const photoOgImage = photo ? new URL(photo, METADATA_BASE).toString() : fallbackOgImage

  return {
    metadataBase: METADATA_BASE,
    title: `${nick}님의 피부변화`,
    openGraph: {
      title: `${nick}님의 피부변화`,
      url: `/journal/${params.id}`,
      images: [{ url: photoOgImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${nick}님의 피부변화`,
      images: [photoOgImage],
    },
  }
}

export default async function JournalPublicPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: guestbookFetchRow } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('category', 'journal_public')
    .eq('key', 'guestbook_fetch_limit')
    .maybeSingle()

  const guestbookFetchLimit = Number(guestbookFetchRow?.value ?? 20)

  const { data: journal } = await supabase
    .from('skin_journals')
    .select('id,user_id,date,photo_url,memo,score,product_ids,created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!journal) notFound()

  const { data: author } = await supabase
    .from('users')
    .select('id,name,avatar_url,skin_type')
    .eq('id', journal.user_id)
    .maybeSingle()

  const productIds = Array.isArray(journal.product_ids) ? journal.product_ids : []

  const { data: products } = productIds.length
    ? await supabase
      .from('products')
      .select('id,name,thumb_img,retail_price,status,skin_types')
      .in('id', productIds)
      .eq('status', 'active')
    : { data: [] as any[] }

  const { count: likeCount } = await supabase
    .from('skin_journal_likes')
    .select('*', { count: 'exact', head: true })
    .eq('journal_id', journal.id)

  const likeTotal = likeCount || 0

  const { data: guestbookRows } = await supabase
    .from('guestbook')
    .select('id,owner_id,writer_id,writer_name,message,created_at')
    .eq('owner_id', journal.user_id)
    .order('created_at', { ascending: false })
    .limit(guestbookFetchLimit)

  return (
    <JournalPublicClient
      journal={journal as any}
      author={{
        id: author?.id || journal.user_id,
        name: author?.name || '사용자',
        avatar_url: author?.avatar_url || null,
        skin_type: author?.skin_type || null,
      }}
      products={(products || []) as any[]}
      likeCount={likeTotal}
      initialGuestbook={(guestbookRows || []) as any[]}
      journalId={journal.id}
    />
  )
}

