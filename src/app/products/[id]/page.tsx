'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const supabase = createClient()

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [liked, setLiked] = useState(false)
  const [reviews, setReviews] = useState<any[]>([])
  const [related, setRelated] = useState<any[]>([])
  const [timeSale, setTimeSale] = useState<any>(null)
  const [timer, setTimer] = useState({ h: 2, m: 34, s: 21 })
  const [activeTab, setActiveTab] = useState<'detail' | 'review'>('detail')
  const [addedToCart, setAddedToCart] = useState(false)

  const pad = (n: number) => String(n).padStart(2, '0')

  useEffect(() => {
    if (!params?.id) return
    // TODO: products 테이블에서 상품 조회
    supabase.from('products').select('*, brands(*)').eq('id', params.id).single().then(({ data }) => {
      if (data) setProduct(data)
      setLoading(false)
    })
    // TODO: reviews 테이블에서 해당 상품 리뷰 조회
    supabase.from('reviews').select('*').eq('product_id', params.id).order('created_at', { ascending: false }).limit(3).then(({ data }) => {
      if (data) setReviews(data)
    })
    // TODO: time_sales 테이블에서 타임세일 조회
    supabase.from('time_sales').select('*').eq('product_id', params.id).eq('is_active', true).single().then(({ data }) => {
      if (data) setTimeSale(data)
    })
    // TODO: 연관 상품 조회
    supabase.from('products').select('*').eq('is_active', true).limit(4).then(({ data }) => {
      if (data) setRelated(data)
    })
  }, [params?.id])

  // 타임세일 타이머
  useEffect(() => {
    if (!timeSale && from !== 'timesale') return
    const id = setInterval(() => {
      setTimer(prev => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 }
        if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 }
        if (prev.h > 0) return { ...prev, h: prev.h - 1, m: 59, s: 59 }
        return prev
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timeSale, from])

  const handleAddToCart = async () => {
    if (!product) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    // TODO: cart_items 테이블에 추가
    await supabase.from('cart_items').upsert({ user_id: user.id, product_id: product.id, quantity: qty })
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const handleBuyNow = async () => {
    if (!product) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    router.push(`/checkout?product_id=${product.id}&qty=${qty}${timeSale ? `&sale_id=${timeSale.id}` : ''}`)
  }

  const handleGift = async () => {
    if (!product) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    router.push(`/gift?product_id=${product.id}&qty=${qty}`)
  }

  if (loading) return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '13px', color: TEXT_MUTED, fontFamily: 'sans-serif' }}>로딩 중...</div>
    </div>
  )

  if (!product) return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', fontFamily: 'sans-serif' }}>
      <div style={{ fontSize: '40px' }}>🔍</div>
      <div style={{ fontSize: '13px', color: TEXT_MUTED }}>상품을 찾을 수 없어요</div>
      <div onClick={() => router.back()} style={{ padding: '8px 20px', background: GOLD, borderRadius: '8px', fontSize: '12px', color: BG, cursor: 'pointer' }}>돌아가기</div>
    </div>
  )

  const isTimeSale = from === 'timesale' || !!timeSale
  const isNew = from === 'new' || product.is_new
  const salePrice = timeSale?.sale_price || product.sale_price
  const discPct = timeSale?.discount_percent || product.discount_percent

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '120px' }}>

      {/* 탑바 */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER, backdropFilter: 'blur(12px)' }}>
        <button onClick={() => router.back()} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#fff' }}>‹</button>
        <span style={{ fontSize: '13px', fontWeight: 400, color: 'rgba(255,255,255,0.75)' }}>상품 상세</span>
        <button onClick={() => setLiked(!liked)} style={{ width: '34px', height: '34px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer' }}>
          {liked ? '❤️' : '🤍'}
        </button>
      </header>

      {/* 타임세일 배너 */}
      {isTimeSale && (
        <div style={{ background: 'rgba(220,60,40,0.1)', borderBottom: '1px solid rgba(220,60,40,0.2)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: '#E07060' }}>⚡ 타임세일 마감까지</span>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {[timer.h, timer.m, timer.s].map((v, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                {i > 0 && <span style={{ color: 'rgba(220,60,40,0.5)', fontSize: '12px' }}>:</span>}
                <span style={{ background: 'rgba(220,60,40,0.2)', border: '1px solid rgba(220,60,40,0.3)', borderRadius: '5px', padding: '2px 7px', fontSize: '13px', color: '#E07060', fontFamily: 'monospace' }}>{pad(v)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* NEW 배너 */}
      {isNew && !isTimeSale && (
        <div style={{ background: 'rgba(96,64,224,0.1)', borderBottom: '1px solid rgba(96,64,224,0.2)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ background: 'linear-gradient(90deg,#6040E0,#A040E0)', borderRadius: '4px', padding: '2px 7px', fontSize: '9px', color: '#fff' }}>NEW</div>
          <span style={{ fontSize: '11px', color: 'rgba(160,120,240,0.8)' }}>출시 기념 첫 구매 +100P 적립</span>
        </div>
      )}

      {/* 상품 이미지 */}
      <div style={{ position: 'relative', height: '300px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: '80px' }}>🧴</span>
        }
        {product.stock_quantity && product.stock_quantity < 20 && (
          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(220,60,40,0.85)', borderRadius: '6px', padding: '3px 8px', fontSize: '10px', color: '#fff' }}>
            잔여 {product.stock_quantity}개
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
          <div style={{ width: '16px', height: '4px', borderRadius: '2px', background: GOLD }} />
          <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ width: '5px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      {/* 기본 정보 */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: '9px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', letterSpacing: '1px', marginBottom: '4px' }}>
          {product.brands?.name || product.brand || 'BRAND'}
        </div>
        <div style={{ fontSize: '18px', fontWeight: 400, color: '#fff', marginBottom: '6px', lineHeight: 1.4 }}>{product.name}</div>
        <div style={{ fontSize: '12px', color: TEXT_MUTED, lineHeight: 1.7, marginBottom: '12px' }}>{product.description}</div>

        {/* AI 추천 한줄 */}
        <div style={{ padding: '8px 12px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>🔬</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            <em style={{ color: GOLD, fontStyle: 'normal' }}>내 피부 타입</em>에 높은 매칭 · AI 분석 기반 추천
          </span>
        </div>

        {/* 사회적 증거 */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ padding: '4px 10px', background: CARD_BG, border: CARD_BORDER, borderRadius: '20px', fontSize: '10px', color: TEXT_MUTED }}>👥 일촌 12명 사용중</div>
          <div style={{ padding: '4px 10px', background: CARD_BG, border: CARD_BORDER, borderRadius: '20px', fontSize: '10px', color: TEXT_MUTED }}>🔄 재구매율 84%</div>
          <div style={{ padding: '4px 10px', background: 'rgba(74,200,120,0.08)', border: '1px solid rgba(74,200,120,0.2)', borderRadius: '20px', fontSize: '10px', color: 'rgba(100,220,140,0.8)' }}>🚚 오늘 주문 내일 도착</div>
        </div>

        {/* 가격 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '16px' }}>
          {discPct && <span style={{ fontSize: '13px', color: TEXT_DIM, textDecoration: 'line-through' }}>{product.price?.toLocaleString()}원</span>}
          <span style={{ fontSize: '24px', fontWeight: 400, color: isTimeSale ? '#E07060' : '#fff' }}>
            {(salePrice || product.price)?.toLocaleString()}원
          </span>
          {discPct && <span style={{ background: '#E04030', borderRadius: '5px', padding: '2px 7px', fontSize: '11px', color: '#fff' }}>-{discPct}%</span>}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', margin: '0 16px' }}>
        {(['detail', 'review'] as const).map((tab) => (
          <div key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '10px 0', textAlign: 'center', fontSize: '12px', fontWeight: activeTab === tab ? 400 : 300, color: activeTab === tab ? GOLD : TEXT_MUTED, borderBottom: activeTab === tab ? `2px solid ${GOLD}` : '2px solid transparent', cursor: 'pointer', marginBottom: '-1px' }}>
            {tab === 'detail' ? '상품 상세' : `리뷰 ${reviews.length || 127}`}
          </div>
        ))}
      </div>

      {/* 상세정보 탭 */}
      {activeTab === 'detail' && (
        <div style={{ padding: '16px' }}>
          {/* 브랜드 이미지 영역 */}
          {product.detail_html ? (
            <div dangerouslySetInnerHTML={{ __html: product.detail_html }} />
          ) : (
            <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ height: '200px', background: 'linear-gradient(160deg,#1a1510,#2a2015)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontSize: '40px' }}>🧴</span>
                <span style={{ fontSize: '10px', color: TEXT_DIM, fontFamily: 'monospace' }}>브랜드 상세 이미지</span>
              </div>
            </div>
          )}

          {/* 상품 스펙 */}
          <div style={{ padding: '12px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', marginTop: '12px' }}>
            {[
              { label: '용량', value: product.volume || '50ml' },
              { label: '원산지', value: product.origin || '프랑스' },
              { label: '제조사', value: product.brands?.name || product.brand || '-' },
              { label: '유통기한', value: '제조일로부터 36개월' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: '11px', color: TEXT_DIM }}>{item.label}</span>
                <span style={{ fontSize: '11px', color: TEXT_MUTED }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* 연관 제품 */}
          {related.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.75)', marginBottom: '10px' }}>PERFECT TOGETHER</div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {related.slice(0, 4).map((p: any, i: number) => (
                  <div key={i} onClick={() => router.push(`/products/${p.id}`)} style={{ minWidth: '100px', background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                    <div style={{ height: '70px', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px' }}>
                      {p.image_url ? <img src={p.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={p.name} /> : '🧴'}
                    </div>
                    <div style={{ padding: '7px 8px' }}>
                      <div style={{ fontSize: '8px', fontFamily: 'monospace', color: 'rgba(201,169,110,0.6)', marginBottom: '1px' }}>{p.brand}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px', lineHeight: 1.3 }}>{p.name}</div>
                      <div style={{ fontSize: '11px', fontWeight: 400 }}>{p.price?.toLocaleString()}원</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 리뷰 탭 */}
      {activeTab === 'review' && (
        <div style={{ padding: '16px' }}>
          {/* 별점 요약 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px', background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', marginBottom: '12px' }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '36px', fontWeight: 400, lineHeight: 1 }}>4.9</div>
              <div style={{ fontSize: '14px', margin: '4px 0 2px' }}>⭐⭐⭐⭐⭐</div>
              <div style={{ fontSize: '10px', color: TEXT_DIM }}>{reviews.length || 127}개</div>
            </div>
            <div style={{ flex: 1 }}>
              {[5, 4, 3, 2, 1].map((star, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', color: TEXT_DIM, width: '8px' }}>{star}</span>
                  <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '3px' }}>
                    <div style={{ height: '100%', width: i === 0 ? '88%' : i === 1 ? '10%' : '2%', background: GOLD, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 리뷰 목록 */}
          {(reviews.length > 0 ? reviews : [
            { avatar: '🌸', name: '소미님', skin: '건성·민감성', stars: 5, text: '환절기마다 당겼는데 이거 쓰고 달라졌어요. 3번째 재구매 💧', date: '03.01' },
            { avatar: '🌺', name: '지연님', skin: '복합성·30대', stars: 5, text: '발림성 진짜 최고예요. 끈적임 없이 쏙 흡수돼요 😍', date: '02.20' },
            { avatar: '💜', name: '수아님', skin: '건성·40대', stars: 5, text: 'AI 피부분석 후 추천받았는데 딱 맞아요. 수분값이 올라갔어요', date: '02.15' },
          ]).map((review: any, i: number) => (
            <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px' }}>{review.avatar || '👤'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: 400 }}>{review.name || review.reviewer_name}</div>
                  <div style={{ fontSize: '9px', color: TEXT_DIM }}>{review.skin || review.skin_type}</div>
                </div>
                <span style={{ fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace' }}>{review.date || review.created_at?.slice(5, 10)}</span>
              </div>
              <div style={{ fontSize: '11px', marginBottom: '5px' }}>{'⭐'.repeat(review.stars || review.rating || 5)}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{review.text || review.content}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', background: 'rgba(255,255,255,0.04)', border: CARD_BORDER, borderRadius: '6px', fontSize: '10px', color: TEXT_MUTED, cursor: 'pointer' }}>
                  👍 도움돼요 {review.helpful_count || 24}
                </div>
                <span style={{ fontSize: '9px', color: 'rgba(201,169,110,0.6)' }}>+5P 적립</span>
              </div>
            </div>
          ))}

          {/* 리뷰 작성 유도 */}
          <div style={{ padding: '12px 14px', background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', color: TEXT_MUTED, lineHeight: 1.6 }}>
              구매하셨나요? 리뷰 작성 시<br />
              <em style={{ color: GOLD, fontStyle: 'normal' }}>+50P 즉시 적립</em>
            </div>
            <div onClick={() => router.push('/reviews/write')} style={{ padding: '8px 14px', background: GOLD, borderRadius: '8px', fontSize: '11px', color: BG, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>✍️ 리뷰 작성</div>
          </div>
        </div>
      )}

      {/* 하단 고정 버튼 - 머스크: 화면 이탈 없이 완결 */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '390px', background: 'rgba(13,11,9,0.97)', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px 24px', zIndex: 50 }}>
        {/* 수량 조절 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: '30px', height: '30px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: '16px', fontWeight: 400, minWidth: '20px', textAlign: 'center' }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: CARD_BG, border: CARD_BORDER, color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 400, color: isTimeSale ? '#E07060' : '#fff' }}>
            {((salePrice || product?.price || 0) * qty).toLocaleString()}원
          </div>
        </div>

        {/* 3버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleAddToCart}
            style={{ flex: 1, padding: '13px 0', background: addedToCart ? 'rgba(74,200,120,0.15)' : CARD_BG, border: addedToCart ? '1px solid rgba(74,200,120,0.3)' : CARD_BORDER, borderRadius: '12px', fontSize: '13px', color: addedToCart ? 'rgba(100,220,140,0.9)' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            {addedToCart ? '✓ 담김!' : '🛒 담기'}
          </button>
          <button
            onClick={handleGift}
            style={{ flex: 1, padding: '13px 0', background: 'rgba(180,100,200,0.1)', border: '1px solid rgba(180,100,200,0.25)', borderRadius: '12px', fontSize: '13px', color: 'rgba(200,140,220,0.9)', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            🎁 선물하기
          </button>
          <button
            onClick={handleBuyNow}
            style={{ flex: 1.5, padding: '13px 0', background: isTimeSale ? '#C04030' : GOLD, borderRadius: '12px', fontSize: '13px', fontWeight: 400, color: isTimeSale ? '#fff' : BG, cursor: 'pointer', border: 'none', fontFamily: 'sans-serif' }}
          >
            {isTimeSale ? '⚡ 지금 구매' : '바로 구매'}
          </button>
        </div>
      </div>

    </div>
  )
}
