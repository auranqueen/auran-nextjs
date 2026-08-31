'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getOwnerLinkedBrandIds } from '@/lib/brand/getOwnerLinkedBrandIds'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
const GOLD = '#C9A96E'

type TabKey = 'salon' | 'product'

type SalonReview = {
  id: string
  rating: number | null
  content: string | null
  helpful_concerns: string[] | null
  owner_reply: string | null
  replied_at: string | null
  created_at: string | null
  author_id: string | null
  users: { name: string | null } | null
}

type ProductReview = {
  id: string
  rating: number | null
  content: string | null
  created_at: string | null
  author_id: string | null
  brand_product_id: string | null
  users: { name: string | null } | null
  product_name?: string | null
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function stars(n?: number | null) {
  const r = Math.max(0, Math.min(5, Math.round(Number(n || 0))))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

export default function OwnerReviewsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('salon')
  const [salonId, setSalonId] = useState<string | null>(null)
  const [toastBalance, setToastBalance] = useState(0)
  const [salonReviews, setSalonReviews] = useState<SalonReview[]>([])
  const [productReviews, setProductReviews] = useState<ProductReview[]>([])
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      router.replace('/login?role=owner')
      return
    }

    const { data: me } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle()

    if (!me?.id) {
      setLoading(false)
      return
    }

    const { data: salonRow } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', me.id)
      .maybeSingle()

    const sid = salonRow?.id ? String(salonRow.id) : null
    setSalonId(sid)

    const { data: prof } = await supabase
      .from('profiles')
      .select('toast_balance')
      .eq('auth_id', user.id)
      .maybeSingle()
    setToastBalance(Number((prof as { toast_balance?: number } | null)?.toast_balance ?? 0))

    if (sid) {
      const { data: revRows } = await supabase
        .from('reviews')
        .select(
          'id, rating, content, helpful_concerns, owner_reply, replied_at, created_at, author_id, users:author_id(name)',
        )
        .eq('target_id', sid)
        .order('created_at', { ascending: false })
        .limit(100)
      const list = ((revRows || []) as unknown as SalonReview[]) || []
      setSalonReviews(list)
      const drafts: Record<string, string> = {}
      for (const r of list) {
        drafts[r.id] = r.owner_reply || ''
      }
      setReplyDrafts(drafts)
    } else {
      setSalonReviews([])
    }

    const brandIds = await getOwnerLinkedBrandIds(supabase, user.id)
    if (brandIds.length === 0) {
      setProductReviews([])
      setLoading(false)
      return
    }

    const { data: productRows } = await supabase
      .from('brand_products')
      .select('id, name')
      .in('brand_id', brandIds)
      .eq('status', 'active')

    const products = (productRows || []) as { id: string; name: string | null }[]
    const productIds = products.map((p) => p.id).filter(Boolean)
    const nameById = new Map(products.map((p) => [p.id, p.name || '']))

    if (productIds.length === 0) {
      setProductReviews([])
      setLoading(false)
      return
    }

    const { data: prodRevRows } = await supabase
      .from('brand_product_reviews')
      .select('id, rating, content, created_at, author_id, brand_product_id, users:author_id(name)')
      .in('brand_product_id', productIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)

    setProductReviews(
      ((prodRevRows || []) as unknown as ProductReview[]).map((r) => ({
        ...r,
        product_name: r.brand_product_id ? nameById.get(r.brand_product_id) || null : null,
      })),
    )
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const saveReply = async (reviewId: string) => {
    const text = (replyDrafts[reviewId] || '').trim()
    if (!text) {
      alert('답글을 입력해주세요')
      return
    }
    setSavingId(reviewId)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('reviews')
      .update({ owner_reply: text, replied_at: now } as any)
      .eq('id', reviewId)
    setSavingId(null)
    if (error) {
      alert('답글 저장에 실패했어요')
      return
    }
    setSalonReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, owner_reply: text, replied_at: now } : r)),
    )
    setEditingId(null)
  }

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 40 }}>
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner')}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}
        >
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>리뷰함</div>
      </div>

      <div
        style={{
          margin: '0 16px 16px',
          padding: '14px 16px',
          borderRadius: 12,
          background: LIGHT,
          border: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 12, color: SUB }}>적립 토스트 잔액</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: GOLD }}>{toastBalance.toLocaleString()}T</div>
      </div>

      {!salonId ? (
        <div style={{ margin: '24px 16px', textAlign: 'center', color: SUB, fontSize: 13 }}>등록된 살롱이 없어요</div>
      ) : null}

      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 16, padding: '0 16px' }}>
        {(
          [
            { key: 'salon' as const, label: `관리권 (${salonReviews.length})` },
            { key: 'product' as const, label: `제품 (${productReviews.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: 13,
              border: 'none',
              background: 'none',
              color: tab === t.key ? PURPLE : SUB,
              borderBottom: tab === t.key ? `2px solid ${PURPLE}` : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tab === 'salon' ? (
          salonReviews.length === 0 ? (
            <div style={{ textAlign: 'center', color: SUB, fontSize: 13, padding: 32 }}>아직 관리권 리뷰가 없어요</div>
          ) : (
            salonReviews.map((r) => {
              const hasReply = Boolean(r.owner_reply)
              const isEditing = editingId === r.id || !hasReply
              const tags = Array.isArray(r.helpful_concerns) ? r.helpful_concerns : []
              return (
                <div
                  key={r.id}
                  style={{
                    border: `1px solid ${BORDER}`,
                    borderRadius: 12,
                    padding: 14,
                    background: '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      {r.users?.name || '고객'}
                    </div>
                    <div style={{ fontSize: 11, color: SUB }}>{fmtDate(r.created_at)}</div>
                  </div>
                  <div style={{ color: GOLD, fontSize: 13, letterSpacing: 1, marginBottom: 6 }}>{stars(r.rating)}</div>
                  <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {r.content || '—'}
                  </div>
                  {tags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            color: PURPLE,
                            background: `${PURPLE}12`,
                            border: `0.5px solid ${PURPLE}30`,
                            borderRadius: 20,
                            padding: '3px 8px',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                    {hasReply && !isEditing ? (
                      <>
                        <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>
                          원장 답글 · {fmtDate(r.replied_at)}
                        </div>
                        <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {r.owner_reply}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.id)
                            setReplyDrafts((prev) => ({ ...prev, [r.id]: r.owner_reply || '' }))
                          }}
                          style={{
                            marginTop: 8,
                            border: `1px solid ${BORDER}`,
                            background: LIGHT,
                            color: PURPLE,
                            borderRadius: 8,
                            padding: '6px 12px',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          답글 수정
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>
                          {hasReply ? '답글 수정' : '답글 쓰기'}
                        </div>
                        <textarea
                          value={replyDrafts[r.id] ?? ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          rows={3}
                          placeholder="고객에게 남길 답글을 입력하세요"
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            border: `1px solid ${BORDER}`,
                            borderRadius: 8,
                            padding: 10,
                            fontSize: 13,
                            resize: 'vertical',
                            color: TEXT,
                            outline: 'none',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button
                            type="button"
                            disabled={savingId === r.id}
                            onClick={() => void saveReply(r.id)}
                            style={{
                              border: 'none',
                              background: PURPLE,
                              color: '#fff',
                              borderRadius: 8,
                              padding: '8px 14px',
                              fontSize: 12,
                              cursor: 'pointer',
                              opacity: savingId === r.id ? 0.6 : 1,
                            }}
                          >
                            {savingId === r.id ? '저장 중…' : hasReply ? '수정 저장' : '답글 쓰기'}
                          </button>
                          {hasReply ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(null)
                                setReplyDrafts((prev) => ({ ...prev, [r.id]: r.owner_reply || '' }))
                              }}
                              style={{
                                border: `1px solid ${BORDER}`,
                                background: '#fff',
                                color: SUB,
                                borderRadius: 8,
                                padding: '8px 14px',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              취소
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )
        ) : productReviews.length === 0 ? (
          <div style={{ textAlign: 'center', color: SUB, fontSize: 13, padding: 32 }}>아직 제품 리뷰가 없어요</div>
        ) : (
          productReviews.map((r) => (
            <div
              key={r.id}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: 14,
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  {r.users?.name || '고객'}
                  {r.product_name ? (
                    <span style={{ fontWeight: 400, color: SUB, marginLeft: 6 }}>· {r.product_name}</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>{fmtDate(r.created_at)}</div>
              </div>
              <div style={{ color: GOLD, fontSize: 13, letterSpacing: 1, marginBottom: 6 }}>{stars(r.rating)}</div>
              <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {r.content || '—'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}