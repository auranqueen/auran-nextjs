'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReviewForm } from '@/components/reviews/ReviewForm'

const GOLD = '#C9A96E'

interface Product {
  id: string
  brands?: { name?: string; logo_url?: string } | null
  thumb_img?: string
  origin: string
  name: string
  description: string
  retail_price: number
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
  thumb_images: string[]
  gallery_imgs?: string[]
  storage_thumb_url: string
  is_timesale?: boolean
  sale_price?: number
  sales_count?: number | null
  skin_types?: string[] | null
  skin_concerns?: string[] | null
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter()
  const supabase = createClient()
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showReviewBanner, setShowReviewBanner] = useState(false)
  const [myReviewDoc, setMyReviewDoc] = useState<{
    id: string
    content?: string | null
    rating?: number | null
    helpful_concerns?: string[] | null
    is_edited: boolean | null
    created_at: string
  } | null>(null)
  const [editReviewDraft, setEditReviewDraft] = useState<{
    id: string
    rating: number
    content: string
    helpful_concerns: string[]
    images: string[]
  } | null>(null)
  const [reviewToastAmount, setReviewToastAmount] = useState(500)
  const [qty, setQty] = useState(1)
  const [activeThumb, setActiveThumb] = useState(0)
  const [loginSheetOpen, setLoginSheetOpen] = useState(false)
  const paymentResumeOnce = useRef(false)
  const reviewSectionRef = useRef<HTMLDivElement | null>(null)
  const [perfectTogetherRows, setPerfectTogetherRows] = useState<
    {
      id: string
      name: string
      retail_price: number
      thumb_img?: string | null
      storage_thumb_url?: string | null
      brands?: { name?: string } | null
    }[]
  >([])
  const [sameSkinTypeRows, setSameSkinTypeRows] = useState<
    {
      id: string
      name: string
      retail_price: number
      thumb_img?: string | null
      storage_thumb_url?: string | null
      brands?: { name?: string } | null
    }[]
  >([])
  const [aiRecommendLine, setAiRecommendLine] = useState<string | null>(null)

  const fetchReviews = async () => {
    setReviewsLoading(true)
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('target_id', product.id)
      .eq('status', '게시')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) console.error('fetchReviews error:', error)
    console.log('reviews data:', data)
    setReviews(data || [])
    setReviewsLoading(false)
  }

  const executeBuy = async () => {
    const res = await fetch(`${window.location.origin}/api/payment/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: product.id, quantity: qty })
    })
    const data = await res.json()
    if (data.payUrl) {
      try {
        localStorage.removeItem('pending_payment')
        localStorage.removeItem('pending_payment_ctx')
      } catch {}
      window.location.href = data.payUrl
    } else {
      alert('결제 요청 실패')
    }
  }

  const handleBuy = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      try {
        localStorage.setItem('pending_payment', 'true')
        localStorage.setItem('pending_payment_ctx', 'pay')
      } catch {}
      setLoginSheetOpen(true)
      return
    }
    await executeBuy()
  }

  useEffect(() => {
    if (paymentResumeOnce.current) return
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return
      let ctx = ''
      try {
        if (localStorage.getItem('pending_payment') !== 'true') return
        ctx = localStorage.getItem('pending_payment_ctx') || ''
        if (ctx.startsWith('checkout:')) return
      } catch {
        return
      }
      paymentResumeOnce.current = true
      try {
        localStorage.removeItem('pending_payment')
        localStorage.removeItem('pending_payment_ctx')
      } catch {}
      await executeBuy()
    }
    void run()
  }, [supabase, product.id, qty])

  console.log('useEffect 실행', product?.id)

  useEffect(() => {
    if (!product?.id) return
    console.log('reviews fetch 실행', product?.id)
    void fetchReviews()
  }, [product?.id])

  useEffect(() => {
    setEditReviewDraft(null)
  }, [product.id])

  useEffect(() => {
    if (!product?.id) return
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setShowReviewForm(false)
        setShowReviewBanner(false)
        setMyReviewDoc(null)
        return
      }
      const { data: orders } = await supabase
        .from('orders')
        .select('items')
        .eq('customer_id', session.user.id)
      let purchased = false
      ;(orders || []).forEach((row: any) => {
        if (purchased) return
        const raw = row?.items
        let parsed: any[] = []
        if (Array.isArray(raw)) parsed = raw
        else if (typeof raw === 'string') {
          try {
            parsed = JSON.parse(raw)
          } catch {}
        }
        if (Array.isArray(parsed) && parsed.some(it => String(it?.product_id || '') === String(product.id))) purchased = true
      })
      const { data: myRow } = await supabase
        .from('reviews')
        .select('id, content, rating, helpful_concerns, is_edited, created_at')
        .eq('author_id', session.user.id)
        .eq('target_id', product.id)
        .maybeSingle()
      setMyReviewDoc(myRow || null)
      if (myRow) {
        setShowReviewForm(false)
        setShowReviewBanner(false)
        return
      }
      const canWrite = !!session && !!purchased && !myRow
      setShowReviewForm(canWrite)
      setShowReviewBanner(canWrite)
      const { data: setting } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('category', 'review')
        .eq('key', 'points_text')
        .single()
      const reviewToastAmount = setting?.value ? Number(setting.value) : 500
      setReviewToastAmount(reviewToastAmount)
    }
    void run()
  }, [product?.id, supabase])

  useEffect(() => {
    const raw = product.perfect_together
    const ids = Array.isArray(raw) ? raw.map(x => String(x)).filter(Boolean) : []
    if (ids.length === 0) {
      setPerfectTogetherRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('products')
        .select('id,name,retail_price,thumb_img,storage_thumb_url,brands(name)')
        .in('id', ids)
      if (cancelled) return
      const rows = (data || []) as {
        id: string
        name: string
        retail_price: number
        thumb_img?: string | null
        storage_thumb_url?: string | null
        brands?: { name?: string } | null
      }[]
      const order = new Map(ids.map((id, i) => [id, i]))
      rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      setPerfectTogetherRows(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [product.id, product.perfect_together, supabase])

  useEffect(() => {
    if (!product?.id) return
    let cancelled = false
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        if (!cancelled) setSameSkinTypeRows([])
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('skin_type')
        .eq('auth_id', session.user.id)
        .maybeSingle()
      const skinType = String((profile as any)?.skin_type || '').trim()
      if (!skinType) {
        if (!cancelled) setSameSkinTypeRows([])
        return
      }
      const { data } = await supabase
        .from('products')
        .select('id,name,retail_price,thumb_img,storage_thumb_url,brands(name)')
        .contains('skin_types', [skinType])
        .neq('id', product.id)
        .eq('status', 'active')
        .limit(4)
      if (cancelled) return
      setSameSkinTypeRows(
        (data || []) as {
          id: string
          name: string
          retail_price: number
          thumb_img?: string | null
          storage_thumb_url?: string | null
          brands?: { name?: string } | null
        }[]
      )
    })()
    return () => {
      cancelled = true
    }
  }, [product.id, supabase])

  useEffect(() => {
    if (!product?.id) return
    let cancelled = false
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) {
        if (!cancelled) setAiRecommendLine(null)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('skin_type')
        .eq('auth_id', uid)
        .maybeSingle()
      if (cancelled) return
      const userSkinType = String((profile as any)?.skin_type || '').trim()
      if (!product.skin_types?.includes(userSkinType)) {
        setAiRecommendLine(null)
        return
      }
      setAiRecommendLine(`✦ 내 피부타입(${userSkinType})에 맞는 제품이에요`)
    })()
    return () => {
      cancelled = true
    }
  }, [product.id, product.skin_types, supabase])

  const brand = product.brands?.name || 'AURAN'
  const origin = product.origin ?? ''
  const name = product.name ?? '제품명'
  const seoDesc = product.description ?? ''
  const priceRaw = product.is_timesale ? (product.sale_price ?? (product as any).price ?? 0) : (product.retail_price ?? (product as any).price ?? 0)
  const price = Number(priceRaw) || 0
  const hasValidPrice = price > 0
  const origPrice = product.original_price ?? 0
  const discount = product.discount_rate ?? 0
  const rating = product.avg_rating ?? 4.9
  const reviewCount = reviews.length > 0 ? reviews.length : (product.review_count ?? 0)
  const repurchaseRate = product.repurchase_rate ?? 0
  const activeUsers = product.active_users ?? 0
  const matchPct = product.match_pct ?? ''
  const hasVideo = Boolean(String(product.video_url || '').trim()) || (product.has_video ?? false)
  const storyHero = product.story_hero ?? name
  const storySub = product.story_sub ?? ''
  const storyQuote = product.story_quote ?? ''
  const storyDesc = product.story_desc ?? ''
  const tags = product.tags ?? []
  const keyIngredientsText = String(product.key_ingredients ?? '').trim()
  const clinicalResultText = String(product.clinical_result ?? '').trim()
  const certificationLines = String(product.certifications ?? '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
  const thumbImgs = product.thumb_images ?? []
  const galleryImgs = product.gallery_imgs ?? []
  const thumbUrl = product.storage_thumb_url || product.thumb_img || thumbImgs[0] || galleryImgs[0] || ''
  const pointRateRaw = Number((product as any).earn_points_percent ?? (product as any).earn_points ?? 0)
  const pointRate = Number.isFinite(pointRateRaw) && pointRateRaw > 0 ? Math.min(100, Math.max(0, pointRateRaw)) : 1
  const expectedPurchasePts = Math.floor((price * pointRate) / 100)
  const detailHtml = (product as any).detail_html ? String((product as any).detail_html) : ''
  const detailContentText = (product as any).detail_content ? String((product as any).detail_content) : ''
  const detailGalleryUrls = (Array.isArray((product as any).detail_images) ? (product as any).detail_images : Array.isArray((product as any).detail_imgs) ? (product as any).detail_imgs : []) as unknown[]
  const detailGalleryUrlsClean = detailGalleryUrls
    .map(u => (typeof u === 'string' ? u.trim() : ''))
    .filter(Boolean) as string[]
  const total = (price * qty).toLocaleString() + '원'

  let reviewListAvg = 0
  const concernFreq: Record<string, number> = {}
  const skinFreq: Record<string, number> = {}
  if (reviews.length >= 1) {
    let sumR = 0
    for (let ri = 0; ri < reviews.length; ri++) {
      const r = reviews[ri]
      const rv = Number(r?.rating || 0)
      sumR += rv
      if (Array.isArray(r?.helpful_concerns)) {
        for (let ci = 0; ci < r.helpful_concerns.length; ci++) {
          const k = String(r.helpful_concerns[ci] || '').trim()
          if (!k) continue
          concernFreq[k] = (concernFreq[k] || 0) + 1
        }
      }
      const st = r?.skin_type != null ? String(r.skin_type).trim() : ''
      if (st) skinFreq[st] = (skinFreq[st] || 0) + 1
    }
    reviewListAvg = sumR / reviews.length
  }
  const top3Concerns = Object.entries(concernFreq).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const skinDistEntries = Object.entries(skinFreq)

  const wrap: React.CSSProperties = {
    background: '#0d0b09', color: '#e8e4dc', maxWidth: 430,
    margin: '0 auto', minHeight: '100vh', paddingBottom: '80px',
    fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
  }
  const tag = (bg: string, color: string, border: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: 10, padding: '2px 9px',
    borderRadius: 20, fontWeight: 700,
    background: bg, color, border: `1px solid ${border}`,
  })

  const thumbs = thumbImgs
  const maxThumbs = thumbs.slice(0, 4)
  const activeMainImageUrl =
    activeThumb === 0
      ? thumbUrl
      : activeThumb >= 1 && activeThumb <= maxThumbs.length
        ? maxThumbs[activeThumb - 1]
        : activeThumb > maxThumbs.length
          ? galleryImgs[activeThumb - maxThumbs.length - 1] || thumbUrl
          : thumbUrl

  return (
    <div style={wrap}>
      {/* 탑바 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: '#0d0b09', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontSize: 20, color: GOLD, cursor: 'pointer' }} onClick={() => router.back()}>←</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>상품 상세</div>
        <div style={{ fontSize: 18, cursor: 'pointer' }}>⎙</div>
      </div>

      {/* 갤러리 */}
      <div style={{ position: 'relative', background: '#0f0c08' }}>
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#1e1810,#131008)', position: 'relative' }}>
          {discount > 0 && (
            <div style={{ position: 'absolute', top: 14, left: 14, background: '#c02030', color: '#fff', fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 20 }}>⚡ -{discount}%</div>
          )}
          <div style={{ position: 'absolute', top: 14, right: 14, background: '#2a1f0e', border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            피부 매칭 {matchPct}
          </div>
          {activeThumb === 99 ? (
            <video
              src={product.video_url}
              controls
              autoPlay
              style={{ width: '100%', height: '280px', objectFit: 'cover' }}
            />
          ) : (
            activeMainImageUrl ? (
              <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <img src={activeMainImageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ fontSize: 80, color: '#555' }}>🧴</div>
            )
          )}
        </div>

        {/* 썸네일 스트립 */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: '#0a0807', overflowX: 'auto' }}>
          <div onClick={() => setActiveThumb(0)} onMouseEnter={() => setActiveThumb(0)} style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === 0 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {thumbUrl
              ? <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ fontSize: 26 }}>🧴</div>}
          </div>
          {maxThumbs.map((url, i) => (
            <div key={i} onClick={() => setActiveThumb(i + 1)} onMouseEnter={() => setActiveThumb(i + 1)} style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === i + 1 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {galleryImgs.map((url, i) => (
            <div key={`g-${i}`} onClick={() => setActiveThumb(maxThumbs.length + i + 1)} onMouseEnter={() => setActiveThumb(maxThumbs.length + i + 1)} style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === maxThumbs.length + i + 1 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {hasVideo && (
            <div
              onClick={() => setActiveThumb(99)}
              onMouseEnter={() => setActiveThumb(99)}
              style={{
                width: 58,
                height: 58,
                borderRadius: 8,
                flexShrink: 0,
                border: `2px solid ${activeThumb === 99 ? GOLD : 'transparent'}`,
                background: '#1a1008',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <video
                src={product.video_url}
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(201,169,110,0.9)', borderRadius: 3, padding: '1px 4px', fontSize: 8, color: '#000', fontWeight: 700 }}>
                ▶
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 제품 기본 정보 */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' as const }}>
          <span style={{ fontSize: 12, color: '#888' }}>{brand} · {origin}</span>
          <span style={tag('#1a2e1a','#6fcf97','#2a4a2a')}>재구매 {repurchaseRate}%</span>
          <span style={tag('#1a1e30','#74b0ff','#2a2e50')}>일촌 {activeUsers}명 사용중</span>
        </div>
        {aiRecommendLine ? (
          <div
            style={{
              alignSelf: 'flex-start',
              marginBottom: 6,
              display: 'inline-block',
              background: 'rgba(201,169,110,0.1)',
              border: '1px solid rgba(201,169,110,0.3)',
              borderRadius: 20,
              padding: '4px 12px',
              fontSize: 11,
              color: '#C9A96E',
            }}
          >
            {aiRecommendLine}
          </div>
        ) : null}
        <div style={{ fontSize: 20, fontWeight: 400, lineHeight: 1.4, marginBottom: 5, color: '#e8e4dc' }}>{name}</div>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6, marginBottom: 10 }}>{seoDesc}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: GOLD }}>{hasValidPrice ? `${price.toLocaleString()}원` : '가격문의'}</div>
          {discount > 0 && <div style={{ fontSize: 14, color: '#555', textDecoration: 'line-through' }}>{origPrice.toLocaleString()}원</div>}
        </div>
        {hasValidPrice ? (
          <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginBottom: 10 }}>
            이 상품 구매시 {expectedPurchasePts.toLocaleString()}P 적립
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 10, fontSize: 11 }}>
          {product.review_count >= 5 ? (
            <span style={{ color: '#888' }}>
              재구매율 <span style={{ color: GOLD }}>{product.avg_rating * 18}%</span>
            </span>
          ) : null}
          <span style={{ color: '#888' }}>
            <span style={{ color: GOLD }}>오늘 주문 시 내일 출고</span>
            {' · '}
            무료배송 3만원 이상
          </span>
          {product.sales_count != null && Number(product.sales_count) > 0 ? (
            <span style={{ color: '#888' }}>
              <span style={{ color: GOLD }}>{Number(product.sales_count).toLocaleString()}</span>명이 구매했어요
            </span>
          ) : null}
        </div>

        {discount > 0 && (
          <div style={{ background: '#171310', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ color: '#e05050' }}>🔥</div>
            <div style={{ fontSize: 12, color: '#888', flex: 1 }}>타임세일 마감까지</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['02','33','25'].map((n, i) => (
                <div key={i} style={{ background: '#2a2218', border: '1px solid #3a3020', color: GOLD, fontSize: 14, fontWeight: 700, width: 34, height: 30, borderRadius: 6, textAlign: 'center', lineHeight: '30px' }}>{n}</div>
              ))}
            </div>
          </div>
        )}

        {detailHtml ? (
          <div
            style={{
              marginBottom: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              lineHeight: 1.7,
            }}
            dangerouslySetInnerHTML={{ __html: detailHtml }}
          />
        ) : null}
        {!detailHtml && detailContentText ? (
          <div
            style={{
              marginBottom: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {detailContentText}
          </div>
        ) : null}
        {detailGalleryUrlsClean.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
            {detailGalleryUrlsClean.map((u, i) => (
              <img
                key={`${u}_${i}`}
                src={u}
                alt=""
                style={{ width: '100%', height: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}
              />
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ color: GOLD, fontSize: 17, letterSpacing: 2 }}>★★★★★</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{rating}</span>
          <span style={{ fontSize: 12, color: '#666' }}>리뷰 {reviewCount}개</span>
          <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto', cursor: 'pointer' }}>전체보기 ›</span>
        </div>
        {!reviewsLoading && reviews.length >= 1 ? (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 11, color: '#888', marginBottom: 10, fontWeight: 700 }}>리뷰 통계</div>
            <div style={{ fontSize: 12, color: '#e8e4dc', marginBottom: 10 }}>
              평균 별점 <span style={{ color: GOLD }}>{reviewListAvg.toFixed(1)}</span>
            </div>
            <div style={{ marginBottom: 10 }}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = reviews.filter(r => r.rating === star).length
                const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#C9A96E', width: 20 }}>{star}★</span>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#C9A96E', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: '#666', width: 24 }}>{count}</span>
                  </div>
                )
              })}
            </div>
            {top3Concerns.length > 0 ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>도움 태그 Top3</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {top3Concerns.map(([label, cnt]) => (
                    <span
                      key={label}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 10,
                        background: 'rgba(123,94,167,0.15)',
                        border: '1px solid rgba(123,94,167,0.3)',
                        color: '#B09AD0',
                      }}
                    >
                      {label} {cnt}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {skinDistEntries.length > 0 ? (
              <div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>피부타입</div>
                <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.7 }}>
                  {skinDistEntries.map(([sk, cnt]) => (
                    <div key={sk}>
                      {sk} {cnt}명
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div ref={reviewSectionRef}>
        {reviewsLoading ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>로딩중...</div>
        ) : reviews.length === 0 ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>아직 리뷰가 없어요</div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {reviews.map((rv, i) => (
              <div
                key={rv.id || i}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 16,
                  margin: '8px 0',
                  color: '#fff',
                }}
              >
                <div style={{ marginBottom: 8, color: GOLD }}>
                  {'★'.repeat(Math.max(0, Number(rv.rating || 0)))}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 8 }}>
                  {rv.content || ''}
                </div>
                {Array.isArray(rv.helpful_concerns) && rv.helpful_concerns.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {rv.helpful_concerns.map((c: string) => (
                      <span key={c} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: 'rgba(123,94,167,0.15)', border: '1px solid rgba(123,94,167,0.3)', color: '#B09AD0' }}>✓ {c}</span>
                    ))}
                  </div>
                )}
                {Array.isArray(rv.images) && rv.images[0] ? (
                  <img
                    src={rv.images[0]}
                    alt=""
                    style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                  />
                ) : null}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  {rv.author_id ? '익명' : ''}
                  {rv.created_at ? `${rv.author_id ? ' · ' : ''}${String(rv.created_at).slice(0, 10)}` : ''}
                </div>
                {myReviewDoc &&
                rv.id === myReviewDoc.id &&
                myReviewDoc.is_edited !== true &&
                Date.now() - new Date(myReviewDoc.created_at).getTime() < 7 * 24 * 60 * 60 * 1000 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEditReviewDraft({
                        id: String(rv.id),
                        rating: Number(rv.rating || 0),
                        content: String(rv.content || ''),
                        helpful_concerns: Array.isArray(rv.helpful_concerns) ? rv.helpful_concerns : [],
                        images: Array.isArray(rv.images) ? rv.images : [],
                      })
                    }
                    style={{
                      fontSize: 12,
                      color: GOLD,
                      background: 'rgba(201,169,110,0.12)',
                      border: '1px solid rgba(201,169,110,0.35)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      marginBottom: 8,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    수정하기
                  </button>
                ) : null}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            ))}
          </div>
        )}
        {showReviewForm || editReviewDraft ? (
          <ReviewForm
            key={editReviewDraft?.id || 'new'}
            productId={product.id}
            initialReview={editReviewDraft}
            onSuccess={async () => {
              setShowReviewBanner(false)
              setShowReviewForm(false)
              setEditReviewDraft(null)
              await fetchReviews()
              const {
                data: { session },
              } = await supabase.auth.getSession()
              if (!session?.user?.id) {
                setMyReviewDoc(null)
                return
              }
              const { data: refreshed } = await supabase
                .from('reviews')
                .select('id, content, rating, helpful_concerns, is_edited, created_at')
                .eq('author_id', session.user.id)
                .eq('target_id', product.id)
                .maybeSingle()
              setMyReviewDoc(refreshed || null)
            }}
          />
        ) : null}
        </div>

        <div style={{ background: '#171310', border: '1px solid #252018', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#2a2010,#3a3020)', border: `1px solid ${GOLD}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: GOLD, textAlign: 'center', lineHeight: 1.3, flexShrink: 0 }}>
            {brand.substring(0,4)}<br />{brand.substring(4)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{brand} 공식 브랜드 상세</div>
            <div style={{ fontSize: 11, color: '#666' }}>브랜드사 직접 등록</div>
          </div>
          <span style={{ fontSize: 10, color: '#6fcf97', background: '#1a3020', border: '1px solid #2a4530', padding: '3px 9px', borderRadius: 20, flexShrink: 0 }}>✓ 공식</span>
        </div>
      </div>

      {/* 브랜드 스토리 */}
      <div style={{ background: 'linear-gradient(180deg,#1e1810,#14100c)', padding: '28px 20px' }}>
        <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, letterSpacing: 4, color: GOLD, marginBottom: 3 }}>{storyHero}</div>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#666', letterSpacing: 3, marginBottom: 22 }}>{storySub}</div>
        <div style={{ background: '#1a1410', borderLeft: `3px solid ${GOLD}`, padding: '14px 16px', borderRadius: '0 10px 10px 0', marginBottom: 18, fontSize: 13, lineHeight: 1.75, color: '#ccc', fontStyle: 'italic' }}>
          {storyQuote}<br /><span style={{ fontSize: 10, color: '#555', fontStyle: 'normal' }}>© {brand}</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.85, color: '#bbb', textAlign: 'center', marginBottom: 20 }}>
          {storyDesc.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' as const, justifyContent: 'center', marginBottom: 22 }}>
          {tags.map((t, i) => (
            <div key={i} style={{ fontSize: 11, color: '#888', background: '#1a1610', border: '1px solid #252018', padding: '4px 11px', borderRadius: 20 }}>#{t}</div>
          ))}
        </div>

        {keyIngredientsText ? (
          <>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>KEY INGREDIENTS</div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.75,
                color: '#bbb',
                whiteSpace: 'pre-wrap',
                marginBottom: 20,
                background: '#1a1610',
                border: '1px solid #252018',
                borderRadius: 12,
                padding: '14px 12px',
              }}
            >
              {keyIngredientsText}
            </div>
          </>
        ) : null}

        {clinicalResultText ? (
          <>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>CLINICAL RESULT</div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.75,
                color: '#bbb',
                whiteSpace: 'pre-wrap',
                marginBottom: 20,
                background: '#1a1610',
                border: '1px solid #252018',
                borderRadius: 12,
                padding: '14px 12px',
              }}
            >
              {clinicalResultText}
            </div>
          </>
        ) : null}
      </div>

      {/* 인증 */}
      {certificationLines.length > 0 ? (
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>CERTIFICATIONS</div>
          {certificationLines.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#141210', border: '1px solid #201c16', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ fontSize: 19 }}>{['🏆','✅','🌿','🏅','📋'][i % 5]}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{c}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* 같이 쓰면 */}
      {perfectTogetherRows.length > 0 ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>PERFECT TOGETHER</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {perfectTogetherRows.map((t, i) => (
              <div key={t.id || i} style={{ flex: 1, background: '#141210', border: '1px solid #201c16', borderRadius: 12, padding: 9, textAlign: 'center' }}>
                <div style={{ fontSize: 8, background: '#2a1f0e', color: GOLD, padding: '2px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-block', marginBottom: 6 }}>STEP {i + 1}</div>
                <div style={{ marginBottom: 5, width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.storage_thumb_url || t.thumb_img ? (
                    <img src={t.storage_thumb_url || t.thumb_img || ''} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: 28 }}>📦</div>
                  )}
                </div>
                <div style={{ fontSize: 8, color: '#666' }}>{t.brands?.name || ''}</div>
                <div style={{ fontSize: 10, lineHeight: 1.3 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginTop: 3 }}>{Number(t.retail_price || 0).toLocaleString()}원</div>
                <div
                  style={{ fontSize: 10, color: '#888', background: '#1e1a14', borderRadius: 5, padding: 4, marginTop: 5, cursor: 'pointer' }}
                  onClick={() => router.push(`/products/${t.id}`)}
                >
                  + 담기
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {sameSkinTypeRows.length > 0 ? (
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>같은 피부타입이 선택한 제품</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' as const }}>
            {sameSkinTypeRows.map((t, i) => (
              <div
                key={t.id || i}
                onClick={() => router.push(`/products/${t.id}`)}
                style={{
                  flexShrink: 0,
                  width: 120,
                  background: '#141210',
                  border: '1px solid #201c16',
                  borderRadius: 12,
                  padding: 9,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ marginBottom: 5, width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.storage_thumb_url || t.thumb_img ? (
                    <img src={t.storage_thumb_url || t.thumb_img || ''} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: 28 }}>📦</div>
                  )}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.3, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>{Number(t.retail_price || 0).toLocaleString()}원</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* 수량 */}
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0b09', borderTop: '1px solid #1a1610' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e1a14', border: '1px solid #2a2520', color: '#fff', fontSize: 20, textAlign: 'center', lineHeight: '30px', cursor: 'pointer', userSelect: 'none' }}>−</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{qty}</div>
          <div onClick={() => setQty(q => q + 1)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e1a14', border: '1px solid #2a2520', color: '#fff', fontSize: 20, textAlign: 'center', lineHeight: '30px', cursor: 'pointer', userSelect: 'none' }}>+</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>{total}</div>
      </div>

      {showReviewBanner ? (
        <button
          type="button"
          onClick={() => reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={{
            position: 'fixed',
            top: '30%',
            right: 0,
            borderRadius: '50% 0 0 50%',
            width: 52,
            height: 52,
            background: '#7B5EA7',
            color: '#fff',
            fontSize: 10,
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          <span style={{ lineHeight: 1.1 }}>✍️</span>
          <span style={{ lineHeight: 1.1 }}>+{reviewToastAmount}T</span>
        </button>
      ) : null}

      {/* 3버튼 완전 붙이기 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#0D0B09', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, background: '#1e1a14', border: 'none', color: '#aaa', fontSize: 13, fontWeight: 400, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>🛒 담기</button>
        <button style={{ flex: 1, background: '#241e0e', border: 'none', color: GOLD, fontSize: 13, fontWeight: 400, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>🎁 선물하기</button>
        <button onClick={() => void handleBuy()} style={{ flex: 2, background: `linear-gradient(135deg,${GOLD},#a07840)`, border: 'none', color: '#000', fontSize: 16, fontWeight: 400, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>지금 구매</button>
      </div>

      {loginSheetOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => {
            try {
              localStorage.removeItem('pending_payment')
              localStorage.removeItem('pending_payment_ctx')
            } catch {}
            setLoginSheetOpen(false)
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 430,
              background: '#1a1a1a',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '22px 20px 28px',
              borderTop: `1px solid ${GOLD}44`,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
              결제를 위해 로그인이 필요해요
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 18, textAlign: 'center' }}>
              로그인 후 이 페이지에서 결제를 이어갈게요
            </div>
            <button
              type="button"
              onClick={() =>
                void supabase.auth.signInWithOAuth({
                  provider: 'kakao',
                  options: { redirectTo: typeof window !== 'undefined' ? window.location.href.split('#')[0] : undefined },
                })
              }
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: 'none',
                background: '#FEE500',
                color: '#191600',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              카카오로 로그인
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem('pending_payment')
                  localStorage.removeItem('pending_payment_ctx')
                } catch {}
                setLoginSheetOpen(false)
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid ${GOLD}`,
                background: 'transparent',
                color: GOLD,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}