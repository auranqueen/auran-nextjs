'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/context/CartContext'
import { createClient } from '@/lib/supabase/client'
import { logUserBehavior } from '@/lib/skinAnalytics'
import '@toast-ui/editor/dist/toastui-editor-viewer.css'
import { Editor } from '@toast-ui/react-editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import '@toast-ui/editor/dist/i18n/ko-kr'
import ProductTagSection from '@/components/product/ProductTagSection'

const GOLD = '#C9A96E'

interface Product {
  id: string
  brands?: { name?: string; logo_url?: string } | null
  thumb_img?: string
  origin: string
  name: string
  description: string
  retail_price: number
  price?: number
  original_price: number
  discount_rate: number
  avg_rating: number
  review_count: number
  repurchase_rate: number
  active_users: number
  match_pct: string
  has_video: boolean
  video_url?: string
  story_hero: string
  story_sub: string
  story_quote: string
  story_desc: string
  tags: string[]
  ingredients?: { ico: string; name: string; desc: string }[]
  clinicals?: { label: string; pct: number; width: number }[]
  certs?: string[]
  together?: { ico: string; brand: string; name: string; price: string; step: string; storage_thumb_url?: string; thumb_img?: string }[]
  key_ingredients?: string | null
  clinical_result?: string | null
  certifications?: string | null
  perfect_together?: string[] | null
  hormone_timing?: string | null
  share_copy_points?: string[] | null
  share_points?: number | null
  review_points_text?: number | null
  review_points_photo?: number | null
  review_points_video?: number | null
  thumb_images: string[]
  gallery_imgs?: string[]
  storage_thumb_url: string
  is_timesale?: boolean | null
  timesale_ends_at?: string | null
  is_groupbuy?: boolean | null
  groupbuy_count?: number | null
  sale_price?: number
  sales_count?: number | null
  skin_types?: string[] | null
  skin_concerns?: string[] | null
  unit_price?: number | string | null
  unit_type?: string | null
  category_id?: string | null
  tag?: string | null
  categories?: { target_tracks?: string[] | null } | null
  is_exclusive?: boolean | null
}

