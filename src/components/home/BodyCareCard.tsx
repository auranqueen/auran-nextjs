'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type BodyCareCardRow = {
  id: string
  phase_tags: string[] | null
  category_tags: string[] | null
  title: string
  care: string
  quote: string
  product_ids: string[] | null
  sort_order: number
  is_active: boolean
}

type ProductRow = {
  id: string
  name: string
  retail_price: number | null
  sale_price: number | null
  is_groupbuy: boolean | null
  thumb_img: string | null
}

type Props = {
  currentPhase: string
  skinType: string
  skinConcerns: string[]
  recommended?: any[]
  showEditChrome: boolean
  supabaseClient: SupabaseClient
}

type Zone = 'face' | 'body' | 'scalp' | 'inner'

const TABS: { key: Zone; label: string }[] = [
  { key: 'face', label: '💆 페이스' },
  { key: 'body', label: '🧴 바디' },
]

const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = 'rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(232,223,245,0.5)'
const PURPLE = '#7B5EA7'

function pickPrice(p: ProductRow): number {
  const sale = Number(p.sale_price ?? 0)
  if (!Number.isNaN(sale) && sale > 0) return sale
  return Number(p.retail_price ?? 0)
}

function categoryMatch(row: BodyCareCardRow, tab: Zone): boolean {
  const tags = Array.isArray(row.category_tags) ? row.category_tags : []
  const hasKnownZone =
    tags.includes('face') || tags.includes('body') || tags.includes('scalp') || tags.includes('inner') ||
    tags.includes('_zone:face') || tags.includes('_zone:body') || tags.includes('_zone:scalp') || tags.includes('_zone:inner')
  if (!hasKnownZone) return tab === 'face'
  return tags.includes(tab) || tags.includes(`_zone:${tab}`)
}

