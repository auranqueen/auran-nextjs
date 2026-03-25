'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [filter, setFilter] = useState<'all'|'photo'|'best'>('all')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let query = supabase
      .from('reviews')
      .select('*, author:profiles(id, full_name, skin_type), product:products(id, name, thumb_img, retail_price)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (filter === 'photo') query = query.not('images', 'is', null)
    if (filter === 'best') query = query.eq('is_best', true)

    query.then(({ data }) => { if (data) setReviews(data) })
  }, [filter])

  return (
    <div style={{ background: '#0D0B09', minHeight: '100vh', color: '#fff', paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700 }}>전체 리뷰</span>
      </div>

      {/* 필터 탭 */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 20px' }}>
        {[['all','전체'], ['photo','포토·영상'], ['best','베스트']].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key as any)} style={{
            padding: '8px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: filter === key ? '#C9A96E' : 'rgba(255,255,255,0.05)',
            color: filter === key ? '#000' : 'rgba(255,255,255,0.6)',
            border: filter === key ? 'none' : '1px solid rgba(255,255,255,0.1)',
            fontWeight: filter === key ? 700 : 400
          }}>{label}</button>
        ))}
      </div>

      {/* 리뷰 리스트 */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {reviews.map(review => (
          <div key={review.id} onClick={() => router.push(`/reviews/${review.id}`)}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: 16, cursor: 'pointer'
            }}>
            
            {/* 베스트 뱃지 */}
            {review.is_best && (
              <div style={{
                display: 'inline-block', background: '#C9A96E', color: '#000',
                fontSize: 10, fontWeight: 700, padding: '3px 8px',
                borderRadius: 10, marginBottom: 10, letterSpacing: '0.1em'
              }}>⭐ BEST</div>
            )}

            {/* 작성자 + 별점 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{review.author?.full_name || '익명'}</div>
                {review.skin_type && (
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(201,169,110,0.15)', color: '#C9A96E'
                  }}>{review.skin_type}</span>
                )}
              </div>
              <div style={{ color: '#C9A96E', fontSize: 13 }}>
                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </div>
            </div>

            {/* 사용기간 */}
            {review.used_period && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                {review.used_period} 사용
              </div>
            )}

            {/* 피부 고민 도움 태그 */}
            {review.helpful_concerns?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {review.helpful_concerns.map((c: string) => (
                  <span key={c} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.6)'
                  }}>✓ {c}에 도움</span>
                ))}
              </div>
            )}

            {/* 리뷰 내용 */}
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 12 }}>
              {review.content}
            </div>

            {/* 포토 이미지 */}
            {review.images?.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
                {review.images.map((img: string, i: number) => (
                  <img key={i} src={img} alt="" style={{
                    width: 80, height: 80, borderRadius: 8,
                    objectFit: 'cover', flexShrink: 0
                  }} />
                ))}
              </div>
            )}

            {/* 제품 + 구매버튼 */}
            {review.product && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {review.product.thumb_img && (
                    <img src={review.product.thumb_img} alt="" style={{
                      width: 40, height: 40, borderRadius: 6, objectFit: 'cover'
                    }} />
                  )}
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>이 제품 리뷰</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{review.product.name}</div>
                    <div style={{ fontSize: 12, color: '#C9A96E' }}>{review.product.retail_price?.toLocaleString()}원</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); }} style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff'
                  }}>🛒 담기</button>
                  <button onClick={e => { e.stopPropagation(); window.location.href = `/products/${review.product.id}` }} style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                    background: '#C9A96E', border: 'none', color: '#000', fontWeight: 700
                  }}>지금구매</button>
                </div>
              </div>
            )}

            {/* 도움돼요 */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={e => e.stopPropagation()} style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '4px 12px', color: 'rgba(255,255,255,0.5)',
                fontSize: 12, cursor: 'pointer'
              }}>👍 도움돼요 {review.helpful_count || 0}</button>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                {new Date(review.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

