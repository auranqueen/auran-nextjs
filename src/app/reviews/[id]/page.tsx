'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ReviewDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [review, setReview] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*, author:profiles(id, full_name, skin_type), product:products(id, name, thumb_img, retail_price, brand_id)')
      .eq('id', id)
      .single()
      .then(({ data }) => { if (data) setReview(data) })
  }, [id])

  if (!review) return <div style={{ background: '#0D0B09', minHeight: '100vh' }} />

  return (
    <div style={{ background: '#0D0B09', minHeight: '100vh', color: '#fff', paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 700 }}>리뷰 상세</span>
        {review.is_best && (
          <span style={{
            background: '#C9A96E', color: '#000', fontSize: 10,
            fontWeight: 700, padding: '3px 8px', borderRadius: 10
          }}>⭐ BEST</span>
        )}
      </div>

      <div style={{ padding: '20px' }}>
        {/* 피부 효과 요약 */}
        {review.helpful_concerns?.length > 0 && (
          <div style={{
            background: 'rgba(201,169,110,0.08)',
            border: '1px solid rgba(201,169,110,0.2)',
            borderRadius: 16, padding: 16, marginBottom: 20
          }}>
            <div style={{ fontSize: 11, color: '#C9A96E', letterSpacing: '0.1em', marginBottom: 12 }}>
              이 리뷰어의 피부 효과
            </div>
            {review.helpful_concerns.map((c: string) => (
              <div key={c} style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8
              }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{c}에 도움</span>
              </div>
            ))}
          </div>
        )}

        {/* 작성자 정보 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{review.author?.full_name || '익명'}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {review.skin_type && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(201,169,110,0.15)', color: '#C9A96E'
                }}>{review.skin_type}</span>
              )}
              {review.used_period && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)'
                }}>{review.used_period} 사용</span>
              )}
            </div>
          </div>
          <div style={{ color: '#C9A96E', fontSize: 20 }}>
            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
          </div>
        </div>

        {/* 리뷰 내용 */}
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>
          {review.content}
        </div>

        {/* 포토/영상 */}
        {review.images?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
            {review.images.map((img: string, i: number) => (
              <img key={i} src={img} alt="" style={{
                width: 120, height: 120, borderRadius: 12,
                objectFit: 'cover', flexShrink: 0
              }} />
            ))}
          </div>
        )}

        {/* 도움돼요 */}
        <div style={{ marginBottom: 24 }}>
          <button style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 20, padding: '8px 20px', color: 'rgba(255,255,255,0.6)',
            fontSize: 13, cursor: 'pointer'
          }}>👍 도움돼요 {review.helpful_count || 0}</button>
        </div>

        {/* 제품 구매 버튼 */}
        {review.product && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#0D0B09', borderTop: '1px solid rgba(255,255,255,0.07)',
            padding: '16px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              {review.product.thumb_img && (
                <img src={review.product.thumb_img} alt="" style={{
                  width: 44, height: 44, borderRadius: 8, objectFit: 'cover'
                }} />
              )}
              <div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>리뷰 제품</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{review.product.name}</div>
                <div style={{ fontSize: 13, color: '#C9A96E', fontWeight: 700 }}>
                  {review.product.retail_price?.toLocaleString()}원
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                flex: 1, padding: '12px', borderRadius: 10, fontSize: 13,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer'
              }}>🛒 담기</button>
              <button style={{
                flex: 1, padding: '12px', borderRadius: 10, fontSize: 13,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer'
              }}>🎁 선물</button>
              <button
                onClick={() => window.location.href = `/products/${review.product.id}`}
                style={{
                  flex: 2, padding: '12px', borderRadius: 10, fontSize: 13,
                  background: '#C9A96E', border: 'none', color: '#000',
                  fontWeight: 700, cursor: 'pointer'
                }}>지금구매</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

