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

type SalonReviewRow = {
  id: string
  service_name?: string | null
  rating?: number | null
  content?: string | null
  created_at?: string | null
  images?: string[] | null
  helpful_concerns?: string[] | null
  target_id: string
  salon_name: string
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export default function MyReviewsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<'product' | 'salon'>('product')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [salonRows, setSalonRows] = useState<SalonReviewRow[]>([])
  const [salonLoading, setSalonLoading] = useState(false)
  const [salonLoaded, setSalonLoaded] = useState(false)
  const [pendingBookings, setPendingBookings] = useState<Array<{ id: string; salon_id: string; salon_name: string; service_name: string | null; booking_date: string | null }>>([])
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
  }, [])

  const loadSalonReviews = async () => {
    setSalonLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      setSalonRows([])
      setSalonLoading(false)
      setSalonLoaded(true)
      return
    }
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', session.user.id).maybeSingle()
    if (!me?.id) {
      setSalonRows([])
      setSalonLoading(false)
      setSalonLoaded(true)
      return
    }
    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('id, salon_id, service_name, booking_date')
      .eq('customer_id', me.id)
      .eq('status', 'completed')
    const { data: reviewedBookingIds } = await supabase
      .from('reviews')
      .select('booking_id')
      .eq('author_id', me.id)
      .not('booking_id', 'is', null)
    const reviewedSet = new Set((reviewedBookingIds || []).map((r) => r.booking_id))
    const unreviewed = (completedBookings || []).filter((b) => !reviewedSet.has(b.id))
    if (unreviewed.length) {
      const salonIds = Array.from(new Set(unreviewed.map((b) => b.salon_id)))
      const { data: salonNames } = await supabase.from('salons').select('id, name').in('id', salonIds)
      const nameMap = new Map((salonNames || []).map((s) => [s.id, s.name]))
      setPendingBookings(
        unreviewed.map((b) => ({
          id: b.id,
          salon_id: b.salon_id,
          salon_name: nameMap.get(b.salon_id) || '',
          service_name: b.service_name,
          booking_date: b.booking_date,
        }))
      )
    } else {
      setPendingBookings([])
    }
    const { data: revs } = await supabase
      .from('reviews')
      .select('id, service_name, rating, content, created_at, images, helpful_concerns, target_id')
      .eq('author_id', me.id)
      .order('created_at', { ascending: false })
    const list = revs || []
    const targetIds = Array.from(new Set(list.map((r) => String((r as { target_id?: string }).target_id || '')).filter(Boolean)))
    let salonMap: Record<string, string> = {}
    if (targetIds.length > 0) {
      const { data: salons } = await supabase.from('salons').select('id, name').in('id', targetIds)
      for (const s of salons || []) {
        salonMap[String((s as { id: string }).id)] = String((s as { name?: string }).name || '샵')
      }
    }
    const merged: SalonReviewRow[] = list
      .filter((r) => salonMap[String((r as { target_id?: string }).target_id || '')])
      .map((r) => ({
        id: String((r as { id: string }).id),
        service_name: (r as SalonReviewRow).service_name,
        rating: (r as SalonReviewRow).rating,
        content: (r as SalonReviewRow).content,
        created_at: (r as SalonReviewRow).created_at,
        images: (r as SalonReviewRow).images,
        helpful_concerns: (r as SalonReviewRow).helpful_concerns,
        target_id: String((r as { target_id: string }).target_id),
        salon_name: salonMap[String((r as { target_id: string }).target_id)] || '샵',
      }))
    setSalonRows(merged)
    setSalonLoading(false)
    setSalonLoaded(true)
  }

  useEffect(() => {
    if (tab === 'salon') void loadSalonReviews()
  }, [tab])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '390px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: '96px' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(13,11,9,0.95)', borderBottom: CARD_BORDER, backdropFilter: 'blur(12px)' }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: GOLD, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
        <span style={{ fontSize: 16, fontWeight: 400 }}>리뷰 관리</span>
      </header>

      <div style={{ display: 'flex', background: BG, borderBottom: CARD_BORDER }}>
        <span
          onClick={() => setTab('product')}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '12px 0',
            fontSize: 13,
            cursor: 'pointer',
            color: tab === 'product' ? PURPLE : '#888888',
            borderBottom: tab === 'product' ? `2px solid ${PURPLE}` : '2px solid transparent',
            fontWeight: 400,
          }}
        >
          제품 리뷰
        </span>
        <span
          onClick={() => setTab('salon')}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '12px 0',
            fontSize: 13,
            cursor: 'pointer',
            color: tab === 'salon' ? PURPLE : '#888888',
            borderBottom: tab === 'salon' ? `2px solid ${PURPLE}` : '2px solid transparent',
            fontWeight: 400,
          }}
        >
          관리 후기
        </span>
      </div>

      <div style={{ padding: '16px' }}>
        {tab === 'product' ? (
        <>
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
        </>
        ) : salonLoading ? (
          <div style={{ fontSize: 13, color: TEXT_MUTED }}>불러오는 중...</div>
        ) : salonRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 8 }}>아직 관리 후기가 없어요</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>관리 완료 후 원장님 상담톡에서 작성할 수 있어요</div>
          </div>
        ) : (
          salonRows.map((row) => {
            const stars = '★'.repeat(Math.min(5, Math.max(0, Number(row.rating) || 0)))
            const concerns = Array.isArray(row.helpful_concerns) ? row.helpful_concerns : []
            return (
              <div
                key={row.id}
                style={{ marginBottom: 12, background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: 14 }}
              >
                <div style={{ fontSize: 12, color: PURPLE, marginBottom: 4 }}>{row.salon_name}</div>
                <div style={{ fontSize: 14, marginBottom: 6 }}>{row.service_name || '관리 프로그램'}</div>
                <div style={{ fontSize: 13, color: GOLD, marginBottom: 8, letterSpacing: 1 }}>{stars || '—'}</div>
                {concerns.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {concerns.map((c) => (
                      <span
                        key={c}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 20,
                          border: `1px solid rgba(123,94,167,0.35)`,
                          background: 'rgba(123,94,167,0.12)',
                          color: PURPLE,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.75)',
                    lineHeight: 1.55,
                    marginBottom: 8,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {row.content || ''}
                </div>
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{fmtDate(row.created_at)}</div>
              </div>
            )
          })
        )}

        {tab === 'salon' && pendingBookings.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>리뷰를 작성할 수 있어요</div>
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                onClick={() =>
                  router.push(
                    `/reviews/write?salon_id=${b.salon_id}&service=${encodeURIComponent(b.service_name || '')}&booking_id=${b.id}`
                  )
                }
                style={{
                  padding: '12px 14px',
                  marginBottom: 8,
                  borderRadius: 12,
                  background: PURPLE,
                  color: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {b.salon_name} · {b.service_name} 리뷰 쓰기
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
