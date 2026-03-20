'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'

const GOLD = 'var(--gold)'
const COMMUNITY_BUCKET = 'community'

type TabId = 'journal' | 'reviews' | 'guestbook'

type ProfileRow = {
  id: string
  name: string
  avatar_url?: string | null
  skin_type?: string | null
  points: number
  charge_balance: number
}

type SkinJournalRow = {
  id: string
  date: string
  photo_url?: string | null
  memo?: string | null
  score: number
  created_at: string
}

type GuestbookRow = {
  id: string
  owner_id: string
  writer_id: string
  writer_name: string
  message: string
  created_at: string
}

type ProductLite = {
  id: string
  name: string
  thumb_img?: string | null
  retail_price?: number | null
  brands?: { name: string }[] | { name: string } | null
}

type ProductReviewRow = {
  id: string
  target_id: string
  rating: number
  content?: string | null
  images?: string[] | null
  status: string
  created_at: string
  order_id?: string | null
}

type ReviewCard = {
  product: ProductLite
  review: ProductReviewRow | null
  orderId: string | null
}

function todayKSTDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function stars(score: number) {
  const s = Math.max(0, Math.min(5, Math.floor(score)))
  return '★'.repeat(s) + '☆'.repeat(5 - s)
}

function skinBadgeText(skinType: string | null | undefined) {
  if (!skinType) return '미설정 ✨'
  return `${skinType} ✨`
}

function getBrandName(p: ProductLite) {
  const b = p.brands as any
  if (!b) return ''
  if (Array.isArray(b)) return b?.[0]?.name || ''
  return b?.name || ''
}

async function uploadSingleToCommunity(supabase: ReturnType<typeof createClient>, file: File, path: string) {
  const { error } = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  const { data } = supabase.storage.from(COMMUNITY_BUCKET).getPublicUrl(path)
  return data?.publicUrl || null
}

