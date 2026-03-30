'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ReviewForm } from '@/components/reviews/ReviewForm'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'

type Row = {
  product: any
  review: any | null
}

export default function MyReviewsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [formProductId, setFormProductId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{
    id: string
    rating: number
    content: string
    helpful_concerns: string[]
    images: string[]
  } | null>(null)

  const load = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      setRows([])
      setLoading(false)
      return
    }
    const uid = session.user.id
    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*, brands(name)))')
      .eq('customer_id', uid)
      .order('created_at', { ascending: false })

    const byPid = new Map<string, any>()
    for (const order of orders || []) {
      for (const oi of order.order_items || []) {
        const p = oi.products
        if (p?.id && !byPid.has(String(p.id))) byPid.set(String(p.id), p)
      }
    }
    const products = Array.from(byPid.values())
    const ids = products.map((p: any) => p.id).filter(Boolean)
    let reviewMap: Record<string, any> = {}
    if (ids.length > 0) {
      const { data: revs } = await supabase
        .from('reviews')
        .select('id, content, rating, helpful_concerns, is_edited, created_at, images, target_id')
        .eq('author_id', uid)
        .in('target_id', ids)
      for (const r of revs || []) {
        const tid = String((r as any).target_id)
        if (!reviewMap[tid]) reviewMap[tid] = r
      }
    }
    setRows(products.map((product: any) => ({ product, review: reviewMap[String(product.id)] || null })))
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [supabase])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '96px' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER, backdropFilter: 'blur(12px)' }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: GOLD, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 400 }}>리뷰 관리</span>
      </header>

      <div style={{ padding: '16px' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: TEXT_MUTED }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ fontSize: 13, color: TEXT_MUTED, textAlign: 'center', padding: '40px 0' }}>구매한 제품이 없어요</div>
        ) : (
          rows.map(({ product, review }) => {
            const thumb = product.storage_thumb_url || product.thumb_img || ''
            const brand = product.brands?.name || ''
            const canEdit =
              review &&
              review.is_edited !== true &&
              Date.now() - new Date(review.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
            return (
              <div key={product.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 12, background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 12 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: '#1a1610', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28 }}>🧴</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: 'rgba(201,169,110,0.6)', marginBottom: 2 }}>{brand}</div>
                    <div style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.35 }}>{product.name}</div>
                    {!review ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditDraft(null)
                          setFormProductId(prev => (prev === product.id ? null : product.id))
                        }}
                        style={{ background: PURPLE, border: 'none', color: '#fff', fontSize: 12, padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        리뷰 쓰기
                      </button>
                    ) : (
                      <>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 8 }}>{review.content || ''}</div>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => {
                              setFormProductId(product.id)
                              setEditDraft({
                                id: String(review.id),
                                rating: Number(review.rating || 0),
                                content: String(review.content || ''),
                                helpful_concerns: Array.isArray(review.helpful_concerns) ? review.helpful_concerns : [],
                                images: Array.isArray(review.images) ? review.images : [],
                              })
                            }}
                            style={{ fontSize: 12, color: GOLD, background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.35)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            수정
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                {formProductId === product.id ? (
                  <ReviewForm
                    key={editDraft?.id || `new-${product.id}`}
                    productId={product.id}
                    initialReview={editDraft}
                    onSuccess={async () => {
                      setFormProductId(null)
                      setEditDraft(null)
                      await load()
                    }}
                  />
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
