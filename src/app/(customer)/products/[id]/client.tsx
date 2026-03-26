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
  ingredients: { ico: string; name: string; desc: string }[]
  clinicals: { label: string; pct: number; width: number }[]
  certs: string[]
  together: { ico: string; brand: string; name: string; price: string; step: string; storage_thumb_url?: string; thumb_img?: string }[]
  thumb_images: string[]
  gallery_imgs?: string[]
  storage_thumb_url: string
  is_timesale?: boolean
  sale_price?: number
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter()
  const supabase = createClient()
  const [reviews, setReviews] = useState<any[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [qty, setQty] = useState(1)
  const [activeThumb, setActiveThumb] = useState(0)
  const [loginSheetOpen, setLoginSheetOpen] = useState(false)
  const paymentResumeOnce = useRef(false)

  const fetchReviews = async () => {
    setReviewsLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('target_id', product.id)
      .eq('status', '게시')
      .order('created_at', { ascending: false })
      .limit(20)
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

  useEffect(() => {
    if (!product?.id) return
    void fetchReviews()
  }, [product?.id])

  const brand = product.brands?.name || 'AURAN'
  const origin = product.origin ?? ''
  const name = product.name ?? '제품명'
  const seoDesc = product.description ?? ''
  const price = Number((product.is_timesale ? product.sale_price : product.retail_price) ?? 0)
  const origPrice = product.original_price ?? 0
  const discount = product.discount_rate ?? 0
  const rating = product.avg_rating ?? 4.9
  const reviewCount = product.review_count ?? 0
  const repurchaseRate = product.repurchase_rate ?? 0
  const activeUsers = product.active_users ?? 0
  const matchPct = product.match_pct ?? ''
  const hasVideo = product.has_video ?? false
  const storyHero = product.story_hero ?? name
  const storySub = product.story_sub ?? ''
  const storyQuote = product.story_quote ?? ''
  const storyDesc = product.story_desc ?? ''
  const tags = product.tags ?? []
  const ingredients = product.ingredients ?? []
  const clinicals = product.clinicals ?? []
  const certs = product.certs ?? []
  const together = product.together ?? []
  const thumbImgs = product.thumb_images ?? []
  const galleryImgs = product.gallery_imgs ?? []
  const thumbUrl = product.storage_thumb_url ?? ''
  const mainImageUrl = product.storage_thumb_url || product.thumb_img || thumbImgs[0] || ''
  const total = (price * qty).toLocaleString() + '원'

  const wrap: React.CSSProperties = {
    background: '#0d0b09', color: '#e8e4dc', maxWidth: 430,
    margin: '0 auto', minHeight: '100vh',
    fontFamily: '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif',
  }
  const tag = (bg: string, color: string, border: string): React.CSSProperties => ({
    display: 'inline-block', fontSize: 10, padding: '2px 9px',
    borderRadius: 20, fontWeight: 700,
    background: bg, color, border: `1px solid ${border}`,
  })

  const thumbs = thumbImgs
  const maxThumbs = thumbs.slice(0, 4)

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
            mainImageUrl
              ? <img src={mainImageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ fontSize: 80, color: '#555' }}>🧴</div>
          )}
        </div>

        {/* 썸네일 스트립 */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: '#0a0807', overflowX: 'auto' }}>
          <div onClick={() => setActiveThumb(0)} style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === 0 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {thumbUrl
              ? <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ fontSize: 26 }}>🧴</div>}
          </div>
          {maxThumbs.map((url, i) => (
            <div key={i} onClick={() => setActiveThumb(i + 1)} style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === i + 1 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {galleryImgs.map((url, i) => (
            <div key={`g-${i}`} onClick={() => setActiveThumb(maxThumbs.length + i + 1)} style={{ width: 58, height: 58, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: `2px solid ${activeThumb === maxThumbs.length + i + 1 ? GOLD : 'transparent'}`, background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ))}
          {hasVideo && (
            <div onClick={() => setActiveThumb(99)} style={{ width: 58, height: 58, borderRadius: 8, flexShrink: 0, border: `2px solid ${activeThumb === 99 ? GOLD : 'transparent'}`, background: '#1a1008', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <div style={{ fontSize: 20 }}>📹</div>
              <div style={{ position: 'absolute', bottom: 3, right: 3, background: 'rgba(201,169,110,0.9)', borderRadius: 3, padding: '1px 4px', fontSize: 8, color: '#000', fontWeight: 700 }}>▶</div>
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
        <div style={{ fontSize: 20, fontWeight: 400, lineHeight: 1.4, marginBottom: 5, color: '#e8e4dc' }}>{name}</div>
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6, marginBottom: 10 }}>{seoDesc}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: GOLD }}>{price.toLocaleString()}원</div>
          {discount > 0 && <div style={{ fontSize: 14, color: '#555', textDecoration: 'line-through' }}>{origPrice.toLocaleString()}원</div>}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ color: GOLD, fontSize: 17, letterSpacing: 2 }}>★★★★★</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>{rating}</span>
          <span style={{ fontSize: 12, color: '#666' }}>리뷰 {reviewCount}개</span>
          <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto', cursor: 'pointer' }}>전체보기 ›</span>
        </div>
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
                {Array.isArray(rv.images) && rv.images[0] ? (
                  <img
                    src={rv.images[0]}
                    alt=""
                    style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                  />
                ) : null}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  {rv.created_at ? String(rv.created_at).slice(0, 10) : ''}
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
              </div>
            ))}
          </div>
        )}
        <ReviewForm
          productId={product.id}
          onSuccess={() => {
            void fetchReviews()
          }}
        />

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

        <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>KEY INGREDIENTS</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {ingredients.map((ing, i) => (
            <div key={i} style={{ flex: 1, background: '#1a1610', border: '1px solid #252018', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{ing.ico}</div>
              <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>{ing.name}</div>
              <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{ing.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 3 }}>CLINICAL RESULT</div>
        <div style={{ fontSize: 10, color: '#555', marginBottom: 12 }}>프랑스 피부과 임상 30명 · 4주 사용 후</div>
        {clinicals.map((c, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#aaa' }}>{c.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>+{c.pct}%</span>
            </div>
            <div style={{ height: 6, background: '#1e1a14', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${c.width}%`, background: `linear-gradient(90deg,${GOLD},#e8c878)`, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>

      {/* 인증 */}
      <div style={{ padding: '18px 20px' }}>
        <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>CERTIFICATIONS</div>
        {certs.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#141210', border: '1px solid #201c16', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ fontSize: 19 }}>{['🏆','✅','🌿','🏅','📋'][i % 5]}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{c}</div>
          </div>
        ))}
      </div>

      {/* 같이 쓰면 */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ fontSize: 10, color: '#888', letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>PERFECT TOGETHER</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {together.map((t, i) => (
            <div key={i} style={{ flex: 1, background: '#141210', border: '1px solid #201c16', borderRadius: 12, padding: 9, textAlign: 'center' }}>
              <div style={{ fontSize: 8, background: '#2a1f0e', color: GOLD, padding: '2px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-block', marginBottom: 6 }}>{t.step}</div>
              <div style={{ marginBottom: 5, width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#1e1a14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t.storage_thumb_url || t.thumb_img ? (
                  <img src={t.storage_thumb_url || t.thumb_img} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: 28 }}>{t.ico}</div>
                )}
              </div>
              <div style={{ fontSize: 8, color: '#666' }}>{t.brand}</div>
              <div style={{ fontSize: 10, lineHeight: 1.3 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginTop: 3 }}>{t.price}</div>
              <div style={{ fontSize: 10, color: '#888', background: '#1e1a14', borderRadius: 5, padding: 4, marginTop: 5, cursor: 'pointer' }}>+ 담기</div>
            </div>
          ))}
        </div>
      </div>

      {/* 수량 */}
      <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0d0b09', borderTop: '1px solid #1a1610' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e1a14', border: '1px solid #2a2520', color: '#fff', fontSize: 20, textAlign: 'center', lineHeight: '30px', cursor: 'pointer', userSelect: 'none' }}>−</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{qty}</div>
          <div onClick={() => setQty(q => q + 1)} style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e1a14', border: '1px solid #2a2520', color: '#fff', fontSize: 20, textAlign: 'center', lineHeight: '30px', cursor: 'pointer', userSelect: 'none' }}>+</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>{total}</div>
      </div>

      {/* 3버튼 완전 붙이기 */}
      <div style={{ display: 'table', width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
        <button style={{ display: 'table-cell', width: '25%', background: '#1e1a14', border: 'none', borderRight: '1px solid #2a2520', color: '#aaa', fontSize: 13, fontWeight: 600, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', verticalAlign: 'middle' }}>🛒 담기</button>
        <button style={{ display: 'table-cell', width: '25%', background: '#241e0e', border: 'none', borderRight: '1px solid #3a3020', color: GOLD, fontSize: 13, fontWeight: 600, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', verticalAlign: 'middle' }}>🎁 선물하기</button>
        <button onClick={() => void handleBuy()} style={{ display: 'table-cell', width: '50%', background: `linear-gradient(135deg,${GOLD},#a07840)`, border: 'none', color: '#000', fontSize: 16, fontWeight: 800, padding: '15px 0', textAlign: 'center', cursor: 'pointer', fontFamily: 'inherit', verticalAlign: 'middle' }}>지금 구매</button>
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