export default function MyWorldPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<ProfileRow | null>(null)
  const [tab, setTab] = useState<TabId>('journal')

  const [journals, setJournals] = useState<SkinJournalRow[]>([])
  const [guestbookRows, setGuestbookRows] = useState<GuestbookRow[]>([])
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([])

  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarError, setAvatarError] = useState<string>('')

  const [journalModalOpen, setJournalModalOpen] = useState(false)
  const [journalMemo, setJournalMemo] = useState('')
  const [journalScore, setJournalScore] = useState<number>(3)
  const [journalPhotoFile, setJournalPhotoFile] = useState<File | null>(null)
  const [journalPhotoPreview, setJournalPhotoPreview] = useState<string | null>(null)
  const [journalSaving, setJournalSaving] = useState(false)
  const [journalError, setJournalError] = useState<string>('')

  const [guestbookMessage, setGuestbookMessage] = useState('')
  const [guestbookSaving, setGuestbookSaving] = useState(false)
  const [guestbookError, setGuestbookError] = useState('')

  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<{ product: ProductLite; orderId: string | null } | null>(null)
  const [reviewRating, setReviewRating] = useState<number>(5)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const shareUrl = useMemo(() => {
    const username = (me?.name || 'user').trim()
    return `https://auran.kr/u/${encodeURIComponent(username)}`
  }, [me?.name])

  const refreshJournals = async (userId: string) => {
    const { data } = await supabase
      .from('skin_journals')
      .select('id,user_id,date,photo_url,memo,score,created_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30)
    setJournals((data || []) as SkinJournalRow[])
  }

  const refreshGuestbook = async (ownerId: string) => {
    const { data } = await supabase
      .from('guestbook')
      .select('id,owner_id,writer_id,writer_name,message,created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(50)
    setGuestbookRows((data || []) as GuestbookRow[])
  }

  const refreshReviews = async (userId: string) => {
    // 배송완료된 주문에서 구매한 상품 수집
    const { data: ordersData } = await supabase
      .from('orders')
      .select('id,delivered_at,status,order_items(product_id,product_name,product_price)')
      .eq('customer_id', userId)
      .eq('status', '배송완료')
      .order('delivered_at', { ascending: false })
      .limit(30)

    const orders = (ordersData || []) as any[]
    const purchased: Record<string, { orderId: string | null; productName: string }> = {}

    for (const o of orders) {
      const orderId = o.id as string
      const items = Array.isArray(o.order_items) ? o.order_items : []
      for (const it of items) {
        const pid = it.product_id as string | null
        if (!pid) continue
        if (!purchased[pid]) purchased[pid] = { orderId, productName: it.product_name || '' }
      }
    }

    const productIds = Object.keys(purchased)
    if (productIds.length === 0) {
      setReviewCards([])
      return
    }

    const { data: productsData } = await supabase
      .from('products')
      .select('id,name,thumb_img,retail_price,brands(name)')
      .in('id', productIds)

    const products = (productsData || []) as ProductLite[]

    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('id,target_id,rating,content,images,status,created_at,order_id')
      .eq('author_id', userId)
      .eq('review_type', 'product')
      .in('target_id', productIds)
      .order('created_at', { ascending: false })

    const reviews = (reviewsData || []) as ProductReviewRow[]

    const reviewMap = new Map<string, ProductReviewRow>()
    for (const r of reviews) {
      if (!reviewMap.has(r.target_id)) reviewMap.set(r.target_id, r)
    }

    const cards: ReviewCard[] = products.map(p => ({
      product: p,
      review: reviewMap.get(p.id) || null,
      orderId: purchased[p.id]?.orderId || null,
    }))

    // 구매한 상품이 없는 경우 고려(정렬)
    cards.sort((a, b) => a.product.name.localeCompare(b.product.name))
    setReviewCards(cards)
  }

  const refreshAll = async () => {
    if (!me) return
    await Promise.all([refreshJournals(me.id), refreshGuestbook(me.id), refreshReviews(me.id)])
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser()

        if (!user || authErr) {
          router.replace('/login?role=customer')
          return
        }

        const { data } = await supabase
          .from('users')
          .select('id,name,avatar_url,skin_type,points,charge_balance')
          .eq('auth_id', user.id)
          .single()

        if (!data?.id) {
          router.replace('/login?role=customer')
          return
        }

        setMe(data as ProfileRow)
        await Promise.all([refreshJournals(data.id), refreshGuestbook(data.id), refreshReviews(data.id)])
      } finally {
        setLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      if (journalPhotoPreview) URL.revokeObjectURL(journalPhotoPreview)
      for (const p of reviewPreviews) URL.revokeObjectURL(p)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openAvatarModal = () => {
    setAvatarError('')
    setAvatarSaving(false)
    setAvatarFile(null)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(null)
    setAvatarModalOpen(true)
  }

  const saveAvatar = async () => {
    if (!me) return
    if (!avatarFile) {
      setAvatarError('프로필 사진을 선택해주세요.')
      return
    }

    setAvatarSaving(true)
    setAvatarError('')
    try {
      const ext = avatarFile.name.split('.').pop() || 'jpg'
      const path = `avatars/${me.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`
      const url = await uploadSingleToCommunity(supabase, avatarFile, path)
      if (!url) throw new Error('업로드 URL을 생성할 수 없습니다.')

      await supabase.from('users').update({ avatar_url: url }).eq('id', me.id)
      setMe(prev => (prev ? { ...prev, avatar_url: url } : prev))
      setAvatarModalOpen(false)
    } catch (e: any) {
      setAvatarError(e?.message || '프로필 사진 저장에 실패했습니다.')
    } finally {
      setAvatarSaving(false)
    }
  }

  const openJournalModal = () => {
    setJournalError('')
    setJournalSaving(false)
    setJournalMemo('')
    setJournalScore(3)
    setJournalPhotoFile(null)
    if (journalPhotoPreview) URL.revokeObjectURL(journalPhotoPreview)
    setJournalPhotoPreview(null)
    setJournalModalOpen(true)
  }

  const saveJournal = async () => {
    if (!me) return
    const date = todayKSTDate()
    if (!journalPhotoFile) {
      setJournalError('오늘 기록 사진을 선택해주세요.')
      return
    }
    if (!journalMemo.trim()) {
      setJournalError('메모를 입력해주세요.')
      return
    }

    setJournalSaving(true)
    setJournalError('')
    try {
      const ext = journalPhotoFile.name.split('.').pop() || 'jpg'
      const path = `skin_journals/${me.id}/${date}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`
      const url = await uploadSingleToCommunity(supabase, journalPhotoFile, path)
      if (!url) throw new Error('업로드 URL을 생성할 수 없습니다.')

      await supabase
        .from('skin_journals')
        .upsert(
          {
            user_id: me.id,
            date,
            photo_url: url,
            memo: journalMemo.trim(),
            score: journalScore,
          } as any,
          { onConflict: 'user_id,date' }
        )

      setJournalModalOpen(false)
      await refreshJournals(me.id)
    } catch (e: any) {
      setJournalError(e?.message || '오늘 기록 저장에 실패했습니다.')
    } finally {
      setJournalSaving(false)
    }
  }

  const addGuestbook = async () => {
    if (!me) return
    if (!guestbookMessage.trim()) {
      setGuestbookError('메시지를 입력해주세요.')
      return
    }

    setGuestbookSaving(true)
    setGuestbookError('')
    try {
      await supabase.from('guestbook').insert({
        owner_id: me.id,
        writer_id: me.id,
        writer_name: me.name,
        message: guestbookMessage.trim(),
      })
      setGuestbookMessage('')
      await refreshGuestbook(me.id)
    } catch (e: any) {
      setGuestbookError(e?.message || '방명록 저장에 실패했습니다.')
    } finally {
      setGuestbookSaving(false)
    }
  }

  const openReviewModal = (card: ReviewCard) => {
    setReviewError('')
    setReviewSaving(false)
    setReviewTarget({ product: card.product, orderId: card.orderId })
    setReviewRating(5)
    setReviewContent('')
    setReviewFiles([])
    for (const p of reviewPreviews) URL.revokeObjectURL(p)
    setReviewPreviews([])
    setReviewModalOpen(true)
  }

  const onReviewFiles = (files: FileList | null) => {
    if (!files || !reviewTarget) return
    const incoming = Array.from(files).slice(0, 5) // 안전: 너무 많은 업로드 방지
    // 기존 미리보기 정리
    setReviewFiles(incoming)
    setReviewPreviews(incoming.map(f => URL.createObjectURL(f)))
  }

  const saveReview = async () => {
    if (!me || !reviewTarget) return
    if (!reviewContent.trim()) {
      setReviewError('후기 내용을 입력해주세요.')
      return
    }
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('별점을 1~5 사이로 선택해주세요.')
      return
    }

    setReviewSaving(true)
    setReviewError('')
    try {
      const urls: string[] = []
      for (let i = 0; i < reviewFiles.length; i++) {
        const f = reviewFiles[i]
        const ext = f.name.split('.').pop() || 'jpg'
        const path = `reviews/${me.id}/${Date.now()}_${i}_${Math.random().toString(16).slice(2)}.${ext}`
        const url = await uploadSingleToCommunity(supabase, f, path)
        if (url) urls.push(url)
      }

      await supabase.from('reviews').insert({
        author_id: me.id,
        review_type: 'product',
        target_id: reviewTarget.product.id,
        rating: reviewRating,
        content: reviewContent.trim(),
        images: urls,
        status: '게시',
        order_id: reviewTarget.orderId,
      } as any)

      setReviewModalOpen(false)
      setReviewTarget(null)
      await refreshReviews(me.id)
    } catch (e: any) {
      setReviewError(e?.message || '후기 저장에 실패했습니다.')
    } finally {
      setReviewSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="마이월드" right={<NoticeBell />} />

      <div style={{ padding: '18px 18px 0' }}>
        {/* 프로필 영역 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={openAvatarModal}
              style={{
                width: 62,
                height: 62,
                borderRadius: '50%',
                overflow: 'hidden',
                border: `1px solid rgba(201,168,76,0.45)`,
                background: 'rgba(0,0,0,0.2)',
                cursor: 'pointer',
                padding: 0,
                display: 'block',
              }}
              aria-label="프로필 사진 변경"
            >
              {me?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>
                  🙂
                </div>
              )}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {me?.name || '사용자'}
                </div>
              </div>
              <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: GOLD, fontWeight: 900, fontSize: 12, padding: '6px 10px', borderRadius: 999 }}>
                  {skinBadgeText(me?.skin_type)}
                </span>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                팔로워 0 · 팔로잉 0
              </div>
            </div>

            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                flexShrink: 0,
                background: 'rgba(201,168,76,0.12)',
                border: '1px solid rgba(201,168,76,0.35)',
                color: GOLD,
                fontWeight: 900,
                fontSize: 12,
                padding: '10px 10px',
                borderRadius: 12,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              프로필 공유
            </a>
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[
            { id: 'journal' as const, label: '스킨저널' },
            { id: 'reviews' as const, label: '사용후기' },
            { id: 'guestbook' as const, label: '방명록' },
          ].map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  padding: '10px 10px',
                  borderRadius: 12,
                  border: `1px solid ${active ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                  background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                  color: active ? GOLD : 'rgba(255,255,255,0.75)',
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* 스킨저널 */}
        {tab === 'journal' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>날짜별 피부 상태 기록</div>
              <button
                type="button"
                onClick={openJournalModal}
                style={{
                  background: 'rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.35)',
                  color: GOLD,
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                + 오늘 기록 추가
              </button>
            </div>

            {journals.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 16, color: 'var(--text3)', fontSize: 12 }}>
                아직 작성된 기록이 없어요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {journals.map(j => (
                  <div key={j.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12, display: 'flex', gap: 12 }}>
                    <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                      {j.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>📷</div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {j.date}
                        </div>
                        <div style={{ fontSize: 12, color: GOLD, fontWeight: 900 }}>{stars(j.score)}</div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#fff', fontWeight: 800 }}>
                        {j.memo || '메모 없음'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 사용후기 */}
        {tab === 'reviews' && (
          <>
            {reviewCards.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 16, color: 'var(--text3)', fontSize: 12 }}>
                배송완료된 구매 내역이 없어서 후기를 작성할 수 없어요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reviewCards.map(card => {
                  const r = card.review
                  const reviewed = !!r && r.status === '게시'
                  return (
                    <div key={card.product.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12 }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                          {card.product.thumb_img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={card.product.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>
                              🧴
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {card.product.name}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getBrandName(card.product)}
                          </div>

                          <div style={{ marginTop: 10 }}>
                            {reviewed ? (
                              <>
                                <div style={{ fontSize: 12, color: GOLD, fontWeight: 900 }}>{stars(r!.rating)}</div>
                                <div style={{ marginTop: 6, fontSize: 13, color: '#fff', fontWeight: 800, lineHeight: 1.5 }}>
                                  {r!.content || ''}
                                </div>
                                {r!.images && r!.images.length > 0 && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                    {r!.images.slice(0, 4).map((img, idx) => (
                                      <div key={`${img}_${idx}`} style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openReviewModal(card)}
                                style={{
                                  width: '100%',
                                  marginTop: 4,
                                  padding: '12px 12px',
                                  background: 'rgba(201,168,76,0.12)',
                                  border: '1px solid rgba(201,168,76,0.35)',
                                  color: GOLD,
                                  borderRadius: 12,
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                }}
                              >
                                후기 쓰기
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* 방명록 */}
        {tab === 'guestbook' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 8 }}>다른 사용자의 메시지</div>

              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12, marginBottom: 10 }}>
                <textarea
                  value={guestbookMessage}
                  onChange={e => setGuestbookMessage(e.target.value)}
                  placeholder="메시지를 남겨보세요."
                  style={{
                    width: '100%',
                    minHeight: 70,
                    resize: 'none',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{guestbookMessage.trim().length}/300</div>
                  <button
                    type="button"
                    onClick={addGuestbook}
                    disabled={guestbookSaving}
                    style={{
                      padding: '10px 14px',
                      background: guestbookSaving ? 'var(--bg3)' : 'rgba(201,168,76,0.12)',
                      border: `1px solid ${guestbookSaving ? 'var(--border)' : 'rgba(201,168,76,0.35)'}`,
                      color: guestbookSaving ? 'var(--text3)' : GOLD,
                      borderRadius: 12,
                      fontWeight: 900,
                      cursor: guestbookSaving ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    등록
                  </button>
                </div>
                {guestbookError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#e57373', fontWeight: 800 }}>{guestbookError}</div>
                )}
              </div>
            </div>

            {guestbookRows.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 16, color: 'var(--text3)', fontSize: 12 }}>
                아직 방명록이 없어요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {guestbookRows.map(g => (
                  <div key={g.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{g.writer_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(g.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 13, color: '#fff', fontWeight: 800, lineHeight: 1.5 }}>
                      {g.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Avatar Modal */}
      {avatarModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'rgba(10,12,15,0.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>프로필 사진 변경</div>
              <button type="button" onClick={() => setAvatarModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
                ×
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : me?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>
                      🙂
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0] || null
                      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
                      setAvatarFile(f)
                      setAvatarPreview(f ? URL.createObjectURL(f) : null)
                    }}
                    style={{ width: '100%', color: '#fff' }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>이미지 1장</div>
                </div>
              </div>

              {avatarError && <div style={{ marginTop: 10, fontSize: 12, color: '#e57373', fontWeight: 800 }}>{avatarError}</div>}

              <button
                type="button"
                onClick={saveAvatar}
                disabled={avatarSaving}
                style={{
                  width: '100%',
                  marginTop: 14,
                  padding: 14,
                  background: avatarSaving ? 'var(--bg3)' : 'rgba(201,168,76,0.12)',
                  border: `1px solid ${avatarSaving ? 'var(--border)' : 'rgba(201,168,76,0.35)'}`,
                  color: avatarSaving ? 'var(--text3)' : GOLD,
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: avatarSaving ? 'wait' : 'pointer',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journal Modal */}
      {journalModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'rgba(10,12,15,0.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>오늘 기록 추가</div>
              <button type="button" onClick={() => setJournalModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
                ×
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                  {journalPhotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={journalPhotoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>
                      📷
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const f = e.target.files?.[0] || null
                      if (journalPhotoPreview) URL.revokeObjectURL(journalPhotoPreview)
                      setJournalPhotoFile(f)
                      setJournalPhotoPreview(f ? URL.createObjectURL(f) : null)
                    }}
                    style={{ width: '100%', color: '#fff' }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>기록 사진 1장</div>
                </div>
              </div>

              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 900 }}>피부점수(1~5)</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map(s => {
                  const active = journalScore === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setJournalScore(s)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${active ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                        background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                        color: active ? GOLD : 'rgba(255,255,255,0.75)',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 900, marginBottom: 8 }}>한줄 메모</div>
                <textarea
                  value={journalMemo}
                  onChange={e => setJournalMemo(e.target.value)}
                  placeholder="예) 오늘은 T존이 좀 번들거렸어요."
                  style={{
                    width: '100%',
                    minHeight: 90,
                    resize: 'none',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              {journalError && <div style={{ marginTop: 10, fontSize: 12, color: '#e57373', fontWeight: 800 }}>{journalError}</div>}

              <button
                type="button"
                onClick={saveJournal}
                disabled={journalSaving}
                style={{
                  width: '100%',
                  marginTop: 14,
                  padding: 14,
                  background: journalSaving ? 'var(--bg3)' : 'rgba(201,168,76,0.12)',
                  border: `1px solid ${journalSaving ? 'var(--border)' : 'rgba(201,168,76,0.35)'}`,
                  color: journalSaving ? 'var(--text3)' : GOLD,
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: journalSaving ? 'wait' : 'pointer',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModalOpen && reviewTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'rgba(10,12,15,0.98)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{reviewTarget.product.name} 후기 쓰기</div>
              <button
                type="button"
                onClick={() => {
                  setReviewModalOpen(false)
                  setReviewTarget(null)
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 900, marginBottom: 8 }}>별점</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4, 5].map(s => {
                  const active = reviewRating === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewRating(s)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${active ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                        background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                        color: active ? GOLD : 'rgba(255,255,255,0.75)',
                        fontWeight: 900,
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 900, marginBottom: 8 }}>사진</div>
                <input type="file" multiple accept="image/*" onChange={e => onReviewFiles(e.target.files)} style={{ width: '100%', color: '#fff' }} />
                {reviewPreviews.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {reviewPreviews.slice(0, 4).map((p, idx) => (
                      <div key={`${p}_${idx}`} style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 900, marginBottom: 8 }}>텍스트</div>
                <textarea
                  value={reviewContent}
                  onChange={e => setReviewContent(e.target.value)}
                  placeholder="사용해보신 느낌을 공유해주세요."
                  style={{
                    width: '100%',
                    minHeight: 110,
                    resize: 'none',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    padding: 10,
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>

              {reviewError && <div style={{ marginTop: 10, fontSize: 12, color: '#e57373', fontWeight: 800 }}>{reviewError}</div>}

              <button
                type="button"
                onClick={saveReview}
                disabled={reviewSaving}
                style={{
                  width: '100%',
                  marginTop: 14,
                  padding: 14,
                  background: reviewSaving ? 'var(--bg3)' : 'rgba(201,168,76,0.12)',
                  border: `1px solid ${reviewSaving ? 'var(--border)' : 'rgba(201,168,76,0.35)'}`,
                  color: reviewSaving ? 'var(--text3)' : GOLD,
                  borderRadius: 12,
                  fontWeight: 900,
                  cursor: reviewSaving ? 'wait' : 'pointer',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      <DashboardBottomNav role="customer" />
    </div>
  )
}

