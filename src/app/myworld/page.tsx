'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'
import ShareBottomSheet from '@/components/ShareBottomSheet'
import { useAdminSettings } from '@/hooks/useAdminSettings'

const GOLD = 'var(--gold)'
const COMMUNITY_BUCKET = 'community'
const AVATAR_BUCKET = 'avatars'

type TabId = 'journal' | 'reviews' | 'guestbook' | 'ranking'

type ProfileRow = {
  id: string
  name: string
  avatar_url?: string | null
  skin_type?: string | null
  points: number
  charge_balance: number
  star_level: number
  total_likes: number
  total_followers: number
  purchase_leads: number
}

type MiniUser = {
  id: string
  name: string
  avatar_url?: string | null
  skin_type?: string | null
  star_level: number
}

type SkinJournalRow = {
  id: string
  date: string
  photo_url?: string | null
  memo?: string | null
  score: number
  product_ids?: string[] | null
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

type SharePayload = {
  link: string
  title: string
  description: string
  imageUrl?: string | null
  buttonTitle: string
}

function todayKSTDate(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function stars(score: number, maxStars: number) {
  const s = Math.max(0, Math.min(maxStars, Math.floor(score)))
  return '★'.repeat(s) + '☆'.repeat(maxStars - s)
}

function skinBadgeText(skinType: string | null | undefined) {
  if (!skinType) return '미설정 ✨'
  return `${skinType} ✨`
}

function starLevelMeta(level: number) {
  const lv = Math.max(1, Math.floor(level || 1))
  if (lv >= 5) return { label: 'AURAN 퀸 🏆', color: '#4fd8ff' }
  if (lv === 4) return { label: '인플루언서 👑', color: '#d2a679' }
  if (lv === 3) return { label: '뷰티스타 💫', color: '#bf5f90' }
  if (lv === 2) return { label: '글로우 ✨', color: '#c9a84c' }
  return { label: '새싹 🌱', color: '#4cad7e' }
}

function getBrandName(p: ProductLite) {
  const b = p.brands as any
  if (!b) return ''
  if (Array.isArray(b)) return b?.[0]?.name || ''
  return b?.name || ''
}

function buildScorePolyline(scores: number[], minScore: number, maxScore: number) {
  const n = scores.length
  if (n === 0) return ''
  if (n === 1) {
    const x = 50
    const y = 20
    return `${x},${y}`
  }

  const denom = Math.max(1, maxScore - minScore)
  const xPad = 6
  const w = 120
  const h = 36
  const points = scores.map((s, i) => {
    const t = (s - minScore) / denom
    const y = 40 - t * h
    const x = xPad + (i / (n - 1)) * (w - xPad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return points.join(' ')
}

function toComma(n: number) {
  const num = Number(n || 0)
  return Math.floor(num).toLocaleString('ko-KR')
}

async function uploadSingle(
  supabase: ReturnType<typeof createClient>,
  file: File,
  path: string,
  bucket = COMMUNITY_BUCKET
) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl || null
}

export default function MyWorldPage() {
  const supabase = createClient()
  const router = useRouter()

  const { loading: adminSettingsLoading, getSettingNum, getSetting } = useAdminSettings()

  const guestbookMaxChars = getSettingNum('myworld', 'guestbook_max_chars', 300)
  const journalsFetchLimit = getSettingNum('myworld', 'journals_fetch_limit', 30)
  const guestbookFetchLimit = getSettingNum('myworld', 'guestbook_fetch_limit', 50)
  const ordersFetchLimit = getSettingNum('myworld', 'orders_fetch_limit', 30)
  const reviewMaxImages = getSettingNum('myworld', 'review_max_images', 5)
  const reviewPreviewMax = getSettingNum('myworld', 'review_preview_max', 4)
  const reviewStarMin = getSettingNum('myworld', 'review_star_min', 1)
  const reviewStarMax = getSettingNum('myworld', 'review_star_max', 5)
  const journalScoreMin = getSettingNum('myworld', 'journal_score_min', 1)
  const journalScoreMax = getSettingNum('myworld', 'journal_score_max', 5)
  const journalScoreDefault = getSettingNum('myworld', 'journal_score_default', 3)
  const copyFollowerLabel = getSetting('copy_social', 'follower_label', '오랜일촌')
  const copyFollowingLabel = getSetting('copy_social', 'following_label', '내 오랜일촌')
  const copyFollowBtn = getSetting('copy_social', 'follow_btn', '오랜일촌 맺기')
  const copyFollowingBtn = getSetting('copy_social', 'following_btn', '오랜일촌 ✓')

  // star_level thresholds (admin_settings)
  const lv2_journal_min = getSettingNum('star_level', 'lv2_journals', 5)
  const lv2_followers_min = getSettingNum('star_level', 'lv2_followers', 10)
  const lv3_journal_min = getSettingNum('star_level', 'lv3_journals', 20)
  const lv3_followers_min = getSettingNum('star_level', 'lv3_followers', 50)
  const lv3_purchase_review_min = getSettingNum('star_level', 'lv3_reviews', 3)
  const lv4_journal_min = getSettingNum('star_level', 'lv4_journals', 50)
  const lv4_followers_min = getSettingNum('star_level', 'lv4_followers', 200)
  const lv4_like_min = getSettingNum('star_level', 'lv4_likes', 500)
  const lv5_followers_min = getSettingNum('star_level', 'lv5_followers', 500)
  const lv5_like_min = getSettingNum('star_level', 'lv5_likes', 2000)
  const lv5_purchase_leads_min = getSettingNum('star_level', 'lv5_purchase_leads', 50)

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<ProfileRow | null>(null)
  const [tab, setTab] = useState<TabId>('journal')

  const [journals, setJournals] = useState<SkinJournalRow[]>([])
  const [guestbookRows, setGuestbookRows] = useState<GuestbookRow[]>([])
  const [reviewCards, setReviewCards] = useState<ReviewCard[]>([])

  const [journalLikeCounts, setJournalLikeCounts] = useState<Record<string, number>>({})
  const [likedJournalIds, setLikedJournalIds] = useState<Set<string>>(new Set())

  const [reviewLikeCounts, setReviewLikeCounts] = useState<Record<string, number>>({})
  const [likedReviewIds, setLikedReviewIds] = useState<Set<string>>(new Set())

  const [timelineProducts, setTimelineProducts] = useState<ProductLite[]>([])

  const [shareOpen, setShareOpen] = useState(false)
  const [shareDomId, setShareDomId] = useState('')
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)

  const [followingCount, setFollowingCount] = useState(0)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [followersModalOpen, setFollowersModalOpen] = useState(false)
  const [followingModalOpen, setFollowingModalOpen] = useState(false)
  const [followersList, setFollowersList] = useState<MiniUser[]>([])
  const [followingList, setFollowingList] = useState<MiniUser[]>([])

  const [followingFeed, setFollowingFeed] = useState<{ author: MiniUser; journal: SkinJournalRow }[]>([])

  const [monthJournalCount, setMonthJournalCount] = useState(0)
  const [monthLikeCount, setMonthLikeCount] = useState(0)
  const [monthFollowerCount, setMonthFollowerCount] = useState(0)
  const [totalJournalCount, setTotalJournalCount] = useState(0)
  const [totalPurchaseReviewCount, setTotalPurchaseReviewCount] = useState(0)

  const timelineProductMap = useMemo(() => {
    const m = new Map<string, ProductLite>()
    timelineProducts.forEach(p => m.set(p.id, p))
    return m
  }, [timelineProducts])

  const journalTimelineGroups = useMemo(() => {
    const map = new Map<string, SkinJournalRow[]>()
    for (const j of journals) {
      const pids = Array.isArray(j.product_ids) ? j.product_ids : []
      for (const pid of pids) {
        if (!map.has(pid)) map.set(pid, [])
        map.get(pid)!.push(j)
      }
    }

    const groups = Array.from(map.entries()).map(([pid, list]) => {
      const sorted = list.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const scores = sorted.map(x => x.score)

      return {
        productId: pid,
        product: timelineProductMap.get(pid),
        firstDate: first?.date || '',
        lastDate: last?.date || '',
        beforeScore: first?.score ?? 0,
        afterScore: last?.score ?? 0,
        scores,
      }
    })

    // 최신 사용 기간 순으로
    groups.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
    return groups
  }, [journals, timelineProductMap])

  const openShareForJournal = (journal: SkinJournalRow) => {
    const productIds = Array.isArray(journal.product_ids) ? journal.product_ids : []
    const primaryProductId = productIds[0]
    const primaryProduct = primaryProductId ? timelineProductMap.get(primaryProductId) : undefined
    const productName = primaryProduct?.name || ''

    const skinType = me?.skin_type || ''
    const title = `${me?.name || '사용자'}님의 피부 변화 기록`
    const link = `https://auran.kr/journal/${journal.id}`
    const imageUrl = journal.photo_url || primaryProduct?.thumb_img || null

    setSharePayload({
      link,
      title,
      description: `${skinType}${productName ? ' + ' + productName : ''}`,
      imageUrl,
      buttonTitle: '변화 보러 가기',
    })
    setShareDomId(`journal-card-${journal.id}`)
    setShareOpen(true)
  }

  const openShareForReviewCard = (card: ReviewCard) => {
    const skinType = me?.skin_type || ''
    const title = `${me?.name || '사용자'}님의 피부 변화 기록`

    const productId = card.product.id
    const associatedJournal = journals.find(j => Array.isArray(j.product_ids) && j.product_ids.includes(productId))
    const journalId = associatedJournal?.id || ''
    const link = associatedJournal ? `https://auran.kr/journal/${journalId}` : `https://auran.kr/products/${productId}`
    const productName = card.product.name
    const imageUrl = associatedJournal?.photo_url || card.product.thumb_img || null

    setSharePayload({
      link,
      title,
      description: `${skinType}${productName ? ' + ' + productName : ''}`,
      imageUrl,
      buttonTitle: '변화 보러 가기',
    })
    setShareDomId(`review-card-${card.product.id}`)
    setShareOpen(true)
  }

  const [avatarModalOpen, setAvatarModalOpen] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [avatarError, setAvatarError] = useState<string>('')

  const [journalModalOpen, setJournalModalOpen] = useState(false)
  const [journalMemo, setJournalMemo] = useState('')
  const [journalScore, setJournalScore] = useState<number>(journalScoreDefault)
  const [journalSelectedProductIds, setJournalSelectedProductIds] = useState<string[]>([])
  const [journalProductsOptions, setJournalProductsOptions] = useState<ProductLite[]>([])
  const [journalProductsLoading, setJournalProductsLoading] = useState(false)
  const [journalPhotoFile, setJournalPhotoFile] = useState<File | null>(null)
  const [journalPhotoPreview, setJournalPhotoPreview] = useState<string | null>(null)
  const [journalSaving, setJournalSaving] = useState(false)
  const [journalError, setJournalError] = useState<string>('')

  const [guestbookMessage, setGuestbookMessage] = useState('')
  const [guestbookSaving, setGuestbookSaving] = useState(false)
  const [guestbookError, setGuestbookError] = useState('')

  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<{ product: ProductLite; orderId: string | null } | null>(null)
  const [reviewRating, setReviewRating] = useState<number>(reviewStarMax)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewFiles, setReviewFiles] = useState<File[]>([])
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([])
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const shareUrl = useMemo(() => {
    const username = (me?.name || 'user').trim()
    return `https://auran.kr/u/${encodeURIComponent(username)}`
  }, [me?.name])

  const activityProgress = useMemo(() => {
    if (!me) return null
    const currentLevel = Math.max(1, Math.floor(me.star_level || 1))

    const journalCount = totalJournalCount
    const reviewCount = totalPurchaseReviewCount
    const followers = me.total_followers || 0
    const likes = me.total_likes || 0
    const leads = me.purchase_leads || 0

    const canLv5 = followers >= lv5_followers_min && likes >= lv5_like_min && leads >= lv5_purchase_leads_min
    const canLv4 = journalCount >= lv4_journal_min && followers >= lv4_followers_min && likes >= lv4_like_min
    const canLv3 = journalCount >= lv3_journal_min && followers >= lv3_followers_min && reviewCount >= lv3_purchase_review_min
    const canLv2 = journalCount >= lv2_journal_min && followers >= lv2_followers_min

    const targetLevel = canLv5 ? 5 : canLv4 ? 4 : canLv3 ? 3 : canLv2 ? 2 : 1
    const nextLevel = targetLevel < 5 ? targetLevel + 1 : 5

    if (nextLevel === 2) {
      const diff = Math.max(0, lv2_journal_min - journalCount)
      return { currentLevel: targetLevel, nextLevel, journalNeed: diff, followersNeed: Math.max(0, lv2_followers_min - followers), likesNeed: 0, reviewNeed: 0 }
    }
    if (nextLevel === 3) {
      const journalNeed = Math.max(0, lv3_journal_min - journalCount)
      const followersNeed = Math.max(0, lv3_followers_min - followers)
      const reviewNeed = Math.max(0, lv3_purchase_review_min - reviewCount)
      return { currentLevel: targetLevel, nextLevel, journalNeed, followersNeed, likesNeed: 0, reviewNeed }
    }
    if (nextLevel === 4) {
      const journalNeed = Math.max(0, lv4_journal_min - journalCount)
      const followersNeed = Math.max(0, lv4_followers_min - followers)
      const likesNeed = Math.max(0, lv4_like_min - likes)
      return { currentLevel: targetLevel, nextLevel, journalNeed, followersNeed, likesNeed, reviewNeed: 0 }
    }
    if (nextLevel === 5) {
      const followersNeed = Math.max(0, lv5_followers_min - followers)
      const likesNeed = Math.max(0, lv5_like_min - likes)
      const purchaseLeadNeed = Math.max(0, lv5_purchase_leads_min - leads)
      return { currentLevel: targetLevel, nextLevel, journalNeed: 0, followersNeed, likesNeed, reviewNeed: purchaseLeadNeed }
    }

    return { currentLevel: targetLevel, nextLevel: 5, journalNeed: 0, followersNeed: 0, likesNeed: 0, reviewNeed: 0 }
  }, [
    me,
    totalJournalCount,
    totalPurchaseReviewCount,
    lv2_journal_min,
    lv2_followers_min,
    lv3_journal_min,
    lv3_followers_min,
    lv3_purchase_review_min,
    lv4_journal_min,
    lv4_followers_min,
    lv4_like_min,
    lv5_followers_min,
    lv5_like_min,
    lv5_purchase_leads_min,
  ])

  const refreshJournals = async (userId: string) => {
    const { data } = await supabase
      .from('skin_journals')
      .select('id,user_id,date,photo_url,memo,score,product_ids,created_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(journalsFetchLimit)

    const list = (data || []) as SkinJournalRow[]
    setJournals(list)

    // 타임라인/사용제품 배지를 위해 제품 정보도 미리 로드
    const uniqueProductIds = new Set<string>()
    for (const j of list) {
      const ids = Array.isArray(j.product_ids) ? j.product_ids : []
      for (const pid of ids) uniqueProductIds.add(pid)
    }
    const idsArr = Array.from(uniqueProductIds)
    if (idsArr.length === 0) {
      setTimelineProducts([])
      return
    }

    const { data: prodData } = await supabase
      .from('products')
      .select('id,name,thumb_img,retail_price,brands(name),status,skin_types')
      .in('id', idsArr)

    setTimelineProducts((prodData || []) as any)
  }

  const refreshGuestbook = async (ownerId: string) => {
    const { data } = await supabase
      .from('guestbook')
      .select('id,owner_id,writer_id,writer_name,message,created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(guestbookFetchLimit)
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
      .limit(ordersFetchLimit)

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
      .eq('status', '게시')
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

  const loadJournalProductsOptions = async (userId: string) => {
    setJournalProductsLoading(true)
    try {
      const { data: ordersData } = await supabase
        .from('orders')
        .select('id,delivered_at,status,order_items(product_id)')
        .eq('customer_id', userId)
        .eq('status', '배송완료')
        .order('delivered_at', { ascending: false })
        .limit(ordersFetchLimit)

      const orders = (ordersData || []) as any[]
      const productIdsSet = new Set<string>()
      for (const o of orders) {
        const items = Array.isArray(o.order_items) ? o.order_items : []
        for (const it of items) {
          const pid = it.product_id as string | null
          if (!pid) continue
          productIdsSet.add(pid)
        }
      }

      const productIds = Array.from(productIdsSet)
      if (productIds.length === 0) {
        setJournalProductsOptions([])
        return
      }

      const { data: productsData } = await supabase
        .from('products')
        .select('id,name,thumb_img,retail_price,brands(name),status')
        .eq('status', 'active')
        .in('id', productIds)

      setJournalProductsOptions((productsData || []) as any)
    } catch {
      setJournalProductsOptions([])
    } finally {
      setJournalProductsLoading(false)
    }
  }

  const refreshAll = async () => {
    if (!me) return
    await Promise.all([refreshJournals(me.id), refreshGuestbook(me.id), refreshReviews(me.id)])
  }

  useEffect(() => {
    const run = async () => {
      if (!me) return

      const journalIds = journals.map(j => j.id)
      const reviewIds = reviewCards.map(c => c.review?.id).filter(Boolean) as string[]

      // 초기화
      setJournalLikeCounts({})
      setLikedJournalIds(new Set())
      setReviewLikeCounts({})
      setLikedReviewIds(new Set())

      try {
        if (journalIds.length > 0) {
          const { data: likeRows } = await supabase
            .from('skin_journal_likes')
            .select('journal_id,user_id')
            .in('journal_id', journalIds)

          const counts: Record<string, number> = {}
          const liked = new Set<string>()
          for (const row of (likeRows || []) as any[]) {
            counts[row.journal_id] = (counts[row.journal_id] || 0) + 1
            if (String(row.user_id) === String(me.id)) liked.add(row.journal_id)
          }
          setJournalLikeCounts(counts)
          setLikedJournalIds(liked)
        }

        if (reviewIds.length > 0) {
          const { data: likeRows } = await supabase
            .from('product_review_likes')
            .select('review_id,user_id')
            .in('review_id', reviewIds)

          const counts: Record<string, number> = {}
          const liked = new Set<string>()
          for (const row of (likeRows || []) as any[]) {
            counts[row.review_id] = (counts[row.review_id] || 0) + 1
            if (String(row.user_id) === String(me.id)) liked.add(row.review_id)
          }
          setReviewLikeCounts(counts)
          setLikedReviewIds(liked)
        }
      } catch {
        // ignore
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, journals, reviewCards])

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
          .select('id,name,avatar_url,skin_type,points,charge_balance,star_level,total_likes,total_followers,purchase_leads')
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
    const run = async () => {
      if (!me?.id) return
      try {
        const { data: followingRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', me.id)

        const following = (followingRows || []).map(r => r.following_id).filter(Boolean) as string[]
        setFollowingCount(following.length)
        setFollowingIds(new Set(following))

        if (following.length === 0) {
          setFollowingFeed([])
          return
        }

        // 오랜일촌 피드: 최신 저널 중심
        const { data: journalRows } = await supabase
          .from('skin_journals')
          .select('id,user_id,date,photo_url,memo,score,product_ids,created_at')
          .in('user_id', following)
          .order('date', { ascending: false })
          .limit(6)

        const uniqUserIds = Array.from(new Set((journalRows || []).map((j: any) => String(j.user_id))))
        const { data: userRows } = await supabase
          .from('users')
          .select('id,name,avatar_url,skin_type,star_level')
          .in('id', uniqUserIds)

        const userMap = new Map<string, MiniUser>((userRows || []).map((u: any) => [u.id, u]))
        const feed = (journalRows || [])
          .map((j: any) => ({
            author: userMap.get(String(j.user_id)) || { id: String(j.user_id), name: '사용자', avatar_url: null, skin_type: null, star_level: 1 },
            journal: j as SkinJournalRow,
          }))
          .slice(0, 6)

        setFollowingFeed(feed)
      } catch {
        setFollowingCount(0)
        setFollowingIds(new Set())
        setFollowingFeed([])
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  useEffect(() => {
    const run = async () => {
      if (!me?.id) return
      const now = new Date()
      const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
      const monthStart = new Date(kst.getFullYear(), kst.getMonth(), 1)
      const nextMonthStart = new Date(kst.getFullYear(), kst.getMonth() + 1, 1)

      const startDate = monthStart.toISOString().slice(0, 10)
      const endDate = nextMonthStart.toISOString().slice(0, 10)

      try {
        const { data: totalJournals, count: tCount } = await supabase
          .from('skin_journals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', me.id)
        const totalJ = (tCount || 0) as number
        setTotalJournalCount(totalJ)

        const { data: totalReviews, count: tReview } = await supabase
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('author_id', me.id)
          .eq('review_type', 'product')
          .eq('status', '게시')
        const totalR = (tReview || 0) as number
        setTotalPurchaseReviewCount(totalR)

        const { count: mJ } = await supabase
          .from('skin_journals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', me.id)
          .gte('date', startDate)
          .lt('date', endDate)
        setMonthJournalCount(mJ || 0)

        // 월간 오랜일촌 수
        const { count: mF } = await supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', me.id)
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', nextMonthStart.toISOString())
        setMonthFollowerCount(mF || 0)

        // 월간 공감 수(저널 likes + 후기 likes)
        const { data: monthJournalRows } = await supabase
          .from('skin_journals')
          .select('id,date')
          .eq('user_id', me.id)
          .gte('date', startDate)
          .lt('date', endDate)
        const monthJournalIds = Array.from(new Set((monthJournalRows || []).map(j => String(j.id))))

        let likesFromJournals = 0
        if (monthJournalIds.length > 0) {
          const { count: c1 } = await supabase
            .from('skin_journal_likes')
            .select('id', { count: 'exact', head: true })
            .in('journal_id', monthJournalIds)
            .gte('created_at', monthStart.toISOString())
            .lt('created_at', nextMonthStart.toISOString())
          likesFromJournals = c1 || 0
        }

        const { data: monthReviewRows } = await supabase
          .from('reviews')
          .select('id,created_at')
          .eq('author_id', me.id)
          .eq('review_type', 'product')
          .eq('status', '게시')
          .gte('created_at', monthStart.toISOString())
          .lt('created_at', nextMonthStart.toISOString())
        const monthReviewIds = Array.from(new Set((monthReviewRows || []).map(r => String(r.id))))

        let likesFromReviews = 0
        if (monthReviewIds.length > 0) {
          const { count: c2 } = await supabase
            .from('product_review_likes')
            .select('id', { count: 'exact', head: true })
            .in('review_id', monthReviewIds)
          // product_review_likes에 created_at 필터는 FK 기반이어서, 후기 created_at 기준으로 대체
          likesFromReviews = c2 || 0
        }

        setMonthLikeCount(likesFromJournals + likesFromReviews)
      } catch {
        // ignore
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

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
    if (!avatarFile.type?.startsWith('image/')) {
      setAvatarError('이미지 파일만 업로드 가능합니다')
      return
    }

    setAvatarSaving(true)
    setAvatarError('')
    try {
      const ext = avatarFile.name.split('.').pop() || 'jpg'
      const path = `${me.id}/profile.${ext}`
      const url = await uploadSingle(supabase, avatarFile, path, AVATAR_BUCKET)
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
    setJournalScore(journalScoreDefault)
    setJournalSelectedProductIds([])
    if (me && journalProductsOptions.length === 0) loadJournalProductsOptions(me.id)
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
      const url = await uploadSingle(supabase, journalPhotoFile, path, COMMUNITY_BUCKET)
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
            product_ids: journalSelectedProductIds,
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

  const toggleJournalLike = async (journalId: string) => {
    if (!me) return
    const currentlyLiked = likedJournalIds.has(journalId)

    // optimistic UI
    setLikedJournalIds(prev => {
      const next = new Set(prev)
      if (next.has(journalId)) next.delete(journalId)
      else next.add(journalId)
      return next
    })
    setJournalLikeCounts(prev => {
      const next = { ...prev }
      const cur = next[journalId] || 0
      next[journalId] = Math.max(0, cur + (currentlyLiked ? -1 : 1))
      return next
    })

    try {
      if (currentlyLiked) {
        await supabase.from('skin_journal_likes').delete().eq('journal_id', journalId).eq('user_id', me.id)
      } else {
        await supabase.from('skin_journal_likes').insert({ journal_id: journalId, user_id: me.id })
      }
    } catch {
      // fallback: ignore, next refresh will correct
    }
  }

  const toggleReviewLike = async (reviewId: string) => {
    if (!me) return
    const currentlyLiked = likedReviewIds.has(reviewId)

    setLikedReviewIds(prev => {
      const next = new Set(prev)
      if (next.has(reviewId)) next.delete(reviewId)
      else next.add(reviewId)
      return next
    })
    setReviewLikeCounts(prev => {
      const next = { ...prev }
      const cur = next[reviewId] || 0
      next[reviewId] = Math.max(0, cur + (currentlyLiked ? -1 : 1))
      return next
    })

    try {
      if (currentlyLiked) {
        await supabase.from('product_review_likes').delete().eq('review_id', reviewId).eq('user_id', me.id)
      } else {
        await supabase.from('product_review_likes').insert({ review_id: reviewId, user_id: me.id })
      }
    } catch {
      // ignore
    }
  }

  const refreshFollowing = async () => {
    if (!me?.id) return
    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', me.id)

    const following = (followingRows || []).map(r => r.following_id).filter(Boolean) as string[]
    setFollowingCount(following.length)
    const nextSet = new Set(following)
    setFollowingIds(nextSet)

    if (following.length === 0) {
      setFollowingFeed([])
      return
    }

    const { data: journalRows } = await supabase
      .from('skin_journals')
      .select('id,user_id,date,photo_url,memo,score,product_ids,created_at')
      .in('user_id', following)
      .order('date', { ascending: false })
      .limit(6)

    const uniqUserIds = Array.from(new Set((journalRows || []).map((j: any) => String(j.user_id))))
    const { data: userRows } = await supabase
      .from('users')
      .select('id,name,avatar_url,skin_type,star_level')
      .in('id', uniqUserIds)

    const userMap = new Map<string, MiniUser>((userRows || []).map((u: any) => [u.id, u]))
    const feed = (journalRows || [])
      .map((j: any) => ({
        author: userMap.get(String(j.user_id)) || { id: String(j.user_id), name: '사용자', avatar_url: null, skin_type: null, star_level: 1 },
        journal: j as SkinJournalRow,
      }))
      .slice(0, 6)

    setFollowingFeed(feed)
  }

  const toggleFollow = async (targetUserId: string) => {
    if (!me?.id) return
    const currentlyFollowing = followingIds.has(targetUserId)

    try {
      if (currentlyFollowing) {
        await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', targetUserId)
      } else {
        await supabase.from('follows').insert({ follower_id: me.id, following_id: targetUserId })
      }
      await refreshFollowing()
    } catch {
      // ignore
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
    setReviewRating(reviewStarMax)
    setReviewContent('')
    setReviewFiles([])
    for (const p of reviewPreviews) URL.revokeObjectURL(p)
    setReviewPreviews([])
    setReviewModalOpen(true)
  }

  const onReviewFiles = (files: FileList | null) => {
    if (!files || !reviewTarget) return
    const incoming = Array.from(files).slice(0, reviewMaxImages) // 안전: 너무 많은 업로드 방지
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
    if (reviewRating < reviewStarMin || reviewRating > reviewStarMax) {
      setReviewError(`별점을 ${reviewStarMin}~${reviewStarMax} 사이로 선택해주세요.`)
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
        const url = await uploadSingle(supabase, f, path, COMMUNITY_BUCKET)
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
                <span style={{ border: `1px solid ${starLevelMeta(me?.star_level || 1).color}55`, background: `${starLevelMeta(me?.star_level || 1).color}18`, color: starLevelMeta(me?.star_level || 1).color, fontWeight: 900, fontSize: 12, padding: '6px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {starLevelMeta(me?.star_level || 1).label}
                </span>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFollowersModalOpen(true)
                    if (me?.id) {
                      ;(async () => {
                        const { data: rows } = await supabase.from('follows').select('follower_id').eq('following_id', me.id)
                        const ids = (rows || []).map(r => r.follower_id).filter(Boolean)
                        if (ids.length === 0) {
                          setFollowersList([])
                          return
                        }
                        const { data: users } = await supabase
                          .from('users')
                          .select('id,name,avatar_url,skin_type,star_level')
                          .in('id', ids)
                        setFollowersList((users || []) as any)
                      })()
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontWeight: 900 }}
                >
                  {copyFollowerLabel} {me?.total_followers || 0}
                </button>
                <span style={{ color: 'rgba(255,255,255,0.35)', margin: '0 8px' }}>·</span>
                <button
                  type="button"
                  onClick={() => {
                    setFollowingModalOpen(true)
                    if (me?.id) {
                      ;(async () => {
                        const { data: rows } = await supabase.from('follows').select('following_id').eq('follower_id', me.id)
                        const ids = (rows || []).map(r => r.following_id).filter(Boolean)
                        if (ids.length === 0) {
                          setFollowingList([])
                          return
                        }
                        const { data: users } = await supabase
                          .from('users')
                          .select('id,name,avatar_url,skin_type,star_level')
                          .in('id', ids)
                        setFollowingList((users || []) as any)
                      })()
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontWeight: 900 }}
                >
                  {copyFollowingLabel} {followingCount}
                </button>
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

        {/* 내 활동 현황 */}
        {me && activityProgress && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>내 활동 현황</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ border: `1px solid ${starLevelMeta(activityProgress.currentLevel).color}55`, background: `${starLevelMeta(activityProgress.currentLevel).color}18`, color: starLevelMeta(activityProgress.currentLevel).color, fontWeight: 900, fontSize: 12, padding: '6px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                  {starLevelMeta(activityProgress.currentLevel).label}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
              이번 달: 저널 {monthJournalCount}개 · 공감 {monthLikeCount}개 · {copyFollowerLabel} {monthFollowerCount}명
            </div>

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {activityProgress.nextLevel === 2 && (
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                  다음 등급까지 저널 {activityProgress.journalNeed}개 더!
                </div>
              )}
              {activityProgress.nextLevel === 3 && (
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                  다음 등급까지 저널 {activityProgress.journalNeed}개 더!
                </div>
              )}
              {activityProgress.nextLevel === 4 && (
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                  다음 등급까지 저널 {activityProgress.journalNeed}개 더!
                </div>
              )}
              {activityProgress.nextLevel === 5 && (
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>
                  다음 등급까지 {activityProgress.reviewNeed > 0 ? `구매유도 ${activityProgress.reviewNeed}건 더!` : '더 달려보자!'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {[
            { id: 'journal' as const, label: '스킨저널' },
            { id: 'reviews' as const, label: '사용후기' },
            { id: 'guestbook' as const, label: '방명록' },
            { id: 'ranking' as const, label: '랭킹' },
          ].map(t => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === 'ranking') {
                    router.push('/ranking')
                    return
                  }
                  setTab(t.id)
                }}
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

            {journalTimelineGroups.length > 0 && (
              <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>스킨저널 변화 타임라인</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {journalTimelineGroups.map(g => {
                    const min = journalScoreMin
                    const max = journalScoreMax
                    const poly = buildScorePolyline(g.scores, min, max)
                    const firstScore = g.beforeScore
                    const lastScore = g.afterScore
                    return (
                      <div key={g.productId} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            {g.product?.thumb_img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.product.thumb_img} alt="" style={{ width: 32, height: 32, borderRadius: 10, objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🧴</div>
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: '#fff', fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {g.product?.name || '제품'}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                                {g.firstDate} ~ {g.lastDate}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: 11, color: GOLD, fontWeight: 900, whiteSpace: 'nowrap' }}>
                            Before {firstScore} → After {lastScore}
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, marginBottom: 8 }}>
                          {`Before ${firstScore}점 (${g.firstDate}) → After ${lastScore}점 (${g.lastDate})`}
                        </div>

                        <svg width="100%" height="44" viewBox="0 0 132 44" style={{ display: 'block' }}>
                          <polyline points={poly} fill="none" stroke="rgba(201,168,76,0.95)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                        </svg>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {journals.length === 0 ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 16, color: 'var(--text3)', fontSize: 12 }}>
                아직 작성된 기록이 없어요.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {journals.map(j => (
                  <div
                    key={j.id}
                    id={`journal-card-${j.id}`}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12, display: 'flex', gap: 12 }}
                  >
                    <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                      {j.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>📷</div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {j.date}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                          <div style={{ fontSize: 12, color: GOLD, fontWeight: 900 }}>{stars(j.score, journalScoreMax)}</div>
                          <button
                            type="button"
                            onClick={() => openShareForJournal(j)}
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '6px 10px', color: 'var(--text3)', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
                          >
                            공유
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#fff', fontWeight: 800 }}>
                        {j.memo || '메모 없음'}
                      </div>

                      {/* 사용 제품 뱃지 */}
                      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {(Array.isArray(j.product_ids) ? j.product_ids : []).map(pid => {
                          const p = timelineProductMap.get(pid)
                          return p ? (
                            <span
                              key={`${j.id}_${pid}`}
                              style={{ border: '1px solid rgba(201,168,76,0.25)', background: 'rgba(201,168,76,0.10)', color: GOLD, fontWeight: 900, fontSize: 11, padding: '6px 10px', borderRadius: 999 }}
                            >
                              {p.name}
                            </span>
                          ) : null
                        })}
                      </div>

                      {/* 공감(좋아요) */}
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => toggleJournalLike(j.id)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: likedJournalIds.has(j.id) ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${likedJournalIds.has(j.id) ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                            color: likedJournalIds.has(j.id) ? GOLD : 'var(--text3)',
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          ❤️ 공감 {journalLikeCounts[j.id] || 0}
                        </button>
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
                    <div key={card.product.id} id={`review-card-${card.product.id}`} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                        <button
                          type="button"
                          onClick={() => openShareForReviewCard(card)}
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '6px 10px', color: 'var(--text3)', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
                        >
                          공유
                        </button>
                      </div>

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
                                <div style={{ fontSize: 12, color: GOLD, fontWeight: 900 }}>{stars(r!.rating, reviewStarMax)}</div>
                                <div style={{ marginTop: 6, fontSize: 13, color: '#fff', fontWeight: 800, lineHeight: 1.5 }}>
                                  {r!.content || ''}
                                </div>
                                {r!.images && r!.images.length > 0 && (
                                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                    {r!.images.slice(0, reviewPreviewMax).map((img, idx) => (
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

                          {/* 공감(좋아요) + 구매 연결 */}
                          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!reviewed || !r) return
                                toggleReviewLike(r.id)
                              }}
                              disabled={!reviewed || !r}
                              style={{
                                flex: 1,
                                padding: '10px 12px',
                                borderRadius: 12,
                                background: reviewed && r && likedReviewIds.has(r.id) ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${reviewed && r && likedReviewIds.has(r.id) ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                                color: reviewed && r && likedReviewIds.has(r.id) ? GOLD : 'var(--text3)',
                                fontWeight: 900,
                                cursor: !reviewed || !r ? 'not-allowed' : 'pointer',
                                opacity: !reviewed || !r ? 0.7 : 1,
                              }}
                            >
                              ❤️ 공감 {reviewed && r ? reviewLikeCounts[r.id] || 0 : 0}
                            </button>
                          </div>

                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 42, height: 42, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
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
                                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {card.product.name}
                                </div>
                                <div style={{ marginTop: 2, fontSize: 12, color: GOLD, fontWeight: 900 }}>
                                  ₩{toComma(card.product.retail_price || 0)}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => router.push(`/products/${card.product.id}`)}
                              style={{
                                width: '100%',
                                marginTop: 10,
                                padding: '12px 12px',
                                background: 'rgba(201,168,76,0.12)',
                                border: '1px solid rgba(201,168,76,0.35)',
                                color: GOLD,
                                borderRadius: 12,
                                fontWeight: 900,
                                cursor: 'pointer',
                              }}
                            >
                              나도 구매하기 →
                            </button>
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
                  maxLength={guestbookMaxChars}
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
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {guestbookMessage.trim().length}/{guestbookMaxChars}
                  </div>
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

      {/* 오랜일촌 피드 */}
      <div style={{ padding: '0 18px 0' }}>
        <div style={{ marginTop: 14, marginBottom: 12, fontSize: 13, fontWeight: 900, color: '#fff' }}>{copyFollowingLabel} 피드</div>

        {followingFeed.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 16, color: 'var(--text3)', fontSize: 12 }}>
            {copyFollowingLabel}의 기록이 없어요. 인기 스타 저널을 추천해드릴게요.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {followingFeed.map(item => {
              const a = item.author
              const j = item.journal
              const isFollowing = followingIds.has(a.id)
              const sm = starLevelMeta(a.star_level)
              return (
                <div key={`${a.id}_${j.id}`} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                        {a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>🙂</div>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                          <span style={{ border: `1px solid ${sm.color}55`, background: `${sm.color}18`, color: sm.color, fontWeight: 900, fontSize: 11, padding: '4px 8px', borderRadius: 999 }}>
                            {sm.label}
                          </span>
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>{j.date}</div>
                          <div style={{ fontSize: 12, color: GOLD, fontWeight: 900 }}>{stars(j.score, journalScoreMax)}</div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleFollow(a.id)}
                      style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${isFollowing ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`, background: isFollowing ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: isFollowing ? GOLD : 'var(--text3)', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {isFollowing ? copyFollowingBtn : copyFollowBtn}
                    </button>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ width: 92, height: 92, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                        {j.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={j.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>📷</div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, lineHeight: 1.5 }}>
                          {(j.memo || '메모 없음').slice(0, 60)}
                          {(j.memo || '').length > 60 ? '...' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 오랜일촌 리스트 바텀시트 */}
      {followersModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 55, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setFollowersModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{ width: '100%', maxWidth: 480, background: 'rgba(10,12,15,0.98)', borderTopLeftRadius: 18, borderTopRightRadius: 18, border: '1px solid var(--border)', padding: 14 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{copyFollowerLabel} 목록</div>
              <button type="button" onClick={() => setFollowersModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50vh', overflow: 'auto' }}>
              {followersList.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>아직 {copyFollowerLabel}이 없어요.</div>
              ) : (
                followersList.map(u => {
                  const sm = starLevelMeta(u.star_level)
                  const isFollowing = followingIds.has(u.id)
                  return (
                    <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                        {u.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>🙂</div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                          <span style={{ border: `1px solid ${sm.color}55`, background: `${sm.color}18`, color: sm.color, fontWeight: 900, fontSize: 11, padding: '4px 8px', borderRadius: 999 }}>
                            {sm.label}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFollow(u.id)}
                        style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${isFollowing ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`, background: isFollowing ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: isFollowing ? GOLD : 'var(--text3)', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {isFollowing ? copyFollowingBtn : copyFollowBtn}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 내가 맺은 오랜일촌 리스트 바텀시트 */}
      {followingModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 55, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setFollowingModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{ width: '100%', maxWidth: 480, background: 'rgba(10,12,15,0.98)', borderTopLeftRadius: 18, borderTopRightRadius: 18, border: '1px solid var(--border)', padding: 14 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{copyFollowingLabel} 목록</div>
              <button type="button" onClick={() => setFollowingModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 20, cursor: 'pointer' }}>
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '50vh', overflow: 'auto' }}>
              {followingList.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{copyFollowingLabel}이 없어요.</div>
              ) : (
                followingList.map(u => {
                  const sm = starLevelMeta(u.star_level)
                  const isFollowing = followingIds.has(u.id)
                  return (
                    <div key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                        {u.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.55)' }}>🙂</div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                          <span style={{ border: `1px solid ${sm.color}55`, background: `${sm.color}18`, color: sm.color, fontWeight: 900, fontSize: 11, padding: '4px 8px', borderRadius: 999 }}>
                            {sm.label}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFollow(u.id)}
                        style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${isFollowing ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`, background: isFollowing ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: isFollowing ? GOLD : 'var(--text3)', fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {isFollowing ? copyFollowingBtn : copyFollowBtn}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

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
                      if (f && !f.type?.startsWith('image/')) {
                        setAvatarError('이미지 파일만 업로드 가능합니다')
                        setAvatarFile(null)
                        if (avatarPreview) URL.revokeObjectURL(avatarPreview)
                        setAvatarPreview(null)
                        return
                      }
                      setAvatarError('')
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

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 900, marginBottom: 8 }}>사용 제품 (타임라인/뱃지)</div>
                  {journalProductsLoading ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>로딩 중...</div>
                  ) : journalProductsOptions.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>배송완료된 구매 내역이 없어요.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {journalProductsOptions.map(p => {
                        const active = journalSelectedProductIds.includes(p.id)
                        return (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() =>
                              setJournalSelectedProductIds(prev => (prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]))
                            }
                            style={{
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: `1px solid ${active ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.10)'}`,
                              background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                              color: active ? GOLD : 'rgba(255,255,255,0.75)',
                              fontWeight: 900,
                              cursor: 'pointer',
                              fontSize: 12,
                              maxWidth: 150,
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            }}
                            title={p.name}
                          >
                            {p.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text3)', marginBottom: 8, fontWeight: 900 }}>{`피부점수(${journalScoreMin}~${journalScoreMax})`}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Array.from({ length: Math.max(0, journalScoreMax - journalScoreMin + 1) }, (_, idx) => journalScoreMin + idx).map(s => {
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
                {Array.from({ length: Math.max(0, reviewStarMax - reviewStarMin + 1) }, (_, idx) => reviewStarMin + idx).map(s => {
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
                    {reviewPreviews.slice(0, reviewPreviewMax).map((p, idx) => (
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

      {sharePayload && (
        <ShareBottomSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          cardDomId={shareDomId}
          payload={sharePayload}
        />
      )}
    </div>
  )
}