export default function ProductDetailClient({
  product,
  exclusiveLocked = false,
}: {
  product: Product
  exclusiveLocked?: boolean
}) {
  const router = useRouter()
  const { addToCart } = useCart()
  const supabase = createClient()
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [myReviewDoc, setMyReviewDoc] = useState<{
    id: string
    content?: string | null
    rating?: number | null
    helpful_concerns?: string[] | null
    is_edited: boolean | null
    created_at: string
  } | null>(null)
  const [qty, setQty] = useState(1)
  const [activeThumb, setActiveThumb] = useState(0)
  const [loginSheetOpen, setLoginSheetOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareRefUserId, setShareRefUserId] = useState<string | null | undefined>(undefined)
  const [myProfileSkinType, setMyProfileSkinType] = useState<string | null>(null)
  const paymentResumeOnce = useRef(false)
  const reviewSectionRef = useRef<HTMLDivElement | null>(null)
  const reviewScrollRef = useRef<HTMLDivElement | null>(null)
  const [perfectTogetherRows, setPerfectTogetherRows] = useState<
    { id: string; name: string; retail_price: number; thumb_img?: string | null; storage_thumb_url?: string | null; brands?: { name?: string } | null }[]
  >([])
  const [sameSkinTypeRows, setSameSkinTypeRows] = useState<
    { id: string; name: string; retail_price: number; thumb_img?: string | null; storage_thumb_url?: string | null; brands?: { name?: string } | null }[]
  >([])
  const [aiRecommendLine, setAiRecommendLine] = useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingField, setEditingField] = useState<{
    field: string
    label: string
    currentValue: string
    currentValue2?: string
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editDraft2, setEditDraft2] = useState('')
  const [kIngredientImg, setKIngredientImg] = useState<string | null>(null)
  const [kAiAnalyzing, setKAiAnalyzing] = useState(false)
  const [saveToast, setSaveToast] = useState('')
  const [cartToast, setCartToast] = useState('')
  const [giftSheetOpen, setGiftSheetOpen] = useState(false)
  const [giftFriends, setGiftFriends] = useState<{ id: string; nickname: string }[]>([])
  const [giftFriendsLoading, setGiftFriendsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState('')
  const thumbFileInputRef = useRef<HTMLInputElement | null>(null)
  const detailEditorRef = useRef<any>(null)
  const [ingOpen, setIngOpen] = useState(false)
  const [isFounder, setIsFounder] = useState(false)
  const [hormoneOpen, setHormoneOpen] = useState(false)
  const [hormonePhaseIdx, setHormonePhaseIdx] = useState(0)
  const [editingHormone, setEditingHormone] = useState<{
    menstrual: { tip: string; recommend: string }
    follicular: { tip: string; recommend: string }
    ovulation: { tip: string; recommend: string }
    luteal: { tip: string; recommend: string }
  } | null>(null)
  const [hormoneSaveBusy, setHormoneSaveBusy] = useState(false)
  const [ptSearch, setPtSearch] = useState('')
  const [ptSearchHits, setPtSearchHits] = useState<{ id: string; name: string }[]>([])
  const [storyTab, setStoryTab] = useState<'all' | 'review' | 'expert' | 'ambassador'>('all')
  const [showWriteSheet, setShowWriteSheet] = useState(false)
  const [writeContent, setWriteContent] = useState('')
  const [writeSkinType, setWriteSkinType] = useState<string | null>(null)
  const [writeEffectTags, setWriteEffectTags] = useState<string[]>([])
  const [writeSubmitting, setWriteSubmitting] = useState(false)
  const [userPurchasedProduct, setUserPurchasedProduct] = useState(false)

  const [saleTimeLeft, setSaleTimeLeft] = useState(() =>
    product.timesale_ends_at
      ? Math.max(0, Math.floor((new Date(product.timesale_ends_at).getTime() - Date.now()) / 1000))
      : 0
  )
  const [weather, setWeather] = useState<any>(null)
  const [hormonePhase, setHormonePhase] = useState<string>('')
  useEffect(() => {
    if (!product.is_timesale || !product.timesale_ends_at) {
      setSaleTimeLeft(0)
      return
    }
    setSaleTimeLeft(
      Math.max(0, Math.floor((new Date(product.timesale_ends_at).getTime() - Date.now()) / 1000))
    )
  }, [product.is_timesale, product.timesale_ends_at])
  useEffect(() => {
    if (!product.is_timesale || saleTimeLeft <= 0) return
    const t = setInterval(() => setSaleTimeLeft(p => (p > 0 ? p - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [product.is_timesale, product.timesale_ends_at])
  const saleHMS = `${String(Math.floor(saleTimeLeft / 3600)).padStart(2, '0')}:${String(Math.floor((saleTimeLeft % 3600) / 60)).padStart(2, '0')}:${String(saleTimeLeft % 60).padStart(2, '0')}`

  const fetchReviews = async () => {
    setReviewsLoading(true)
    const q1 = await supabase
      .from('reviews')
      .select(
        '*, author_user:users!reviews_author_id_fkey(customer_grade, role)'
      )
      .eq('target_id', product.id)
      .eq('status', '게시')
      .order('created_at', { ascending: false })
      .limit(20)
    let rows = q1.data
    if (q1.error) {
      console.error('fetchReviews error:', q1.error)
      const q2 = await supabase
        .from('reviews')
        .select('*')
        .eq('target_id', product.id)
        .eq('status', '게시')
        .order('created_at', { ascending: false })
        .limit(20)
      if (q2.error) console.error('fetchReviews fallback error:', q2.error)
      rows = q2.data
    }
    setReviews(rows || [])
    setReviewsLoading(false)
  }

  const executeBuy = async () => {
    const qsOwner = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('prescription_owner_id') : null
    const refUserId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null
    const localOwner = typeof window !== 'undefined' ? localStorage.getItem('prescription_owner_id') : null
    const prescriptionOwnerId = qsOwner || localOwner || null

    const params = new URLSearchParams({
      product_id: product.id,
      qty: String(qty),
    })
    if (prescriptionOwnerId) params.set('prescription_owner_id', prescriptionOwnerId)
    if (refUserId) params.set('ref', refUserId)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    await logUserBehavior(supabase, user?.id ?? null, 'purchase', product.id, {
      flow: 'checkout_start',
      total_amount: price * qty,
      category_id: product.category_id ?? null,
      price,
    })
    router.push(`/checkout?${params.toString()}`)
  }

  const handleBuy = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      try { localStorage.setItem('pending_payment', 'true'); localStorage.setItem('pending_payment_ctx', 'pay') } catch {}
      setLoginSheetOpen(true)
      return
    }
    await executeBuy()
  }

  useEffect(() => {
    if (paymentResumeOnce.current) return
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      let ctx = ''
      try {
        if (localStorage.getItem('pending_payment') !== 'true') return
        ctx = localStorage.getItem('pending_payment_ctx') || ''
        if (ctx.startsWith('checkout:')) return
      } catch { return }
      paymentResumeOnce.current = true
      try { localStorage.removeItem('pending_payment'); localStorage.removeItem('pending_payment_ctx') } catch {}
      await executeBuy()
    }
    void run()
  }, [product.id, qty])

  useEffect(() => {
    if (!product?.id) return
    void fetchReviews()
  }, [product?.id])

  useEffect(() => {
    if (!product?.id) return
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setMyReviewDoc(null)
        setUserPurchasedProduct(false)
        return
      }
      const { data: orders } = await supabase.from('orders').select('id, items').eq('customer_id', session.user.id)
      let purchased = false
      ;(orders || []).forEach((row: any) => {
        if (purchased) return
        const raw = row?.items
        let parsed: any[] = []
        if (Array.isArray(raw)) parsed = raw
        else if (typeof raw === 'string') { try { parsed = JSON.parse(raw) } catch {} }
        if (Array.isArray(parsed) && parsed.some(it => String(it?.product_id || '') === String(product.id))) purchased = true
      })
      if (!purchased) {
        const orderIds = (orders || []).map((o: any) => o.id).filter(Boolean)
        if (orderIds.length > 0) {
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('product_id')
            .eq('product_id', product.id)
            .in('order_id', orderIds)
          if (orderItems && orderItems.length > 0) purchased = true
        }
      }
      setUserPurchasedProduct(purchased)
      const { data: meRow } = await supabase.from('users').select('id').eq('auth_id', session.user.id).maybeSingle()
      const internalUid = meRow?.id
      if (!internalUid) {
        setMyReviewDoc(null)
        return
      }
      const { data: myReviewRow } = await supabase.from('reviews')
        .select('id, content, rating, helpful_concerns, is_edited, created_at')
        .eq('author_id', internalUid)
        .eq('target_id', product.id)
        .maybeSingle()
      setMyReviewDoc(myReviewRow || null)
      if (myReviewRow) return
    }
    void run()
  }, [product?.id])

  useEffect(() => {
    const raw = product.perfect_together
    const ids = Array.isArray(raw) ? raw.map(x => String(x)).filter(Boolean) : []
    if (ids.length === 0) { setPerfectTogetherRows([]); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('products')
        .select('id,name,retail_price,thumb_img,storage_thumb_url,brands(name)').in('id', ids)
      if (cancelled) return
      const rows = (data || []) as any[]
      const order = new Map(ids.map((id, i) => [id, i]))
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      setPerfectTogetherRows(rows)
    })()
    return () => { cancelled = true }
  }, [product.id, product.perfect_together])

  useEffect(() => {
    setEditingHormone(null)
    setPtSearch('')
    setPtSearchHits([])
  }, [product.id])

  useEffect(() => {
    if (!isSuperAdmin || !isEditMode) {
      setEditingHormone(null)
      return
    }
    setEditingHormone((prev) => {
      if (prev !== null) return prev
      let map: Record<string, { tip?: string; recommend?: string }> = {}
      try {
        const ht = product.hormone_timing && String(product.hormone_timing).trim()
        if (ht) {
          const j = JSON.parse(String(product.hormone_timing))
          if (j && typeof j === 'object' && !Array.isArray(j)) map = j as Record<string, { tip?: string; recommend?: string }>
        }
      } catch {
        map = {}
      }
      const pick = (k: 'menstrual' | 'follicular' | 'ovulation' | 'luteal') => ({
        tip: String(map[k]?.tip ?? ''),
        recommend: String(map[k]?.recommend ?? ''),
      })
      return {
        menstrual: pick('menstrual'),
        follicular: pick('follicular'),
        ovulation: pick('ovulation'),
        luteal: pick('luteal'),
      }
    })
  }, [isSuperAdmin, isEditMode, product.hormone_timing, product.id])

  useEffect(() => {
    if (!isSuperAdmin || !isEditMode) {
      setPtSearchHits([])
      return
    }
    const q = ptSearch.trim()
    if (q.length < 1) {
      setPtSearchHits([])
      return
    }
    const existing = new Set([
      String(product.id),
      ...(Array.isArray(product.perfect_together) ? product.perfect_together.map((x) => String(x)) : []),
    ])
    const t = setTimeout(() => {
      void (async () => {
        const { data } = await supabase
          .from('products')
          .select('id,name')
          .ilike('name', `%${q}%`)
          .eq('status', 'active')
          .limit(12)
        const rows = ((data as { id: string; name: string }[]) || []).filter((r) => !existing.has(r.id))
        setPtSearchHits(rows)
      })()
    }, 250)
    return () => clearTimeout(t)
  }, [ptSearch, isSuperAdmin, isEditMode, product.id, product.perfect_together, supabase])

  useEffect(() => {
    if (!product?.id) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) { if (!cancelled) setSameSkinTypeRows([]); return }
      const { data: profile } = await supabase.from('profiles').select('skin_type').eq('auth_id', session.user.id).maybeSingle()
      const skinType = String((profile as any)?.skin_type || '').trim()
      setMyProfileSkinType(skinType || null)
      if (!skinType) { if (!cancelled) setSameSkinTypeRows([]); return }
      const { data } = await supabase.from('products')
        .select('id,name,retail_price,thumb_img,storage_thumb_url,brands(name)')
        .contains('skin_types', [skinType]).neq('id', product.id).eq('status', 'active').limit(4)
      if (cancelled) return
      setSameSkinTypeRows((data || []) as any[])
    })()
    return () => { cancelled = true }
  }, [product.id])

  useEffect(() => {
    if (!product?.id) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) {
        if (!cancelled) {
          setAiRecommendLine(null)
          setIsFounder(false)
        }
        return
      }
      const { data: gradeRow } = await supabase.from('users').select('customer_grade').eq('auth_id', uid).maybeSingle()
      if (cancelled) return
      setIsFounder(['NOIR', 'CÉLESTE'].includes(String((gradeRow as { customer_grade?: string } | null)?.customer_grade || '')))
      const { data: profile } = await supabase.from('profiles').select('skin_type').eq('auth_id', uid).maybeSingle()
      if (cancelled) return
      const userSkinType = String((profile as any)?.skin_type || '').trim()
      if (!product.skin_types?.includes(userSkinType)) { setAiRecommendLine(null); return }
      setAiRecommendLine(`✦ 내 피부타입(${userSkinType})에 맞는 제품이에요`)
    })()
    return () => { cancelled = true }
  }, [product.id, product.skin_types])

  useEffect(() => {
    if (!shareOpen) return
    setShareRefUserId(undefined)
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setShareRefUserId(session?.user?.id ?? null)
    })
  }, [shareOpen])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user as any
      const role = user?.app_metadata?.role ?? user?.raw_app_meta_data?.role ?? ''
      setIsSuperAdmin(role === 'super_admin')
    })

    void fetch('/api/weather?lat=37.5665&lon=126.9780')
      .then(r => r.json())
      .then(d => setWeather(d))
      .catch(() => {})

    void (async () => {
      const { data: { session } } =
        await supabase.auth.getSession()
      if (!session?.user) return
      const { data: hc } = await supabase
        .from('hormone_cycles')
        .select('track, cycle_start_date, cycle_length')
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (!hc) return
      const today = new Date()
      const start = new Date(
        (hc as any).cycle_start_date
      )
      const diff = Math.floor(
        (today.getTime() - start.getTime())
        / (1000 * 60 * 60 * 24)
      ) + 1
      const len = (hc as any).cycle_length || 28
      const day = ((diff - 1) % len) + 1
      const track = (hc as any).track || ''
      let phase = '전연령'
      if (track === 'menopause_peri' ||
          track === 'menopause_post')
        phase = '갱년기'
      else if (track === 'male' ||
               track === 'male_menopause')
        phase = '남성'
      else if (day <= 5) phase = '달빛기'
      else if (day <= 13) phase = '황금기'
      else if (day <= 16) phase = '만개기'
      else phase = '물들기'
      setHormonePhase(phase)
    })()
  }, [])

  useEffect(() => {
    if (editingField?.field === 'storage_thumb_url') {
      setSelectedFile(null)
      setThumbPreviewUrl(editingField.currentValue)
    }
  }, [editingField])

  useEffect(() => {
    if (editingField === null) setSelectedFile(null)
  }, [editingField])

  useEffect(() => {
    if (!selectedFile) return
    const u = URL.createObjectURL(selectedFile)
    setThumbPreviewUrl(u)
    return () => { URL.revokeObjectURL(u) }
  }, [selectedFile])

  useEffect(() => {
    if (editingField) {
      setEditDraft(editingField.currentValue)
      setEditDraft2(editingField.currentValue2 ?? '')
      setEditError(null)
    }
  }, [editingField])

  useEffect(() => {
    if (!saveToast) return
    const t = setTimeout(() => setSaveToast(''), 2200)
    return () => clearTimeout(t)
  }, [saveToast])

  useEffect(() => {
    if (!cartToast) return
    const t = setTimeout(() => setCartToast(''), 2200)
    return () => clearTimeout(t)
  }, [cartToast])

  useEffect(() => {
    if (!giftSheetOpen) return
    let cancelled = false
    ;(async () => {
      setGiftFriendsLoading(true)
      setGiftFriends([])
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        if (!cancelled) setGiftFriendsLoading(false)
        return
      }
      const { data: me } = await supabase.from('users').select('id').eq('auth_id', session.user.id).maybeSingle()
      if (!me?.id || cancelled) {
        if (!cancelled) setGiftFriendsLoading(false)
        return
      }
      const { data: rows } = await supabase.from('follows').select('following_id').eq('follower_id', me.id)
      if (cancelled) return
      const fids = Array.from(new Set((rows || []).map((r: { following_id?: string }) => r.following_id).filter(Boolean) as string[]))
      if (!fids.length) {
        setGiftFriends([])
        setGiftFriendsLoading(false)
        return
      }
      const { data: us } = await supabase.from('users').select('id, auth_id').in('id', fids)
      if (cancelled) return
      const authIds = Array.from(new Set((us || []).map((u: { auth_id?: string | null }) => u.auth_id).filter(Boolean) as string[]))
      const { data: profs } = authIds.length
        ? await supabase.from('profiles').select('auth_id, username, full_name').in('auth_id', authIds)
        : { data: [] as { auth_id: string; username?: string | null; full_name?: string | null }[] }
      if (cancelled) return
      const profByAuth = new Map((profs || []).map((p) => [p.auth_id, p]))
      const list = (us || []).map((u: { id: string; auth_id?: string | null }) => {
        const p = u.auth_id ? profByAuth.get(u.auth_id) : undefined
        const nickname = String(p?.username || p?.full_name || '').trim() || '일촌'
        return { id: String(u.id), nickname }
      })
      setGiftFriends(list)
      setGiftFriendsLoading(false)
    })()
    return () => { cancelled = true }
  }, [giftSheetOpen])

  const analyzeKeyIngredients = async () => {
    if (!editDraft.trim() && !kIngredientImg) return
    setKAiAnalyzing(true)
    try {
      const messages: any[] = []
      if (kIngredientImg) {
        const base64 = kIngredientImg.split(',')[1]
        const mimeMatch = kIngredientImg.match(/data:(.*?);base64/)
        const mediaType = (mimeMatch?.[1] as any) || 'image/jpeg'
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: editDraft.trim()
                ? `이미지와 텍스트를 함께 분석해줘:\n${editDraft}`
                : '이 전성분표를 분석해줘.',
            },
          ],
        })
      } else {
        messages.push({
          role: 'user',
          content: editDraft,
        })
      }

      const systemPrompt = `너는 화장품 전성분 분석 전문가야.
전성분표를 보고 아래 JSON만 출력해.

{
  "step_tags": [],
  "func_tags": [],
  "hormone_tags": [],
  "skin_types": [],
  "situation_tags": [],
  "ingredient_tags": [],
  "medical_tags": [],
  "weather_tags": [],
  "reason": ""
}

step_tags: 클렌징|토너|앰플·세럼|크림|선케어|마스크·팩|바디케어|헤어케어
func_tags: 보습·수분|탄력·주름|미백·톤업|진정·민감|장벽·재생|모공·피지|아로마·릴렉스|트러블케어|노화케어
hormone_tags: 달빛기|황금기|만개기|물들기|갱년기|남성|전연령
skin_types: 건성|지성|복합성|민감성|중성|모든피부
situation_tags: 여드름·뾰루지|피지·모공|압출후|시술후|임신·수유중|아토피|체취케어
ingredient_tags: 비건|무향|EWG그린|임산부안전|레티놀함유|AHA함유|BHA함유|나이아신아마이드|세라마이드|히알루론산|펩타이드
medical_tags: 아토피|보톡스후|필러후|레이저후
weather_tags: 자외선높음|자외선매우높음|미세먼지나쁨|건조한날|전천후

갱년기 hormone_tags 추가 기준:
아래 성분 중 하나라도 포함 시
hormone_tags에 '갱년기' 추가:
이소플라본, 콜라겐 펩타이드,
CoQ10/코엔자임Q10, 레스베라트롤,
비타민E 고함량, 열감 진정 성분,
로즈/장미 추출물, 자스민/재스민 추출물,
네롤리 추출물, 일랑일랑,
클라리세이지, 제라늄,
라벤더 고함량, 달맞이꽃 오일,
블랙커런트 오일
브랜드명 이타카(ITHACA) 또는
르노벨(RENOBELL) 제품이면
hormone_tags에 '갱년기' 자동 추가

남성 hormone_tags·gender_tag 기준:
제품명에 '옴므'/'맨'/'남성' 포함
또는 징크/살리실산 고함량 시
hormone_tags에 '남성' 추가
gender_tag: '남성'

공용 제품:
위 조건 해당 없으면
hormone_tags에 '갱년기'·'남성' 넣지 마
해당 단계 없으면 '전연령' 추가`

      const res = await fetch('/api/analyze-ingredients', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          systemPrompt,
        }),
      })
      const data = await res.json()
      const raw = data.content?.map((c: any) => c.text || '').join('')
      const clean = raw.replace(/```json|```/g, '').trim()
      const result = JSON.parse(clean)

      await supabase
        .from('products')
        .update({
          step_tags: result.step_tags || [],
          func_tags: result.func_tags || [],
          hormone_tags: result.hormone_tags || [],
          skin_types: result.skin_types?.length ? result.skin_types : null,
          situation_tags: result.situation_tags || [],
          ingredient_tags: result.ingredient_tags || [],
          medical_tags: result.medical_tags || [],
          weather_tags: result.weather_tags || [],
          ai_tag_status: 'ai_suggested',
        })
        .eq('id', product.id)

      alert('AI 분석 완료! 태그가 저장됐어요 ✦')
      setKIngredientImg(null)
    } catch {
      alert('AI 분석 실패. 다시 시도해주세요.')
    } finally {
      setKAiAnalyzing(false)
    }
  }

  const brand = product.brands?.name || 'AURAN'
  const name = product.name ?? '제품명'
  const seoDesc = product.description ?? ''
  const priceRaw = product.is_timesale
    ? (product.sale_price ?? (product as any).price ?? 0)
    : product.is_groupbuy
      ? (product.sale_price ?? (product as any).price ?? 0)
      : (product.retail_price ?? (product as any).price ?? 0)
  const price = Number(priceRaw) || 0
  const hasValidPrice = price > 0
  const retailPrice = Number(product.retail_price ?? (product as any).price ?? 0) || 0
  const origPrice = product.original_price ?? 0
  const discountFromDB = product.discount_rate ?? 0
  const discountCalc = product.retail_price > 0 && price < product.retail_price
    ? Math.round((1 - price / product.retail_price) * 100)
    : 0
  const discount = discountFromDB > 0 ? discountFromDB : discountCalc
  const rating = product.avg_rating ?? 4.9
  const reviewCount = reviews.length > 0 ? reviews.length : (product.review_count ?? 0)
  const repurchaseRate = product.repurchase_rate ?? 0
  const activeUsers = product.active_users ?? 0
  const matchPct = product.match_pct ?? ''
  const hasVideo = Boolean(String(product.video_url || '').trim()) || (product.has_video ?? false)
  const tags = product.tags ?? []
  const tagLine = String((product as any).tag || '').trim() || (tags.length ? tags.join(', ') : '')
  const keyIngredientsText = String(product.key_ingredients ?? '').trim()
  const ingredientLinesAll = keyIngredientsText ? keyIngredientsText.split('\n').map(s => s.trim()).filter(Boolean) : []
  const ingredientPreviewLines = ingredientLinesAll.slice(0, 3)
  const ingredientExtraCount = Math.max(0, ingredientLinesAll.length - 3)
  const clinicalResultText = String(product.clinical_result ?? '').trim()
  const certificationLines = String(product.certifications ?? '').split('\n').map(s => s.trim()).filter(Boolean)
  const thumbImgs = product.thumb_images ?? []
  const galleryImgs = product.gallery_imgs ?? []
  const thumbUrl = product.storage_thumb_url || product.thumb_img || thumbImgs[0] || galleryImgs[0] || ''
  const pointRateRaw = Number(
    (product as any).earn_points_percent > 0
      ? (product as any).earn_points_percent
      : ((product.brands as any)?.default_earn_points ?? 0)
  )
  const pointRate = Number.isFinite(pointRateRaw) && pointRateRaw > 0 ? Math.min(100, Math.max(0, pointRateRaw)) : 1
  const expectedPurchasePts = Math.floor((price * pointRate) / 100)
  const rt = product.review_points_text
  const rp = product.review_points_photo
  const rv = product.review_points_video
  const hasAllReviewToastNums =
    rt != null &&
    rp != null &&
    rv != null &&
    Number.isFinite(Number(rt)) &&
    Number.isFinite(Number(rp)) &&
    Number.isFinite(Number(rv))
  const detailHtml = ((product as any).detail_html || (product as any).detail_content) ? String((product as any).detail_html || (product as any).detail_content || '') : ''
  const total = (price * qty).toLocaleString() + '원'
  const shareLinkWithRef =
    typeof window !== 'undefined'
      ? `${window.location.origin}/products/${product.id}${
          typeof shareRefUserId === 'string' && shareRefUserId ? `?ref=${shareRefUserId}` : ''
        }`
      : ''

  const isDiscount = product.is_groupbuy || product.is_timesale
  const brandRate = Number((product.brands as any)?.share_rate ?? 3)
  const overrideRate = (product as any).share_rate_override != null ? Number((product as any).share_rate_override) : null
  const shareRate = isDiscount ? 2 : (overrideRate ?? brandRate)
  const basePrice = Number(product.retail_price ?? 0)
  const sharePtsAmount = Math.max(0, Math.floor(basePrice * shareRate / 100))

  const recordShare = async (channel: string) => {
    try {
      const authId = shareRefUserId
      if (!authId || typeof authId !== 'string') return

      const { data: userRow, error: userLookupErr } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authId)
        .maybeSingle()
      if (userLookupErr) {
        console.warn('[recordShare] users lookup', userLookupErr)
        return
      }
      if (!userRow?.id) return

      const { error: logErr } = await supabase.from('share_logs' as any).insert({
        sharer_user_id: userRow.id,
        product_id: product.id,
        channel,
      })
      if (logErr) console.warn('[recordShare] share_logs', logErr)

      if (sharePtsAmount > 0) {
        const { data: uRow, error: ptsFetchErr } = await supabase
          .from('users')
          .select('points')
          .eq('id', userRow.id)
          .maybeSingle()
        if (ptsFetchErr) {
          console.warn('[recordShare] points fetch', ptsFetchErr)
          return
        }
        if (uRow) {
          const { error: upErr } = await supabase
            .from('users')
            .update({ points: (Number(uRow.points) || 0) + sharePtsAmount })
            .eq('id', userRow.id)
          if (upErr) {
            console.warn('[recordShare] points update', upErr)
            return
          }
          const { error: ttErr } = await supabase.from('toast_transactions').insert({
            user_id: userRow.id,
            amount: sharePtsAmount,
            transaction_type: 'share',
            source_type: 'review_bonus',
            reference_id: product.id,
          } as any)
          if (ttErr) console.warn('[recordShare] toast_transactions', ttErr)
        }
      }
    } catch (e) {
      console.warn('recordShare failed', e)
    }
  }

  // 리뷰 통계
  let reviewListAvg = 0
  const concernFreq: Record<string, number> = {}
  const skinTypeStats: Record<string, { count: number; sum: number }> = {}
  const effectFreq: Record<string, number> = {}
  const periodFreq: Record<string, number> = {}

  if (reviews.length >= 1) {
    let sumR = 0
    for (const r of reviews) {
      const rv = Number(r?.rating || 0)
      sumR += rv
      if (Array.isArray(r?.helpful_concerns)) {
        for (const k of r.helpful_concerns) {
          const key = String(k || '').trim()
          if (key) concernFreq[key] = (concernFreq[key] || 0) + 1
        }
      }
      const st = String(r?.skin_type || '').trim()
      if (st) {
        if (!skinTypeStats[st]) skinTypeStats[st] = { count: 0, sum: 0 }
        skinTypeStats[st].count++
        skinTypeStats[st].sum += rv
      }
      if (Array.isArray(r?.effect_tags)) {
        for (const et of r.effect_tags) {
          const key = String(et || '').trim()
          if (key) effectFreq[key] = (effectFreq[key] || 0) + 1
        }
      }
      const period = String(r?.usage_period || '').trim()
      if (period) periodFreq[period] = (periodFreq[period] || 0) + 1
    }
    reviewListAvg = sumR / reviews.length
  }
  const top3Concerns = Object.entries(concernFreq).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const top4Effects = Object.entries(effectFreq).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const longTermUsers = (periodFreq['1달'] || 0) + (periodFreq['3달 이상'] || 0)
  const longTermPct = reviews.length > 0 ? Math.round((longTermUsers / reviews.length) * 100) : 0

  const sharePts = Array.isArray(product.share_copy_points)
    ? product.share_copy_points.map((x) => String(x || '').trim()).filter(Boolean)
    : []
  let hormoneMap: Record<string, { tip?: string; recommend?: string }> = {}
  try {
    const ht = product.hormone_timing && String(product.hormone_timing).trim()
    if (ht) {
      const j = JSON.parse(String(product.hormone_timing))
      if (j && typeof j === 'object' && !Array.isArray(j)) hormoneMap = j as Record<string, { tip?: string; recommend?: string }>
    }
  } catch {
    hormoneMap = {}
  }
  const hormonePhaseKeys = ['menstrual', 'follicular', 'ovulation', 'luteal'] as const
  const hormoneLabels = ['달빛기🌙', '황금기🌱', '만개기✨', '물들기🌸']
  const curHormoneKey = hormonePhaseKeys[hormonePhaseIdx] || 'menstrual'
  const curHormone = hormoneMap[curHormoneKey] || {}
  const storyFiltered = (() => {
    const isAmb = (r: any) => ['NOIR', 'CÉLESTE'].includes(String(r?.author_user?.customer_grade || ''))
    const isExp = (r: any) => {
      const role = String(r?.author_user?.role || '')
      const g = String(r?.author_user?.customer_grade || '')
      if (role === 'owner') return true
      if (/원장|클리닉|owner|salon/i.test(g)) return true
      if (r?.link_post?.is_expert_answered === true) return true
      return false
    }
    if (storyTab === 'all') return reviews
    if (storyTab === 'ambassador') return reviews.filter(isAmb)
    if (storyTab === 'expert') return reviews.filter(isExp)
    return reviews.filter((r: any) => !isExp(r) && !isAmb(r))
  })()

  const wrap: React.CSSProperties = {
    background: '#0d0b09', color: '#e8e4dc', maxWidth: 430,
    margin: '0 auto', minHeight: '100dvh', maxHeight: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any,
    paddingBottom: 'calc(132px + env(safe-area-inset-bottom, 0px))',
    fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
  }
  const tag = (bg: string, color: string, border: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: 10, padding: '2px 9px',
    borderRadius: 20, background: bg, color, border: `1px solid ${border}`,
  })

  const thumbs = thumbImgs
  const maxThumbs = thumbs.slice(0, 4)
  const activeMainImageUrl =
    activeThumb === 0 ? thumbUrl
    : activeThumb >= 1 && activeThumb <= maxThumbs.length ? maxThumbs[activeThumb - 1]
    : activeThumb > maxThumbs.length ? galleryImgs[activeThumb - maxThumbs.length - 1] || thumbUrl
    : thumbUrl

  const showEditChrome = isSuperAdmin && isEditMode
  const perfectTogetherAddSearch = (
    <>
      <input
        type="text"
        value={ptSearch}
        onChange={(e) => setPtSearch(e.target.value)}
        placeholder="제품명 검색"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.12)',
          background: '#141210',
          color: '#fff',
          fontSize: 12,
          fontFamily: 'inherit',
        }}
      />
      {ptSearchHits.length > 0 ? (
        <div
          style={{
            marginTop: 8,
            maxHeight: 180,
            overflowY: 'auto',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {ptSearchHits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                void (async () => {
                  const raw = product.perfect_together
                  const ids = Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : []
                  if (ids.includes(h.id)) return
                  const next = [...ids, h.id]
                  const { error } = await supabase.from('products').update({ perfect_together: next }).eq('id', product.id)
                  if (error) return
                  const { data: row } = await supabase
                    .from('products')
                    .select('id,name,retail_price,thumb_img,storage_thumb_url,brands(name)')
                    .eq('id', h.id)
                    .maybeSingle()
                  if (row) setPerfectTogetherRows((prev) => [...prev, row as any])
                  setSaveToast('저장했어요')
                  setPtSearch('')
                  setPtSearchHits([])
                  router.refresh()
                })()
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'transparent',
                color: '#e8e4dc',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {h.name}
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
  const maleMeno = Array.isArray(product.categories?.target_tracks)
    ? product.categories?.target_tracks?.map(x => String(x)).includes('male_menopause')
    : false

  if (exclusiveLocked) {
    return (
      <div
        style={{
          background: '#0d0b09',
          color: '#e8e4dc',
          maxWidth: 430,
          margin: '0 auto',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
        }}
      >
        <div style={{ fontSize: 16, lineHeight: 1.65, color: '#e8e4dc', marginBottom: 20 }}>
          원장님과 상담 후 만나볼 수 있는 브랜드예요 💜
        </div>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/dashboard/customer/chat/new?from=product&product_id=${encodeURIComponent(product.id)}`
            )
          }
          style={{
            padding: '14px 24px',
            borderRadius: 12,
            border: 'none',
            background: `linear-gradient(135deg,${GOLD},#a07840)`,
            color: '#000',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          원장님께 상담 신청하기
        </button>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div
        onClick={() => setShareOpen((o) => !o)}
        style={{
          background: 'rgba(123,94,167,0.12)',
          borderTop: '1px solid rgba(123,94,167,0.2)',
          borderBottom: '1px solid rgba(123,94,167,0.2)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🍓</span>
          <div>
            <div style={{ fontSize: 12, color: '#c4a8ff', lineHeight: 1.4 }}>이렇게 좋은 제품 나만 쓰기 너무해</div>
            <div style={{ fontSize: 11, color: 'rgba(201,169,110,0.9)', marginTop: 2 }}>
              공유하면 딸기잼 {sharePtsAmount.toLocaleString()} 적립
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 11,
          color: '#7B5EA7',
          background: 'rgba(123,94,167,0.2)',
          border: '1px solid rgba(123,94,167,0.3)',
          borderRadius: 20,
          padding: '5px 12px',
          whiteSpace: 'nowrap',
        }}>
          공유하기
        </div>
      </div>
      {shareOpen ? (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 89, background: 'transparent' }}
          onClick={() => setShareOpen(false)}
          aria-hidden
        />
      ) : null}
      {/* 탑바 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#0d0b09', position: 'sticky', top: 0, zIndex: 90 }}>
        <div style={{ fontSize: 20, color: GOLD, cursor: 'pointer' }} onClick={() => router.back()}>←</div>
        <div
          onClick={() => router.push('/')}
          style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: '#C9A96E', letterSpacing: '4px', cursor: 'pointer' }}
        >AURAN</div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 9, color: '#7B5EA7' }}>공유</div>
          {shareOpen ? (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 8,
                width: 'min(300px, calc(100vw - 24px))',
                background: '#1a1610',
                border: '1px solid rgba(123,94,167,0.35)',
                borderRadius: 14,
                padding: 14,
                zIndex: 91,
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              }}
            >
              <div style={{ fontSize: 12, color: '#B09AD0', marginBottom: 8 }}>공유 카피</div>
              {sharePts.length > 0 ? (
                <ul style={{ margin: '0 0 10px 0', paddingLeft: 18, fontSize: 11, color: '#e8e4dc', lineHeight: 1.5 }}>
                  {sharePts.map((line, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{line}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>등록된 카피포인트가 없어요</div>
              )}
              <button
                type="button"
                onClick={() => {
                  const url = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''
                  const text = sharePts.length ? sharePts.join('\n') : `${name}\n${url}`
                  void (async () => {
                    try {
                      if (typeof navigator !== 'undefined' && navigator.share) {
                        await navigator.share({ title: name, text, url })
                      } else {
                        await navigator.clipboard.writeText(`${text}\n${url}`)
                        alert('내용을 복사했어요. 카카오톡에 붙여넣기 하세요!')
                      }
                      void recordShare('kakao')
                    } catch {
                      /* user cancelled or share/copy failed */
                    }
                  })()
                }}
                style={{
                  width: '100%',
                  marginBottom: 8,
                  padding: '12px 0',
                  borderRadius: 12,
                  border: 'none',
                  background: '#FEE500',
                  color: '#191600',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                }}
              >
                카카오톡 공유
              </button>
              {shareRefUserId === null ? (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                    로그인하면 추천 링크 복사가 열려요.
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void supabase.auth.signInWithOAuth({
                        provider: 'kakao',
                        options: { redirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 12,
                      border: 'none',
                      background: '#FEE500',
                      color: '#191600',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 700,
                    }}
                  >
                    카카오 로그인
                  </button>
                </div>
              ) : shareRefUserId ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        try {
                          await navigator.clipboard.writeText(shareLinkWithRef)
                          alert('추천 링크를 복사했어요!')
                          void recordShare('link')
                        } catch {
                          /* copy failed */
                        }
                      })()
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      borderRadius: 12,
                      border: '1px solid rgba(123,94,167,0.45)',
                      background: 'rgba(123,94,167,0.15)',
                      color: '#e8d9ff',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    내 추천 링크 복사
                  </button>
                  <div style={{ fontSize: 10, color: '#666', lineHeight: 1.5, marginTop: 10 }}>
                    친구 가입·첫구매 시 토스트 추가 적립이 있을 수 있어요. (캠페인 기준)
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: '#666' }}>연결 확인 중…</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* 갤러리 */}
      <div style={{ position: 'relative', background: '#0f0c08' }}>
        <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#1e1810,#131008)', position: 'relative' }}>
          {discount > 0 && (
            <div style={{ position: 'absolute', top: 14, left: 14, background: '#c02030', color: '#fff', fontSize: 12, padding: '4px 12px', borderRadius: 20 }}>⚡ -{discount}%</div>
          )}
          <div style={{ position: 'absolute', top: 14, right: 14, background: '#2a1f0e', border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, padding: '3px 10px', borderRadius: 20 }}>
            피부 매칭 {matchPct}
          </div>
          {activeThumb === 99 ? (
            <video src={product.video_url} controls muted playsInline preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            activeMainImageUrl ? (
              <div style={{ position: 'absolute', inset: 0 }}>
                <img src={activeMainImageUrl} alt={name} loading="eager" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ fontSize: 80, color: '#555' }}>🧴</div>
            )
          )}
        </div>

        {/* 썸네일 스트립 */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: '#0a0807', overflowX: 'auto' }}>
          <div
            data-edit-field="storage_thumb_url"
            onClick={isEditMode ? (e) => { e.stopPropagation(); setEditingField({ field: 'storage_thumb_url', label: '썸네일 이미지 수정', currentValue: thumbUrl }) } : undefined}
            style={{
              position: showEditChrome ? 'relative' : undefined,
              flexShrink: 0,
              outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
              outlineOffset: showEditChrome ? 2 : undefined,
              borderRadius: showEditChrome ? 8 : undefined,
              cursor: isEditMode ? 'pointer' : undefined,
            }}
          >
            {showEditChrome ? (
              <span style={{ position: 'absolute', top: 2, right: 2, zIndex: 2, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>✏️</span>
            ) : null}
            <div onClick={() => setActiveThumb(0)} onMouseEnter={() => setActiveThumb(0)}
              style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === 0 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {thumbUrl ? <img src={thumbUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 26 }}>🧴</div>}
            </div>
          </div>
          {maxThumbs.map((url, i) => (
            <div key={i} onClick={() => setActiveThumb(i + 1)} onMouseEnter={() => setActiveThumb(i + 1)}
              style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === i + 1 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {galleryImgs.map((url, i) => (
            <div key={`g-${i}`} onClick={() => setActiveThumb(maxThumbs.length + i + 1)} onMouseEnter={() => setActiveThumb(maxThumbs.length + i + 1)}
              style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === maxThumbs.length + i + 1 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {hasVideo && (
            <div onClick={() => setActiveThumb(99)} onMouseEnter={() => setActiveThumb(99)}
              style={{ width: 58, height: 58, borderRadius: 8, flexShrink: 0, border: `2px solid ${activeThumb === 99 ? GOLD : 'transparent'}`, background: '#1a1008', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
              <video src={product.video_url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(201,169,110,0.9)', borderRadius: 3, padding: '1px 4px', fontSize: 8, color: '#000' }}>▶</div>
            </div>
          )}
        </div>
      </div>

      {(() => {
        const now = new Date()
        const et = (product as any).event_title
        const es = (product as any).event_starts_at
        const ee = (product as any).event_ends_at
        if (!et) return null
        if (es && new Date(es) > now) return null
        if (ee && new Date(ee) < now) return null
        return (
          <div style={{
            background: 'rgba(201,169,110,0.08)',
            borderTop: '1px solid rgba(201,169,110,0.2)',
            borderBottom: '1px solid rgba(201,169,110,0.2)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{(product as any).event_emoji || '🎁'}</span>
              <div>
                <div style={{ fontSize: 12, color: '#C9A96E' }}>{et}</div>
                {(product as any).event_desc && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{(product as any).event_desc}</div>
                )}
              </div>
            </div>
            {ee && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                D-{Math.max(0, Math.ceil((new Date(ee).getTime() - now.getTime()) / 86400000))}
              </div>
            )}
          </div>
        )
      })()}

      {/* 제품 기본 정보 */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 12, color: '#888' }}>{brand}</span>
          <span style={tag('#1a2e1a','#6fcf97','#2a4a2a')}>재구매 {repurchaseRate}%</span>
          <span style={tag('#1a1e30','#74b0ff','#2a2e50')}>일촌 {activeUsers}명 사용중</span>
        </div>
        {(product as any)?.origin && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            원산지: {(product as any).origin}
          </div>
        )}
        {isFounder && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)', borderRadius: 20, marginBottom: 8, width: 'fit-content' }}>
            <span style={{ fontSize: 11, color: '#C9A96E' }}>👑 AURAN Founders 평생 2% 추가 할인 적용 중</span>
          </div>
        )}
        {aiRecommendLine ? (
          <div style={{ alignSelf: 'flex-start', marginBottom: 6, display: 'inline-block', background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.3)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: GOLD }}>
            {aiRecommendLine}
          </div>
        ) : null}
        {(showEditChrome ||
          !!(product.hormone_timing && String(product.hormone_timing).trim()) ||
          Object.keys(hormoneMap).length > 0) ? (
          <div
            style={{
              marginBottom: 10,
              borderRadius: 12,
              border: showEditChrome ? '2px dashed rgba(123,94,167,0.45)' : '1px solid rgba(123,94,167,0.25)',
              background: 'rgba(123,94,167,0.06)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setHormoneOpen((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                color: '#e8d9ff',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span>호르몬 주기별 케어 타이밍</span>
              <span style={{ color: '#888', fontSize: 11 }}>{hormoneOpen ? '접기' : '펼치기'}</span>
            </button>
            {hormoneOpen ? (
              <div style={{ padding: '0 12px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  {hormoneLabels.map((lb, i) => (
                    <button
                      key={lb}
                      type="button"
                      onClick={() => setHormonePhaseIdx(i)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 20,
                        border: hormonePhaseIdx === i ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)',
                        background: hormonePhaseIdx === i ? 'rgba(201,169,110,0.12)' : 'rgba(0,0,0,0.2)',
                        color: hormonePhaseIdx === i ? GOLD : '#aaa',
                        fontSize: 11,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {lb}
                    </button>
                  ))}
                </div>
                {showEditChrome && editingHormone ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: '#B09AD0', marginBottom: 4 }}>Tip</div>
                    <textarea
                      value={editingHormone[curHormoneKey].tip}
                      onChange={(e) => {
                        const v = e.target.value
                        setEditingHormone((prev) => {
                          if (!prev) return prev
                          return { ...prev, [curHormoneKey]: { ...prev[curHormoneKey], tip: v } }
                        })
                      }}
                      rows={3}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: 11,
                        color: '#ccc',
                        background: '#141210',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        padding: 8,
                        marginBottom: 8,
                        fontFamily: 'inherit',
                        resize: 'vertical' as const,
                      }}
                    />
                    <div style={{ fontSize: 10, color: GOLD, marginBottom: 4 }}>추천</div>
                    <textarea
                      value={editingHormone[curHormoneKey].recommend}
                      onChange={(e) => {
                        const v = e.target.value
                        setEditingHormone((prev) => {
                          if (!prev) return prev
                          return { ...prev, [curHormoneKey]: { ...prev[curHormoneKey], recommend: v } }
                        })
                      }}
                      rows={3}
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        fontSize: 11,
                        color: '#ccc',
                        background: '#141210',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        padding: 8,
                        marginBottom: 8,
                        fontFamily: 'inherit',
                        resize: 'vertical' as const,
                      }}
                    />
                    <button
                      type="button"
                      disabled={hormoneSaveBusy}
                      onClick={() => {
                        void (async () => {
                          if (!editingHormone) return
                          setHormoneSaveBusy(true)
                          try {
                            const updatedMap = {
                              menstrual: { tip: editingHormone.menstrual.tip, recommend: editingHormone.menstrual.recommend },
                              follicular: { tip: editingHormone.follicular.tip, recommend: editingHormone.follicular.recommend },
                              ovulation: { tip: editingHormone.ovulation.tip, recommend: editingHormone.ovulation.recommend },
                              luteal: { tip: editingHormone.luteal.tip, recommend: editingHormone.luteal.recommend },
                            }
                            const { error } = await supabase
                              .from('products')
                              .update({ hormone_timing: JSON.stringify(updatedMap) })
                              .eq('id', product.id)
                            if (error) throw error
                            setSaveToast('저장했어요')
                            router.refresh()
                          } catch (e) {
                            console.error(e)
                          } finally {
                            setHormoneSaveBusy(false)
                          }
                        })()
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: '#7B5EA7',
                        color: '#fff',
                        padding: 13,
                        borderRadius: 10,
                        fontSize: 13,
                        cursor: hormoneSaveBusy ? 'default' : 'pointer',
                        fontFamily: 'inherit',
                        opacity: hormoneSaveBusy ? 0.75 : 1,
                      }}
                    >
                      {hormoneSaveBusy ? '저장 중...' : '저장'}
                    </button>
                  </div>
                ) : showEditChrome && !editingHormone ? (
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>편집 준비 중…</div>
                ) : curHormone.tip || curHormone.recommend ? (
                  <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.65, marginBottom: 8 }}>
                    {curHormone.tip ? (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ color: '#B09AD0' }}>Tip </span>
                        {curHormone.tip}
                      </div>
                    ) : null}
                    {curHormone.recommend ? (
                      <div>
                        <span style={{ color: GOLD }}>추천 </span>
                        {curHormone.recommend}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                    {showEditChrome ? '어드민에서 hormone_timing(JSON)을 채우면 표시돼요.' : '이 단계에 대한 안내가 아직 없어요.'}
                  </div>
                )}
                <div style={{ fontSize: 10, color: '#666', lineHeight: 1.5, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  마법 캘린더에서 주기를 맞추면 단계별 맞춤 루틴과 연동될 수 있어요. (캘린더 메뉴에서 설정)
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <ProductTagSection
          product={product}
          weather={weather}
          hormonePhase={hormonePhase}
          supabaseClient={supabase}
          isSuperAdmin={isSuperAdmin}
        />
        {maleMeno ? (
          <div style={{ alignSelf: 'flex-start', marginBottom: 6, display: 'inline-block', background: 'rgba(123,94,167,0.2)', border: '1px solid rgba(123,94,167,0.4)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#e8d9ff' }}>
            남성 갱년기 피부에도 효과적이에요
          </div>
        ) : null}
        <div
          data-edit-field="name"
          onClick={isEditMode ? (e) => { e.stopPropagation(); setEditingField({ field: 'name', label: '상품명 수정', currentValue: name }) } : undefined}
          style={{
            position: showEditChrome ? 'relative' : undefined,
            fontSize: 20, lineHeight: 1.4, marginBottom: 5, color: '#e8e4dc',
            outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
            outlineOffset: showEditChrome ? 2 : undefined,
            borderRadius: showEditChrome ? 4 : undefined,
            cursor: isEditMode ? 'pointer' : undefined,
          }}
        >
          {showEditChrome ? (
            <span style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>✏️</span>
          ) : null}
          {name}
        </div>
        <div
          data-edit-field="description"
          onClick={isEditMode ? (e) => { e.stopPropagation(); setEditingField({ field: 'description', label: '상품 설명 수정', currentValue: seoDesc }) } : undefined}
          style={{
            position: showEditChrome ? 'relative' : undefined,
            fontSize: 12, color: '#888', lineHeight: 1.6, marginBottom: 10,
            outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
            outlineOffset: showEditChrome ? 2 : undefined,
            borderRadius: showEditChrome ? 4 : undefined,
            cursor: isEditMode ? 'pointer' : undefined,
          }}
        >
          {showEditChrome ? (
            <span style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>✏️</span>
          ) : null}
          {seoDesc}
        </div>
        {product.is_timesale && saleTimeLeft > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(192,64,48,0.08)', border: '1px solid rgba(192,64,48,0.25)', borderRadius: 20, marginBottom: 8, width: 'fit-content' }}>
            <span style={{ fontSize: 11, color: 'rgba(220,100,80,0.9)' }}>⚡ 타임세일</span>
            <span style={{ fontSize: 12, color: '#E07060', fontFamily: 'monospace' }}>{saleHMS}</span>
            <span style={{ fontSize: 10, color: 'rgba(220,100,80,0.6)' }}>후 종료</span>
          </div>
        )}
        {product.is_groupbuy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.25)', borderRadius: 20, marginBottom: 8, width: 'fit-content' }}>
            <span style={{ fontSize: 11, color: '#C4A0F0' }}>👥 {product.groupbuy_count || 0}명 공동구매 중</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {discount > 0 ? (
            <div style={{ background: '#c02030', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 999 }}>-{discount}%</div>
          ) : null}
          <div style={{ fontSize: 28, color: GOLD, fontWeight: product.is_groupbuy ? 900 : 700 }}>
            {hasValidPrice ? `${price.toLocaleString()}원` : '가격문의'}
          </div>
          {discount > 0 && product.retail_price > price ? (
            <div style={{ fontSize: 14, color: '#555', textDecoration: 'line-through' }}>{Number(product.retail_price).toLocaleString()}원</div>
          ) : null}
        </div>
        {(String(product.unit_type || '').trim() &&
          Number.isFinite(Number(product.unit_price)) &&
          Number(product.unit_price) > 0) ||
        showEditChrome ? (
          <div
            onClick={
              isEditMode
                ? e => {
                    e.stopPropagation()
                    setEditingField({
                      field: 'unit_price_pair',
                      label: '단위타입 · 단위가격',
                      currentValue: String(product.unit_type ?? '').trim(),
                      currentValue2: String(product.unit_price ?? ''),
                    })
                  }
                : undefined
            }
            style={{
              position: showEditChrome ? 'relative' : undefined,
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 10,
              outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
              outlineOffset: showEditChrome ? 2 : undefined,
              borderRadius: showEditChrome ? 4 : undefined,
              cursor: isEditMode ? 'pointer' : undefined,
            }}
          >
            {showEditChrome ? (
              <span style={{ position: 'absolute', top: 0, right: 0, zIndex: 2, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>✏️</span>
            ) : null}
            {String(product.unit_type || '').trim() &&
            Number.isFinite(Number(product.unit_price)) &&
            Number(product.unit_price) > 0 ? (
              <>
                {String(product.unit_type).trim()} {Number(product.unit_price).toLocaleString()}원
              </>
            ) : (
              <span style={{ color: '#666' }}>단위가격 (편집)</span>
            )}
          </div>
        ) : null}
        {(product.category_id || showEditChrome) && (
          <div
            onClick={
              isEditMode
                ? e => {
                    e.stopPropagation()
                    setEditingField({
                      field: 'category_id',
                      label: '카테고리 (UUID)',
                      currentValue: String(product.category_id ?? ''),
                    })
                  }
                : undefined
            }
            style={{
              position: showEditChrome ? 'relative' : undefined,
              fontSize: 10,
              color: 'rgba(255,255,255,0.38)',
              marginBottom: 8,
              outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
              outlineOffset: showEditChrome ? 2 : undefined,
              cursor: isEditMode ? 'pointer' : undefined,
            }}
          >
            {showEditChrome ? (
              <span style={{ position: 'absolute', top: -2, right: 0, zIndex: 2, fontSize: 9, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '1px 4px', lineHeight: 1 }}>✏️</span>
            ) : null}
            카테고리 ID: {product.category_id || '—'}
          </div>
        )}
        {(tagLine || showEditChrome) && (
          <div
            onClick={
              isEditMode
                ? e => {
                    e.stopPropagation()
                    setEditingField({
                      field: 'tag',
                      label: '태그 · 키워드',
                      currentValue: tagLine,
                    })
                  }
                : undefined
            }
            style={{
              position: showEditChrome ? 'relative' : undefined,
              fontSize: 10,
              color: 'rgba(201,169,110,0.55)',
              marginBottom: 10,
              lineHeight: 1.5,
              outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
              outlineOffset: showEditChrome ? 2 : undefined,
              cursor: isEditMode ? 'pointer' : undefined,
            }}
          >
            {showEditChrome ? (
              <span style={{ position: 'absolute', top: -2, right: 0, zIndex: 2, fontSize: 9, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '1px 4px', lineHeight: 1 }}>✏️</span>
            ) : null}
            {tagLine || '태그 (편집)'}
          </div>
        )}
        {hasValidPrice ? (
          <div style={{ fontSize: 11, color: GOLD, marginBottom: 10 }}>이 상품 구매시 {expectedPurchasePts.toLocaleString()}T 적립</div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 10, fontSize: 11 }}>
          <span style={{ color: '#888' }}>
            <span style={{ color: GOLD }}>오늘 오후 4시까지 주문 시 당일 발송</span>
            {' · '}
            5만원 이상 무료배송
          </span>
          {product.sales_count != null && Number(product.sales_count) > 0 ? (
            <span style={{ color: '#888' }}>
              <span style={{ color: GOLD }}>{Number(product.sales_count).toLocaleString()}</span>명이 구매했어요
            </span>
          ) : null}
        </div>

        {/* 스토리 피드 탭 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          {(
            [
              { k: 'all' as const, lab: '전체' },
              { k: 'review' as const, lab: '리뷰' },
              { k: 'expert' as const, lab: '전문가' },
              { k: 'ambassador' as const, lab: '앰배서더' },
            ] as const
          ).map(({ k, lab }) => (
            <button
              key={k}
              type="button"
              onClick={() => setStoryTab(k)}
              style={{
                padding: '5px 11px',
                borderRadius: 20,
                border: storyTab === k ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)',
                background: storyTab === k ? 'rgba(201,169,110,0.12)' : 'rgba(0,0,0,0.2)',
                color: storyTab === k ? GOLD : '#888',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {lab}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowWriteSheet(true)}
            style={{
              marginLeft: 'auto',
              padding: '5px 12px',
              borderRadius: 20,
              border: `1px solid rgba(123,94,167,0.4)`,
              background: 'rgba(123,94,167,0.12)',
              color: '#d4c4f0',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            스토리 작성
          </button>
        </div>

        {/* 리뷰 요약 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ color: GOLD, fontSize: 17, letterSpacing: 2 }}>★★★★★</span>
          <span style={{ fontSize: 20, color: GOLD }}>{rating}</span>
          <span style={{ fontSize: 12, color: '#666' }}>리뷰 {reviewCount}개</span>
          <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto', cursor: 'pointer' }}>전체보기 ›</span>
        </div>

        {/* 리뷰 통계 */}
        {!reviewsLoading && reviews.length >= 1 ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>리뷰 통계</div>
            <div style={{ fontSize: 12, color: '#e8e4dc', marginBottom: 10 }}>
              평균 별점 <span style={{ color: GOLD }}>{reviewListAvg.toFixed(1)}</span>
            </div>

            {/* 효과 태그 통계 */}
            {top4Effects.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>실제 효과</div>
                {top4Effects.map(([label, cnt]) => {
                  const pct = Math.round((cnt / reviews.length) * 100)
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#e8e4dc', width: 70, flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: GOLD, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, color: GOLD, width: 32, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            ) : top3Concerns.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>도움 태그 Top3</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {top3Concerns.map(([label, cnt]) => (
                    <span key={label} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'rgba(123,94,167,0.15)', border: '1px solid rgba(123,94,167,0.3)', color: '#B09AD0' }}>
                      {label} {cnt}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 피부타입별 통계 */}
            {Object.keys(skinTypeStats).length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>피부타입별 반응</div>
                {Object.entries(skinTypeStats).map(([st, { count, sum }]) => {
                  const avg = (sum / count).toFixed(1)
                  const isMyType = myProfileSkinType === st
                  return (
                    <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: isMyType ? '4px 8px' : '0', borderRadius: isMyType ? 8 : 0, background: isMyType ? 'rgba(201,169,110,0.08)' : 'transparent', border: isMyType ? `1px solid rgba(201,169,110,0.25)` : 'none' }}>
                      <span style={{ fontSize: 11, color: isMyType ? GOLD : '#aaa', width: 55, flexShrink: 0 }}>
                        {st}{isMyType ? ' 👈' : ''}
                      </span>
                      <span style={{ fontSize: 11, color: GOLD }}>★{avg}</span>
                      <span style={{ fontSize: 10, color: '#666' }}>{count}명</span>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* 사용기간 */}
            {longTermPct > 0 ? (
              <div style={{ fontSize: 11, color: '#aaa' }}>
                1달 이상 사용자 <span style={{ color: GOLD }}>{longTermPct}%</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 리뷰 목록 - 가로 롤링 */}
        <div ref={reviewSectionRef}>
          {reviewsLoading ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>로딩중...</div>
          ) : storyFiltered.length === 0 ? (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              {reviews.length === 0 ? '아직 리뷰가 없어요' : '이 탭에 해당하는 스토리가 없어요'}
            </div>
          ) : (
            <div ref={reviewScrollRef} style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, WebkitOverflowScrolling: 'touch' as any, scrollSnapType: 'x mandatory' }}>
              {storyFiltered.map((rv, i) => (
                <div key={rv.id || i} style={{ flexShrink: 0, width: 260, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, scrollSnapAlign: 'start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ color: GOLD, fontSize: 13 }}>{'★'.repeat(Math.max(0, Number(rv.rating || 0)))}</span>
                    {rv.skin_type ? <span style={{ fontSize: 10, color: '#888', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 10 }}>{rv.skin_type}</span> : null}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                    {rv.content || ''}
                  </div>
                  {Array.isArray(rv.effect_tags) && rv.effect_tags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {rv.effect_tags.slice(0, 3).map((et: string) => (
                        <span key={et} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(201,169,110,0.1)', border: '1px solid rgba(201,169,110,0.25)', color: GOLD }}>{et}</span>
                      ))}
                    </div>
                  ) : Array.isArray(rv.helpful_concerns) && rv.helpful_concerns.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                      {rv.helpful_concerns.slice(0, 3).map((c: string) => (
                        <span key={c} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(123,94,167,0.15)', border: '1px solid rgba(123,94,167,0.3)', color: '#B09AD0' }}>✓ {c}</span>
                      ))}
                    </div>
                  ) : null}
                  {Array.isArray(rv.images) && rv.images[0] ? (
                    <img src={rv.images[0]} alt="" loading="lazy" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />
                  ) : null}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {rv.created_at ? String(rv.created_at).slice(0, 10) : ''}
                    {rv.usage_period ? ` · ${rv.usage_period} 사용` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 브랜드 카드 */}
        <div style={{ background: '#171310', border: '1px solid #252018', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          {(product as any)?.brands?.logo_url ? (
            <img src={(product as any).brands.logo_url} alt={brand}
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${GOLD}`, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#2a2010,#3a3020)', border: `1px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: GOLD, textAlign: 'center', lineHeight: 1.3, flexShrink: 0 }}>
              {brand.substring(0,4)}<br />{brand.substring(4)}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>{brand} 공식 브랜드 상세</div>
            {(() => {
              const originVal = (product as any)?.brands?.origin_country || (product as any)?.brands?.origin
              if (!originVal) return null
              const flagMap: Record<string,string> = { '한국':'🇰🇷','프랑스':'🇫🇷','스페인':'🇪🇸','독일':'🇩🇪','이탈리아':'🇮🇹','일본':'🇯🇵','미국':'🇺🇸' }
              const flag = flagMap[originVal] || '🌍'
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <span style={{ fontSize: 14 }}>{flag}</span>
                  <span style={{ fontSize: 11, color: '#888' }}>원산지 · {originVal}</span>
                </div>
              )
            })()}
          </div>
          <span style={{ fontSize: 10, color: '#6fcf97', background: '#1a3020', border: '1px solid #2a4530', padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>✓ 공식</span>
        </div>

        {/* 브랜드 상세이미지 (Toast UI 에디터 작성 내용) */}
        {detailHtml || showEditChrome || Array.isArray((product as any).detail_imgs) && (product as any).detail_imgs.length > 0 ? (
          <div
            data-edit-field="detail_content"
            onClick={isEditMode ? (e) => { e.stopPropagation(); setEditingField({ field: 'detail_content', label: '상세 본문 수정', currentValue: detailHtml }) } : undefined}
            style={{
              position: showEditChrome ? 'relative' : undefined,
              padding: showEditChrome ? '2px' : undefined,
              marginBottom: 12,
              outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
              outlineOffset: showEditChrome ? 2 : undefined,
              borderRadius: showEditChrome ? 4 : undefined,
              cursor: isEditMode ? 'pointer' : undefined,
            }}
          >
            {showEditChrome ? (
              <span style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>✏️</span>
            ) : null}
            {detailHtml ? (
              <div className="toastui-editor-contents" dangerouslySetInnerHTML={{ __html: detailHtml }}
                style={{ padding: '16px 0', color: '#ffffff', marginBottom: 0 }} />
            ) : (
              <div style={{ padding: '8px 0' }}>
                {Array.isArray((product as any).detail_imgs) && (product as any).detail_imgs.length > 0
                  ? (product as any).detail_imgs.map((url: string, i: number) => (
                      <img key={i} src={url} alt="" loading="lazy" style={{ width: '100%', display: 'block', marginBottom: 4 }} />
                    ))
                  : <div style={{ padding: '16px 0', color: '#666', fontSize: 12 }}>상세 이미지가 없어요</div>
                }
              </div>
            )}
          </div>
        ) : null}

        {/* KEY INGREDIENTS */}
        {keyIngredientsText || showEditChrome ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 12 }}>KEY INGREDIENTS</div>
            <div
              data-edit-field="key_ingredients"
              onClick={isEditMode ? (e) => { e.stopPropagation(); setEditingField({ field: 'key_ingredients', label: '주요 성분 수정', currentValue: String(product.key_ingredients ?? '') }) } : undefined}
              style={{
                position: showEditChrome ? 'relative' : undefined,
                fontSize: 13, lineHeight: 1.75, color: '#bbb', whiteSpace: 'pre-wrap', background: '#1a1610', border: '1px solid #252018', borderRadius: 12, padding: '14px 12px',
                outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
                outlineOffset: showEditChrome ? 2 : undefined,
                cursor: isEditMode ? 'pointer' : undefined,
              }}
            >
              {showEditChrome ? (
                <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>✏️</span>
              ) : null}
              {showEditChrome ? (
                keyIngredientsText || '주요 성분이 비어 있어요'
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {ingOpen ? ingredientLinesAll.join('\n') : ingredientPreviewLines.join('\n')}
                  </div>
                  {ingredientExtraCount > 0 && !ingOpen ? (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setIngOpen(true) }}
                      style={{ marginTop: 8, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: GOLD, fontFamily: 'inherit' }}
                    >
                      전체보기 +{ingredientExtraCount}
                    </button>
                  ) : null}
                  {ingOpen && ingredientLinesAll.length > 3 ? (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setIngOpen(false) }}
                      style={{ marginTop: 8, padding: 0, border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: GOLD, fontFamily: 'inherit' }}
                    >
                      접기
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* CLINICAL RESULT */}
        {clinicalResultText || showEditChrome ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 12 }}>CLINICAL RESULT</div>
            <div
              data-edit-field="clinical_result"
              onClick={isEditMode ? (e) => { e.stopPropagation(); setEditingField({ field: 'clinical_result', label: '임상 결과 수정', currentValue: String(product.clinical_result ?? '') }) } : undefined}
              style={{
                position: showEditChrome ? 'relative' : undefined,
                fontSize: 13, lineHeight: 1.75, color: '#bbb', whiteSpace: 'pre-wrap', background: '#1a1610', border: '1px solid #252018', borderRadius: 12, padding: '14px 12px',
                outline: showEditChrome ? '2px dashed #7B5EA7' : undefined,
                outlineOffset: showEditChrome ? 2 : undefined,
                cursor: isEditMode ? 'pointer' : undefined,
              }}
            >
              {showEditChrome ? (
                <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, fontSize: 10, background: '#7B5EA7', color: '#fff', borderRadius: 4, padding: '2px 5px', lineHeight: 1 }}>✏️</span>
              ) : null}
              {showEditChrome ? (
                clinicalResultText || '임상 결과가 비어 있어요'
              ) : (
                clinicalResultText.split('\n').map((rawLine, i) => {
                  const line = rawLine.trim()
                  if (!line) return null
                  const m = line.match(/^(.+)\s+(\d+(?:\.\d+)?)%\s*$/)
                  if (m) {
                    const pct = Math.min(100, Math.max(0, Number(m[2])))
                    return (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: '#bbb', marginBottom: 6 }}>{m[1].trim()}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: GOLD, width: 36, flexShrink: 0 }}>{pct}%</span>
                          <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: 3, background: 'linear-gradient(90deg, #C9A96E, #A07840)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <div key={i} style={{ fontSize: 13, lineHeight: 1.75, color: '#bbb', marginBottom: 6 }}>{line}</div>
                  )
                })
              )}
            </div>
          </div>
        ) : null}

        {/* CERTIFICATIONS */}
        {certificationLines.length > 0 ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 12 }}>CERTIFICATIONS</div>
            {certificationLines.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#141210', border: '1px solid #201c16', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 19 }}>{['🏆','✅','🌿','🏅','📋'][i % 5]}</div>
                <div style={{ fontSize: 12 }}>{c}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* PERFECT TOGETHER */}
        {perfectTogetherRows.length > 0 || showEditChrome ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 12 }}>PERFECT TOGETHER</div>
            {perfectTogetherRows.length > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
                  {perfectTogetherRows.map((t, i) => (
                    <div key={t.id || i} style={{ flexShrink: 0, width: 110, background: '#141210', border: '1px solid #201c16', borderRadius: 12, padding: 9, textAlign: 'center', position: 'relative' }}>
                      {showEditChrome ? (
                        <button
                          type="button"
                          aria-label="연결 해제"
                          onClick={(e) => {
                            e.stopPropagation()
                            void (async () => {
                              const raw = product.perfect_together
                              const ids = Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : []
                              const next = ids.filter((id) => id !== t.id)
                              const { error } = await supabase.from('products').update({ perfect_together: next }).eq('id', product.id)
                              if (error) return
                              setPerfectTogetherRows((prev) => prev.filter((r) => r.id !== t.id))
                              setSaveToast('저장했어요')
                              router.refresh()
                            })()
                          }}
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            border: '1px solid rgba(255,255,255,0.25)',
                            background: 'rgba(0,0,0,0.55)',
                            color: '#fff',
                            fontSize: 12,
                            cursor: 'pointer',
                            lineHeight: 1,
                            padding: 0,
                            zIndex: 2,
                            fontFamily: 'inherit',
                          }}
                        >
                          ×
                        </button>
                      ) : null}
                      <div style={{ fontSize: 8, background: '#2a1f0e', color: GOLD, padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 6 }}>STEP {i + 1}</div>
                      <div style={{ marginBottom: 5, width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {t.storage_thumb_url || t.thumb_img ? (
                          <img src={t.storage_thumb_url || t.thumb_img || ''} alt={t.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : <div style={{ fontSize: 28 }}>📦</div>}
                      </div>
                      <div style={{ fontSize: 8, color: '#666' }}>{t.brands?.name || ''}</div>
                      <div style={{ fontSize: 10, lineHeight: 1.3 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: GOLD, marginTop: 3 }}>{Number(t.retail_price || 0).toLocaleString()}원</div>
                      <div style={{ fontSize: 10, color: '#888', background: '#1e1a14', borderRadius: 5, padding: 4, marginTop: 5, cursor: 'pointer' }} onClick={() => router.push(`/products/${t.id}`)}>+ 담기</div>
                    </div>
                  ))}
                </div>
                {showEditChrome ? (
                  <div style={{ marginTop: 12 }}>
                    {perfectTogetherAddSearch}
                  </div>
                ) : null}
              </>
            ) : showEditChrome ? (
              <div
                style={{
                  fontSize: 12,
                  color: '#666',
                  background: '#1a1610',
                  border: '1px solid #252018',
                  borderRadius: 12,
                  padding: '14px 12px',
                  outline: '2px dashed #7B5EA7',
                  outlineOffset: 2,
                }}
              >
                <div style={{ marginBottom: 10 }}>함께 쓰기 연결 제품이 없어요</div>
                {perfectTogetherAddSearch}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 같은 피부타입 추천 */}
        {sameSkinTypeRows.length > 0 ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 12 }}>같은 피부타입이 선택한 제품</div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' as any }}>
              {sameSkinTypeRows.map((t, i) => (
                <div key={t.id || i} onClick={() => router.push(`/products/${t.id}`)}
                  style={{ flexShrink: 0, width: 120, background: '#141210', border: '1px solid #201c16', borderRadius: 12, padding: 9, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ marginBottom: 5, width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {t.storage_thumb_url || t.thumb_img ? (
                      <img src={t.storage_thumb_url || t.thumb_img || ''} alt={t.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <div style={{ fontSize: 28 }}>📦</div>}
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.3, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: GOLD }}>{Number(t.retail_price || 0).toLocaleString()}원</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* 수량 */}
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0b09', borderTop: '1px solid #1a1610' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e1a14', border: '1px solid #2a2520', color: '#fff', fontSize: 20, textAlign: 'center', lineHeight: '30px', cursor: 'pointer', userSelect: 'none' }}>−</div>
          <div style={{ fontSize: 20 }}>{qty}</div>
          <div onClick={() => setQty(q => q + 1)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e1a14', border: '1px solid #2a2520', color: '#fff', fontSize: 20, textAlign: 'center', lineHeight: '30px', cursor: 'pointer', userSelect: 'none' }}>+</div>
        </div>
        <div style={{ fontSize: 22, color: GOLD }}>{total}</div>
      </div>

      {/* 3버튼 */}
      <div style={{ position: 'fixed', bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0, zIndex: 100, background: '#0D0B09', padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            addToCart({
              product_id: product.id,
              name: product.name,
              price: product.retail_price ?? product.price ?? 0,
              thumb_img: product.thumb_img ?? '',
              quantity: qty,
            })
            setCartToast('🛍️ 장바구니에 담겼어요!')
          }}
          style={{ flex: 1, background: '#1e1a14', border: 'none', color: '#aaa', fontSize: 13, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🛍️ 담기
        </button>
        <button
          type="button"
          onClick={() => setGiftSheetOpen(true)}
          style={{ flex: 1, background: '#241e0e', border: 'none', color: GOLD, fontSize: 13, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          🎁 {maleMeno ? '여성 선물하기' : '선물하기'}
        </button>
        <button onClick={() => void handleBuy()} style={{ flex: 2, background: `linear-gradient(135deg,${GOLD},#a07840)`, border: 'none', color: '#000', fontSize: 16, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>지금 구매</button>
      </div>

      {giftSheetOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setGiftSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 430,
              background: '#1a1a1a',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '22px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
              borderTop: `1px solid ${GOLD}44`,
              maxHeight: '70vh',
              overflowY: 'auto',
              zIndex: 201,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, color: '#fff' }}>오랜일촌 선택</div>
              <button
                type="button"
                onClick={() => setGiftSheetOpen(false)}
                style={{ fontSize: 20, color: '#666', cursor: 'pointer', background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            {giftFriendsLoading ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '16px 0' }}>불러오는 중...</div>
            ) : giftFriends.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '16px 0' }}>오랜일촌이 없어요</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {giftFriends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setGiftSheetOpen(false)
                      router.push(`/gift?product_id=${encodeURIComponent(product.id)}&qty=${qty}&gift_to=${encodeURIComponent(f.id)}`)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#e8e4dc',
                      fontSize: 14,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {f.nickname}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setGiftSheetOpen(false)}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid ${GOLD}`,
                background: 'transparent',
                color: GOLD,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {showWriteSheet && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowWriteSheet(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 430,
              background: '#1a1610',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '22px 18px calc(28px + env(safe-area-inset-bottom, 0px))',
              borderTop: `1px solid ${GOLD}44`,
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, color: '#e8e4dc' }}>스토리 작성</div>
              <button
                type="button"
                onClick={() => setShowWriteSheet(false)}
                style={{ fontSize: 20, color: '#666', cursor: 'pointer', background: 'none', border: 'none', padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>
              제품 태그{' '}
              <span style={{ color: GOLD }}>#{String(name).slice(0, 24)}</span>
              {tagLine ? <span style={{ color: '#666' }}> · {tagLine.slice(0, 40)}{tagLine.length > 40 ? '…' : ''}</span> : null}
            </div>
            <textarea
              value={writeContent}
              onChange={(e) => setWriteContent(e.target.value)}
              placeholder="제품 사용 후기를 남겨주세요"
              style={{
                width: '100%',
                minHeight: 100,
                boxSizing: 'border-box',
                background: '#0d0b09',
                border: '1px solid #2a2520',
                borderRadius: 10,
                padding: 10,
                color: '#e8e4dc',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical' as const,
                marginBottom: 12,
              }}
            />
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>피부타입 (선택 시 +50T)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(['건성', '지성', '복합성', '민감성'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setWriteSkinType((prev) => (prev === s ? null : s))}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: writeSkinType === s ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.12)',
                    background: writeSkinType === s ? 'rgba(201,169,110,0.12)' : 'rgba(0,0,0,0.25)',
                    color: writeSkinType === s ? GOLD : '#aaa',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>효과 태그 (각 +30T)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(['촉촉해요', '자극없어요', '흡수빨라요', '진정돼요'] as const).map((s) => {
                const on = writeEffectTags.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setWriteEffectTags((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
                    }
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      border: on ? '1px solid rgba(123,94,167,0.5)' : '1px solid rgba(255,255,255,0.12)',
                      background: on ? 'rgba(123,94,167,0.15)' : 'rgba(0,0,0,0.25)',
                      color: on ? '#d4c4f0' : '#aaa',
                      fontSize: 11,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#B09AD0',
                background: 'rgba(123,94,167,0.08)',
                border: '1px solid rgba(123,94,167,0.25)',
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 14,
                lineHeight: 1.55,
              }}
            >
              토스트 적립 안내:{' '}
              {hasAllReviewToastNums ? (
                <>
                  기본 등록 <span style={{ color: GOLD }}>{Number(rt)}T</span>
                  {' · '}
                  포토 +<span style={{ color: GOLD }}>{Number(rp)}T</span>
                  {' · '}
                  영상 +<span style={{ color: GOLD }}>{Number(rv)}T</span>
                </>
              ) : (
                <>
                  기본 등록 <span style={{ color: GOLD }}>{product.review_points_text ?? 200}T</span>
                </>
              )}
              {writeSkinType ? <span> + 피부타입 <span style={{ color: GOLD }}>+50T</span></span> : null}
              {writeEffectTags.length > 0 ? (
                <span>
                  {' '}
                  + 효과태그 <span style={{ color: GOLD }}>+{30 * writeEffectTags.length}T</span>
                </span>
              ) : null}
              <span style={{ color: '#666' }}> (실제 지급은 정책·DB 트리거 기준)</span>
            </div>
            <button
              type="button"
              disabled={writeSubmitting || !writeContent.trim()}
              onClick={() => {
                void (async () => {
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session?.user?.id) {
                    alert('로그인 후 작성할 수 있어요')
                    return
                  }
                  if (!userPurchasedProduct) {
                    alert('구매한 제품만 스토리를 작성할 수 있어요')
                    return
                  }
                  if (myReviewDoc) {
                    alert('이미 작성한 리뷰가 있어요')
                    return
                  }
                  setWriteSubmitting(true)
                  const { data: urow, error: uerr } = await supabase.from('users').select('id').eq('auth_id', session.user.id).maybeSingle()
                  if (uerr || !urow?.id) {
                    setWriteSubmitting(false)
                    alert('회원 정보를 찾을 수 없어요')
                    return
                  }
                  const { error } = await supabase.from('reviews').insert({
                    author_id: urow.id,
                    review_type: 'product',
                    target_id: product.id,
                    rating: 5,
                    content: writeContent.trim(),
                    skin_type: writeSkinType,
                    effect_tags: writeEffectTags.length ? writeEffectTags : null,
                    status: '게시',
                  })
                  setWriteSubmitting(false)
                  if (error) {
                    alert('등록 실패: ' + error.message)
                    return
                  }
                  {
                    const reviewToastAmt = Math.max(0, Math.floor(Number(product.review_points_text ?? 200)))
                    const { error: ttErr } = await supabase.from('toast_transactions').insert({
                      user_id: urow.id,
                      amount: reviewToastAmt,
                      transaction_type: 'review',
                      source_type: 'review_bonus',
                    } as any)
                    if (ttErr) console.warn('[toast_transactions review]', ttErr)
                  }
                  setShowWriteSheet(false)
                  setWriteContent('')
                  setWriteSkinType(null)
                  setWriteEffectTags([])
                  await fetchReviews()
                  const { data: myReviewRow } = await supabase
                    .from('reviews')
                    .select('id, content, rating, helpful_concerns, is_edited, created_at')
                    .eq('author_id', urow.id)
                    .eq('target_id', product.id)
                    .maybeSingle()
                  setMyReviewDoc(myReviewRow || null)
                  alert('스토리가 등록됐어요!')
                })()
              }}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 12,
                border: 'none',
                background: `linear-gradient(135deg,${GOLD},#a07840)`,
                color: '#000',
                fontSize: 15,
                fontWeight: 700,
                cursor: writeSubmitting || !writeContent.trim() ? 'default' : 'pointer',
                fontFamily: 'inherit',
                opacity: writeSubmitting || !writeContent.trim() ? 0.5 : 1,
              }}
            >
              {writeSubmitting ? '등록 중…' : '등록하기'}
            </button>
          </div>
        </div>
      )}

      {loginSheetOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { try { localStorage.removeItem('pending_payment'); localStorage.removeItem('pending_payment_ctx') } catch {} setLoginSheetOpen(false) }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: '#1a1a1a', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: '22px 20px 28px', borderTop: `1px solid ${GOLD}44`, zIndex: 201 }}>
            <div style={{ fontSize: 15, color: '#fff', marginBottom: 8, textAlign: 'center' }}>결제를 위해 로그인이 필요해요</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 18, textAlign: 'center' }}>로그인 후 이 페이지에서 결제를 이어갈게요</div>
            <button type="button"
              onClick={() => void supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined } })}
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: 'none', background: '#FEE500', color: '#191600', fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
              카카오로 로그인
            </button>
            <button type="button"
              onClick={() => { try { localStorage.removeItem('pending_payment'); localStorage.removeItem('pending_payment_ctx') } catch {} setLoginSheetOpen(false) }}
              style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `1px solid ${GOLD}`, background: 'transparent', color: GOLD, fontSize: 13, cursor: 'pointer' }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {editingField !== null ? (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 430, margin: '0 auto', background: '#1a1610', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, zIndex: 101, maxHeight: '90vh', overflowY: 'auto' }}>
            {editError ? (
              <div style={{ color: '#e05050', fontSize: 12, marginBottom: 10 }}>{editError}</div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, color: '#e8e4dc' }}>{editingField.label}</div>
              <button type="button" onClick={() => setEditingField(null)} style={{ fontSize: 20, color: '#666', cursor: 'pointer', background: 'none', border: 'none', padding: 0, lineHeight: 1 }}>✕</button>
            </div>
            {editingField.field === 'name' || editingField.field === 'description' || editingField.field === 'key_ingredients' || editingField.field === 'clinical_result' ? (
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 100,
                  background: '#0d0b09',
                  color: '#e8e4dc',
                  border: '1px solid #2a2520',
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical' as const,
                  boxSizing: 'border-box',
                }}
              />
            ) : null}
            {editingField.field === 'key_ingredients' && (
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <label
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      fontSize: 11,
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.45)',
                      border: '0.5px solid rgba(255,255,255,0.15)',
                      fontFamily: 'inherit',
                    }}
                  >
                    전성분 사진 업로드
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = ev => {
                          const img = new Image()
                          img.onload = () => {
                            const canvas =
                              document.createElement('canvas')
                            const MAX = 1200
                            let w = img.width
                            let h = img.height
                            if (w > MAX || h > MAX) {
                              if (w > h) {
                                h = Math.round(h * MAX / w)
                                w = MAX
                              } else {
                                w = Math.round(w * MAX / h)
                                h = MAX
                              }
                            }
                            canvas.width = w
                            canvas.height = h
                            const ctx = canvas.getContext('2d')
                            ctx?.drawImage(img, 0, 0, w, h)
                            setKIngredientImg(
                              canvas.toDataURL('image/jpeg', 0.8)
                            )
                          }
                          img.src = ev.target?.result as string
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                  </label>
                  {kIngredientImg && (
                    <span
                      style={{
                        fontSize: 11,
                        color: '#5adb8a',
                      }}
                    >
                      사진 업로드됨 ✓
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={kAiAnalyzing}
                  onClick={() => void analyzeKeyIngredients()}
                  style={{
                    width: '100%',
                    padding: '9px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: kAiAnalyzing ? 'not-allowed' : 'pointer',
                    border: '1px solid rgba(123,94,167,0.4)',
                    fontFamily: 'inherit',
                    background: kAiAnalyzing ? 'rgba(123,94,167,0.2)' : '#3a2060',
                    color: kAiAnalyzing ? 'rgba(255,255,255,0.3)' : '#c4a8ff',
                  }}
                >
                  {kAiAnalyzing ? 'AI 분석 중...' : '✦ AI 전성분 분석 · 태그 자동 적용'}
                </button>
              </div>
            )}
            {editingField.field === 'detail_content' ? (
              <div style={{ width: '100%', minWidth: 0, overflowX: 'hidden' }}>
                <Editor
                  key={`detail-edit-${product.id}-${editingField.currentValue.length}`}
                  ref={detailEditorRef}
                  initialValue={editingField.currentValue}
                  initialEditType="wysiwyg"
                  hideModeSwitch
                  height="300px"
                  theme="dark"
                  language="ko-KR"
                />
              </div>
            ) : null}
            {editingField.field === 'storage_thumb_url' ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  {thumbPreviewUrl ? (
                    <img src={thumbPreviewUrl} alt="" loading="lazy" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: 36, lineHeight: 1 }}>🧴</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={thumbFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setSelectedFile(file)
                  }}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => thumbFileInputRef.current?.click()}
                    style={{
                      fontSize: 13,
                      color: '#e8e4dc',
                      background: '#2a2520',
                      border: '1px solid #3a3020',
                      borderRadius: 10,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    📁 사진 선택하기
                  </button>
                </div>
                {selectedFile ? (
                  <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>
                    선택됨: {selectedFile.name}
                  </div>
                ) : null}
              </div>
            ) : null}
            {editingField.field === 'unit_price_pair' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>단위 타입</div>
                  <input
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    placeholder="예: ml당"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: 10,
                      background: '#0d0b09',
                      color: '#e8e4dc',
                      border: '1px solid #2a2520',
                      borderRadius: 10,
                      fontSize: 13,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>단위 가격</div>
                  <input
                    type="number"
                    value={editDraft2}
                    onChange={e => setEditDraft2(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: 10,
                      background: '#0d0b09',
                      color: '#e8e4dc',
                      border: '1px solid #2a2520',
                      borderRadius: 10,
                      fontSize: 13,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            ) : null}
            {editingField.field === 'category_id' ? (
              <input
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                placeholder="카테고리 UUID"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 10,
                  background: '#0d0b09',
                  color: '#e8e4dc',
                  border: '1px solid #2a2520',
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
            ) : null}
            {editingField.field === 'tag' ? (
              <textarea
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                rows={3}
                placeholder="쉼표로 구분하거나 한 줄로 입력"
                style={{
                  width: '100%',
                  minHeight: 80,
                  background: '#0d0b09',
                  color: '#e8e4dc',
                  border: '1px solid #2a2520',
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical' as const,
                  boxSizing: 'border-box',
                }}
              />
            ) : null}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                style={{
                  flex: 1,
                  border: '1px solid #444',
                  background: 'transparent',
                  color: '#aaa',
                  padding: 13,
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  void (async () => {
                    if (!editingField) return
                    setIsSaving(true)
                    setEditError(null)
                    try {
                      let value = ''
                      if (editingField.field === 'storage_thumb_url') {
                        const file = selectedFile
                        if (!file) {
                          setEditError('파일을 선택해주세요')
                          setIsSaving(false)
                          return
                        }
                        const safeExt = String(file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg'
                        const path = `thumb/${product.id}_${Date.now()}.${safeExt}`
                        const { error: upErr } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                        if (upErr) {
                          setEditError(upErr.message || '업로드 실패')
                          setIsSaving(false)
                          return
                        }
                        const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
                        value = pub.publicUrl
                      } else if (editingField.field === 'detail_content') {
                        const inst = detailEditorRef.current?.getInstance?.()
                        value = inst?.getHTML?.() || ''
                      } else {
                        value = editDraft
                      }
                      let saveError: { message?: string } | null = null
                      if (editingField.field === 'unit_price_pair') {
                        const r = await supabase
                          .from('products')
                          .update({
                            unit_type: editDraft.trim() || null,
                            unit_price: Math.max(0, Number(editDraft2) || 0),
                          })
                          .eq('id', product.id)
                        saveError = r.error
                      } else if (editingField.field === 'category_id') {
                        const r = await supabase
                          .from('products')
                          .update({ category_id: editDraft.trim() || null })
                          .eq('id', product.id)
                        saveError = r.error
                      } else if (editingField.field === 'tag') {
                        const r = await supabase
                          .from('products')
                          .update({ tag: editDraft.trim() || null })
                          .eq('id', product.id)
                        saveError = r.error
                      } else {
                        const r = await supabase.from('products').update({ [editingField.field]: value }).eq('id', product.id)
                        saveError = r.error
                      }
                      if (saveError) {
                        setEditError(saveError.message || '저장 실패')
                        setIsSaving(false)
                        return
                      }
                      setEditingField(null)
                      setIsSaving(false)
                      setSaveToast('저장했어요')
                      router.refresh()
                    } catch (e: any) {
                      setEditError(e?.message || '저장 실패')
                      setIsSaving(false)
                    }
                  })()
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  background: '#7B5EA7',
                  color: '#fff',
                  padding: 13,
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: isSaving ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isSaving ? 0.75 : 1,
                }}
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {saveToast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 200,
            left: 16,
            right: 16,
            maxWidth: 400,
            margin: '0 auto',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(30,26,20,0.96)',
            border: `1px solid ${GOLD}55`,
            color: GOLD,
            fontSize: 13,
            textAlign: 'center',
            zIndex: 95,
            fontFamily: 'inherit',
          }}
        >
          {saveToast}
        </div>
      ) : null}

      {cartToast ? (
        <div
          style={{
            position: 'fixed',
            bottom: 200,
            left: 16,
            right: 16,
            maxWidth: 400,
            margin: '0 auto',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(30,26,20,0.96)',
            border: `1px solid ${GOLD}55`,
            color: GOLD,
            fontSize: 13,
            textAlign: 'center',
            zIndex: 96,
            fontFamily: 'inherit',
          }}
        >
          {cartToast}
        </div>
      ) : null}

      {isSuperAdmin ? (
        <button
          type="button"
          onClick={() => setIsEditMode(v => !v)}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 150,
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#7B5EA7',
            border: 'none',
            color: '#fff',
            fontSize: 20,
            cursor: 'pointer',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            padding: 0,
            lineHeight: 1,
          }}
        >
          {isEditMode ? '✕' : '✏️'}
        </button>
      ) : null}
    </div>
  )
}