export default function BodyCareCard({
  currentPhase,
  skinType: _skinType,
  skinConcerns: _skinConcerns,
  recommended,
  showEditChrome,
  supabaseClient,
}: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<BodyCareCardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Zone>('face')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [editing, setEditing] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({
    id: '',
    title: '',
    care: '',
    quote: '',
    product_ids: [] as string[],
  })
  const [pq, setPq] = useState('')
  const [picks, setPicks] = useState<ProductRow[]>([])
  const [closed, setClosed] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const phaseToken = currentPhase || 'all'
    const { data } = await supabaseClient
      .from('body_care_cards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    const filtered = ((data as any[]) || []).filter((row) => {
      const raw = row.phase_tags
      const tags: string[] = Array.isArray(raw) ? raw : []
      return tags.includes(phaseToken) || tags.includes('all')
    })
    setRows(filtered as BodyCareCardRow[])
    setLoading(false)
  }, [supabaseClient, currentPhase])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const tabRows = useMemo(
    () => rows.filter((r) => categoryMatch(r, tab)),
    [rows, tab]
  )

  const todayCard = useMemo(() => {
    const withProducts = tabRows.filter((r) => r.product_ids && r.product_ids.length > 0)
    if (withProducts.length === 0) return null
    const idx = new Date().getDate() % withProducts.length
    return withProducts[idx] ?? null
  }, [tabRows])

  useEffect(() => {
    const ids = (todayCard?.product_ids || []).filter(Boolean)
    if (ids.length === 0) {
      setProducts([])
      return
    }
    void supabaseClient
      .from('products')
      .select('id,name,retail_price,sale_price,is_groupbuy,thumb_img')
      .in('id', ids)
      .then(({ data }) => setProducts((data as ProductRow[]) || []))
  }, [todayCard, supabaseClient])

  useEffect(() => {
    const q = pq.trim()
    if (!editing || q.length < 1) {
      setPicks([])
      return
    }
    const t = setTimeout(() => {
      void supabaseClient
        .from('products')
        .select('id,name,retail_price,sale_price,is_groupbuy,thumb_img')
        .ilike('name', `%${q.slice(0, 80)}%`)
        .eq('is_active', true)
        .limit(12)
        .then(({ data }) => setPicks((data as ProductRow[]) || []))
    }, 220)
    return () => clearTimeout(t)
  }, [pq, editing, supabaseClient])

  const startEdit = () => {
    if (!todayCard) return
    setEditing(true)
    setIsNew(false)
    setDraft({
      id: todayCard.id,
      title: todayCard.title || '',
      care: todayCard.care || '',
      quote: todayCard.quote || '',
      product_ids: Array.isArray(todayCard.product_ids) ? todayCard.product_ids.filter(Boolean) : [],
    })
  }

  const startNew = () => {
    setEditing(true)
    setIsNew(true)
    setDraft({ id: '', title: '', care: '', quote: '', product_ids: [] })
  }

  const save = async () => {
    setSaving(true)
    try {
      if (isNew) {
        const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order || 0), 0)
        await supabaseClient.from('body_care_cards').insert({
          title: draft.title,
          care: draft.care,
          quote: draft.quote,
          product_ids: draft.product_ids,
          phase_tags: [currentPhase || 'all'],
          category_tags: [`_zone:${tab}`],
          sort_order: maxSort + 1,
          is_active: true,
        } as any)
      } else if (draft.id) {
        await supabaseClient
          .from('body_care_cards')
          .update({
            title: draft.title,
            care: draft.care,
            quote: draft.quote,
            product_ids: draft.product_ids,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', draft.id)
      }
      setEditing(false)
      setPq('')
      setPicks([])
      await fetchRows()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!draft.id) return
    await supabaseClient.from('body_care_cards').delete().eq('id', draft.id)
    setEditing(false)
    setPq('')
    setPicks([])
    await fetchRows()
  }

  const addToCart = async (id: string) => {
    const { data } = await supabaseClient.auth.getUser()
    const user = data.user
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const { data: u } = await supabaseClient.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (!u?.id) return
    await supabaseClient.from('cart_items').insert({ user_id: u.id, product_id: id, quantity: 1 } as any)
  }

  if (loading) return <div style={{ marginTop: 10, fontSize: 12, color: TEXT_MUTED }}>불러오는 중...</div>

  if (!todayCard) {
    const filteredRecommended = (recommended ?? []).filter((p: any) => {
      const ct: string[] = p.category_tags ?? []
      return ct.includes(tab) || ct.some((t: string) => t.startsWith('_zone:' + tab))
    })
    const visibleRecommended = (filteredRecommended.length > 0 ? filteredRecommended : (recommended ?? [])).slice(0, 6)
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key)
                setClosed(false)
              }}
              style={{
                fontSize: 12,
                padding: '4px 12px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                background: tab === t.key ? '#7B5EA7' : 'rgba(255,255,255,0.08)',
                color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '32px 16px', gap: 12, textAlign: 'center'
        }}>
          <span style={{ fontSize: 32 }}>🌿</span>
          <span style={{ fontSize: 14, color: '#7B5EA7', fontWeight: undefined }}>
            아직 케어 카드가 없어요
          </span>
          <span style={{ fontSize: 12, color: '#aaa' }}>
            원장님이 곧 맞춤 케어를 준비해드릴게요
          </span>
        </div>
        {Array.isArray(recommended) && recommended.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, paddingLeft: 4 }}>
              점수 기반 추천 제품
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="scroll-hide">
              {visibleRecommended.map((p: any) => (
                <div key={p.id} style={{
                  minWidth: 100, borderRadius: 10, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)', flexShrink: 0
                }}>
                  {p.thumb_img && (
                    <img src={p.thumb_img} alt={p.name} style={{ width: 100, height: 100, objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.3 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#7B5EA7', marginTop: 2 }}>
                      {p.sale_price?.toLocaleString()}원
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  const finalProducts = products.length > 0 ? products : (recommended ?? []).slice(0, 6)
  if (closed) return null
  return (
    <div style={{ marginTop: 10, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, background: CARD_BG, padding: 12, position: 'relative' }}>
      <button
        type="button"
        onClick={() => setClosed(true)}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 16,
          cursor: 'pointer',
          lineHeight: 1,
          zIndex: 10,
        }}
      >
        ×
      </button>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key)
              setClosed(false)
            }}
            style={{
              border: tab === t.key ? '1px solid rgba(123,94,167,0.45)' : '1px solid rgba(255,255,255,0.12)',
              background: tab === t.key ? 'rgba(123,94,167,0.15)' : 'rgba(255,255,255,0.03)',
              color: tab === t.key ? '#d8c7ef' : 'rgba(255,255,255,0.75)',
              borderRadius: 16,
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 400,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!editing ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 7 }}>{todayCard.title}</div>
          <div style={{ fontSize: 11, fontWeight: 400, color: TEXT_MUTED, marginBottom: 8, lineHeight: 1.55 }}>{todayCard.care}</div>
          <div style={{ borderLeft: `2px solid ${PURPLE}`, paddingLeft: 8, fontSize: 11, color: '#d6c7ea', marginBottom: 10, lineHeight: 1.5, fontWeight: 400 }}>{todayCard.quote}</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {products.length === 0 && (!recommended || recommended.length === 0) ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '24px 16px', gap: 8, textAlign: 'center'
              }}>
                <span style={{ fontSize: 28 }}>🛍️</span>
                <span style={{ fontSize: 13, color: '#aaa' }}>
                  연결된 제품이 없어요
                </span>
              </div>
            ) : products.length > 0 ? (
              finalProducts.map((p) => (
                <div key={p.id} style={{ minWidth: 170, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 8, display: 'flex', gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flexShrink: 0 }}>
                    {p.thumb_img ? <img src={p.thumb_img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 400 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#e4d7f4', marginTop: 2, fontWeight: 500 }}>{pickPrice(p).toLocaleString()}원</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button type="button" onClick={() => { void addToCart(p.id) }} style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 400, padding: '4px 6px', cursor: 'pointer' }}>담기</button>
                      <button type="button" onClick={() => router.push(`/products/${p.id}`)} style={{ borderRadius: 6, border: 'none', background: 'rgba(123,94,167,0.25)', color: '#e7dcf5', fontSize: 10, fontWeight: 500, padding: '4px 6px', cursor: 'pointer' }}>구매</button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, paddingLeft: 4 }}>
                  점수 기반 추천 제품
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="scroll-hide">
                  {(() => {
                    const filteredRecommended = (recommended ?? []).filter((p: any) => {
                      const ct: string[] = p.category_tags ?? []
                      return ct.includes(tab) || ct.some((t: string) => t.startsWith('_zone:' + tab))
                    })
                    const visibleRecommended = (filteredRecommended.length > 0 ? filteredRecommended : (recommended ?? [])).slice(0, 6)
                    return visibleRecommended.map((p: any) => (
                      <div key={p.id} style={{
                        minWidth: 100, borderRadius: 10, overflow: 'hidden',
                        background: 'rgba(255,255,255,0.04)', flexShrink: 0
                      }}>
                        {p.thumb_img && (
                          <img src={p.thumb_img} alt={p.name} style={{ width: 100, height: 100, objectFit: 'cover' }} />
                        )}
                        <div style={{ padding: '6px 8px' }}>
                          <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.3 }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#7B5EA7', marginTop: 2 }}>
                            {p.sale_price?.toLocaleString()}원
                          </div>
                        </div>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="제목" style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 400, padding: '9px 10px' }} />
          <textarea value={draft.care} onChange={(e) => setDraft((d) => ({ ...d, care: e.target.value }))} placeholder="케어 방법" rows={3} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 400, padding: '9px 10px' }} />
          <textarea value={draft.quote} onChange={(e) => setDraft((d) => ({ ...d, quote: e.target.value }))} placeholder="오랜 한마디" rows={2} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 400, padding: '9px 10px' }} />
          <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="제품 검색" style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 400, padding: '9px 10px' }} />
          {picks.length > 0 ? (
            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, maxHeight: 130, overflowY: 'auto' }}>
              {picks.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraft((d) => d.product_ids.includes(p.id) ? d : ({ ...d, product_ids: [...d.product_ids, p.id] }))}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#fff', fontSize: 11, fontWeight: 400, padding: '7px 9px', cursor: 'pointer' }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {draft.product_ids.map((id) => (
              <span key={id} style={{ fontSize: 10, borderRadius: 14, border: '1px solid rgba(123,94,167,0.35)', background: 'rgba(123,94,167,0.16)', color: '#ddcff1', padding: '4px 8px', fontWeight: 400 }}>
                {id.slice(0, 8)}
                <button type="button" onClick={() => setDraft((d) => ({ ...d, product_ids: d.product_ids.filter((x) => x !== id) }))} style={{ marginLeft: 5, background: 'none', border: 'none', color: 'rgba(255,255,255,0.65)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {showEditChrome ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!editing ? (
            <>
              <button type="button" onClick={startEdit} style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 400, padding: '7px 10px', cursor: 'pointer' }}>수정</button>
              <button type="button" onClick={startNew} style={{ borderRadius: 8, border: '1px solid rgba(123,94,167,0.4)', background: 'rgba(123,94,167,0.15)', color: '#d9cbef', fontSize: 11, fontWeight: 500, padding: '7px 10px', cursor: 'pointer' }}>추가</button>
              <button type="button" onClick={() => { if (todayCard?.id) { setDraft((d) => ({ ...d, id: todayCard.id })); void remove() } }} style={{ borderRadius: 8, border: '1px solid rgba(229,57,53,0.35)', background: 'rgba(229,57,53,0.12)', color: '#ffb4aa', fontSize: 11, fontWeight: 400, padding: '7px 10px', cursor: 'pointer' }}>삭제</button>
            </>
          ) : (
            <>
              <button type="button" disabled={saving} onClick={() => { void save() }} style={{ borderRadius: 8, border: 'none', background: 'rgba(123,94,167,0.28)', color: '#fff', fontSize: 11, fontWeight: 500, padding: '7px 12px', cursor: saving ? 'wait' : 'pointer' }}>{saving ? '저장중' : '저장'}</button>
              {!isNew ? <button type="button" onClick={() => { void remove() }} style={{ borderRadius: 8, border: '1px solid rgba(229,57,53,0.35)', background: 'rgba(229,57,53,0.12)', color: '#ffb4aa', fontSize: 11, fontWeight: 400, padding: '7px 10px', cursor: 'pointer' }}>삭제</button> : null}
              <button type="button" onClick={() => { setEditing(false); setPq(''); setPicks([]) }} style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 400, padding: '7px 10px', cursor: 'pointer' }}>취소</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
