'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCart } from '@/context/CartContext'

const CARD_BG = '#0f1a1a'
const CARD_BORDER = 'rgba(60,180,140,0.3)'
const FORM_BG = '#0d1a14'
const TEXT_MAIN = '#a0e8d0'
const TEXT_MUTED = 'rgba(160,232,208,0.65)'

const PHASE_LABELS = ['달빛기', '황금기', '만개기', '물들기', '갱년기', '남성', '전체'] as const

const DEFAULT_CATEGORIES = [
  '반신욕·족욕',
  '아로마케어',
  '입욕제',
  '마사지',
  '체취케어',
  '진정케어',
] as const

export type BodyCareCardRow = {
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
  storage_thumb_url: string | null
  thumb_img: string | null
  is_timesale: boolean | null
  brands: { name: string } | null
}

function phaseTagFromTrackAndDay(hormoneTrack: string, cycleDay: number): string | null {
  const tr = String(hormoneTrack || '')
  if (tr === 'menopause_peri' || tr === 'menopause_post') return '갱년기'
  if (tr === 'male' || tr === 'male_menopause') return '남성'
  if (tr !== 'general') return null
  const cd = Number(cycleDay) || 0
  if (cd >= 1 && cd <= 5) return '달빛기'
  if (cd >= 6 && cd <= 13) return '황금기'
  if (cd >= 14 && cd <= 16) return '만개기'
  if (cd >= 17 && cd <= 28) return '물들기'
  return null
}

function cardMatchesTodayPhase(row: BodyCareCardRow, phase: string | null): boolean {
  const tags = Array.isArray(row.phase_tags) ? row.phase_tags : []
  if (tags.includes('all')) return true
  if (phase && tags.includes(phase)) return true
  return false
}

export function pickTodayCard(
  rows: BodyCareCardRow[],
  hormoneTrack: string,
  cycleDay: number
): BodyCareCardRow | null {
  const phase = phaseTagFromTrackAndDay(hormoneTrack, cycleDay)
  const filtered = rows.filter(r => cardMatchesTodayPhase(r, phase))
  const n = filtered.length
  if (n === 0) return null
  const idx = new Date().getDate() % n
  return filtered[idx] ?? null
}

function productPrice(p: ProductRow): number {
  const sale = p.sale_price != null ? Number(p.sale_price) : null
  const retail = Number(p.retail_price ?? 0)
  if (sale != null && !Number.isNaN(sale) && sale > 0) return sale
  return retail
}

function thumbUrl(p: Pick<ProductRow, 'storage_thumb_url' | 'thumb_img'>): string {
  return p.storage_thumb_url || p.thumb_img || ''
}

type BodyCareCardV2Props = {
  hormoneTrack: string
  cycleDay: number
  showEditChrome: boolean
  supabaseClient: SupabaseClient
}

type FormState = {
  phase_tags: string[]
  category_tags: string[]
  title: string
  care: string
  quote: string
  product_ids: string[]
}

function emptyForm(): FormState {
  return {
    phase_tags: [],
    category_tags: [],
    title: '',
    care: '',
    quote: '',
    product_ids: [],
  }
}

function rowToForm(row: BodyCareCardRow): FormState {
  return {
    phase_tags: Array.isArray(row.phase_tags) ? [...row.phase_tags] : [],
    category_tags: Array.isArray(row.category_tags) ? [...row.category_tags] : [],
    title: row.title ?? '',
    care: row.care ?? '',
    quote: row.quote ?? '',
    product_ids: Array.isArray(row.product_ids) ? row.product_ids.filter(Boolean) : [],
  }
}

export default function BodyCareCardV2({
  hormoneTrack,
  cycleDay,
  showEditChrome,
  supabaseClient,
}: BodyCareCardV2Props) {
  const router = useRouter()
  const cart = useCart()

  const [rows, setRows] = useState<BodyCareCardRow[]>([])
  const [cardsLoaded, setCardsLoaded] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetCard, setSheetCard] = useState<BodyCareCardRow | null>(null)
  const [sheetProducts, setSheetProducts] = useState<ProductRow[]>([])
  const [sheetProductsLoading, setSheetProductsLoading] = useState(false)

  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formProductMeta, setFormProductMeta] = useState<Record<string, { name: string; thumb: string }>>({})
  const [customCatInput, setCustomCatInput] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ProductRow[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchCards = useCallback(async () => {
    const { data, error } = await supabaseClient
      .from('body_care_cards')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    if (!error && data) setRows(data as BodyCareCardRow[])
  }, [supabaseClient])

  useEffect(() => {
    let cancelled = false
    setCardsLoaded(false)
    void (async () => {
      await fetchCards()
      if (!cancelled) setCardsLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchCards])

  const todayCard = useMemo(
    () => (cardsLoaded ? pickTodayCard(rows, hormoneTrack, cycleDay) : null),
    [cardsLoaded, rows, hormoneTrack, cycleDay]
  )

  useEffect(() => {
    if (!sheetOpen || !sheetCard) {
      setSheetProducts([])
      return
    }
    const ids = (sheetCard.product_ids || []).filter(Boolean)
    if (ids.length === 0) {
      setSheetProducts([])
      return
    }
    let cancelled = false
    setSheetProductsLoading(true)
    void (async () => {
      const { data } = await supabaseClient
        .from('products')
        .select('id, name, retail_price, sale_price, storage_thumb_url, thumb_img, is_timesale, brands(name)')
        .in('id', ids)
        .eq('is_active', true)
      if (cancelled) return
      setSheetProducts((data as ProductRow[]) || [])
      setSheetProductsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [sheetOpen, sheetCard, supabaseClient])

  useEffect(() => {
    const q = productSearch.trim()
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        setSearchLoading(true)
        const { data } = await supabaseClient
          .from('products')
          .select('id, name, retail_price, sale_price, storage_thumb_url, thumb_img, is_timesale, brands(name)')
          .ilike('name', `%${q.slice(0, 80)}%`)
          .eq('is_active', true)
          .limit(15)
        if (cancelled) return
        setSearchResults((data as ProductRow[]) || [])
        setSearchLoading(false)
      })()
    }, 320)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [productSearch, supabaseClient])

  const openSheet = (row: BodyCareCardRow) => {
    setSheetCard(row)
    setSheetOpen(true)
  }

  const addToCart = (p: ProductRow) => {
    const price = productPrice(p)
    const thumb = thumbUrl(p) || ''
    const brand = (p.brands as { name?: string } | null)?.name ?? ''
    cart.addItem({
      product_id: p.id,
      name: p.name,
      price,
      thumb_img: thumb || null,
      brand_name: brand,
      quantity: 1,
    })
  }

  const buyProduct = (id: string) => {
    router.push(`/products/${id}`)
  }

  const startEdit = (row: BodyCareCardRow) => {
    const f = rowToForm(row)
    setEditingId(row.id)
    setForm(f)
    setFormProductMeta({})
    void loadMetaForIds(f.product_ids)
    setProductSearch('')
    setSearchResults([])
  }

  const loadMetaForIds = async (ids: string[]) => {
    if (ids.length === 0) return
    const { data } = await supabaseClient
      .from('products')
      .select('id,name,storage_thumb_url,thumb_img')
      .in('id', ids)
    const m: Record<string, { name: string; thumb: string }> = {}
    for (const r of data || []) {
      const pr = r as ProductRow
      m[pr.id] = { name: pr.name, thumb: thumbUrl(pr) }
    }
    setFormProductMeta(m)
  }

  const startNew = () => {
    setEditingId('new')
    setForm(emptyForm())
    setFormProductMeta({})
    setProductSearch('')
    setSearchResults([])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm())
    setFormProductMeta({})
    setProductSearch('')
    setSearchResults([])
  }

  const togglePhase = (label: string) => {
    setForm(prev => {
      if (label === '전체') {
        const hasAll = prev.phase_tags.includes('all')
        return {
          ...prev,
          phase_tags: hasAll ? [] : ['all'],
        }
      }
      let next = prev.phase_tags.filter(t => t !== 'all')
      if (next.includes(label)) next = next.filter(t => t !== label)
      else next = [...next, label]
      return { ...prev, phase_tags: next }
    })
  }

  const toggleCategory = (c: string) => {
    setForm(prev => {
      const has = prev.category_tags.includes(c)
      return {
        ...prev,
        category_tags: has ? prev.category_tags.filter(x => x !== c) : [...prev.category_tags, c],
      }
    })
  }

  const addCustomCategory = () => {
    const s = customCatInput.trim()
    if (!s) return
    setForm(prev =>
      prev.category_tags.includes(s) ? prev : { ...prev, category_tags: [...prev.category_tags, s] }
    )
    setCustomCatInput('')
  }

  const addProductFromSearch = (p: ProductRow) => {
    if (form.product_ids.includes(p.id)) return
    setForm(prev => ({ ...prev, product_ids: [...prev.product_ids, p.id] }))
    setFormProductMeta(prev => ({
      ...prev,
      [p.id]: { name: p.name, thumb: thumbUrl(p) },
    }))
  }

  const removeProductId = (id: string) => {
    setForm(prev => ({ ...prev, product_ids: prev.product_ids.filter(x => x !== id) }))
    setFormProductMeta(prev => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }

  const saveForm = async () => {
    setSaving(true)
    try {
      const payload = {
        phase_tags: form.phase_tags,
        category_tags: form.category_tags,
        title: form.title,
        care: form.care,
        quote: form.quote,
        product_ids: form.product_ids,
        updated_at: new Date().toISOString(),
      }
      if (editingId === 'new') {
        const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)
        const { error } = await supabaseClient.from('body_care_cards').insert({
          ...payload,
          sort_order: maxSort + 1,
          is_active: true,
        } as any)
        if (error) throw error
      } else if (editingId) {
        const { error } = await supabaseClient.from('body_care_cards').update(payload).eq('id', editingId)
        if (error) throw error
      }
      await fetchCards()
      cancelEdit()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (id: string) => {
    if (!window.confirm('이 카드를 삭제할까요?')) return
    const { error } = await supabaseClient.from('body_care_cards').delete().eq('id', id)
    if (error) return
    if (sheetCard?.id === id) {
      setSheetOpen(false)
      setSheetCard(null)
    }
    await fetchCards()
    if (editingId === id) cancelEdit()
  }

  if (!cardsLoaded) {
    return (
      <div
        style={{
          marginTop: 10,
          padding: 14,
          borderRadius: 14,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          color: TEXT_MUTED,
          fontSize: 12,
        }}
      >
        불러오는 중…
      </div>
    )
  }

  if (!showEditChrome && rows.length === 0) return null

  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 8,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {rows.map(row => {
          const isToday = todayCard?.id === row.id
          return (
            <div
              key={row.id}
              style={{
                position: 'relative',
                flexShrink: 0,
                width: 148,
                minHeight: 96,
                padding: '10px 10px 8px',
                borderRadius: 12,
                background: CARD_BG,
                border: showEditChrome ? '1px dashed rgba(60,200,160,0.45)' : `1px solid ${CARD_BORDER}`,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              onClick={() => {
                if (showEditChrome) return
                openSheet(row)
              }}
              role="presentation"
            >
              {isToday ? (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 0 2px rgba(34,197,94,0.35)',
                  }}
                  title="오늘 노출"
                />
              ) : null}
              {showEditChrome ? (
                <div
                  style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: `1px solid ${CARD_BORDER}`,
                      background: 'rgba(60,180,140,0.15)',
                      color: TEXT_MAIN,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRow(row.id)}
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(220,80,80,0.4)',
                      background: 'rgba(220,80,80,0.12)',
                      color: '#f0a0a0',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => openSheet(row)}
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: `1px solid ${CARD_BORDER}`,
                      background: 'transparent',
                      color: TEXT_MUTED,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    보기
                  </button>
                </div>
              ) : null}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: TEXT_MAIN,
                  lineHeight: 1.35,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {row.title || '(제목 없음)'}
              </div>
            </div>
          )
        })}
        {showEditChrome ? (
          <button
            type="button"
            onClick={startNew}
            style={{
              flexShrink: 0,
              width: 148,
              minHeight: 96,
              borderRadius: 12,
              border: `1px dashed rgba(60,180,140,0.45)`,
              background: 'rgba(60,180,140,0.06)',
              color: TEXT_MUTED,
              fontSize: 28,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="새 카드"
          >
            +
          </button>
        ) : null}
      </div>

      {showEditChrome && editingId ? (
        <div
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 12,
            background: FORM_BG,
            border: `1px solid ${CARD_BORDER}`,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MAIN, marginBottom: 10 }}>
            {editingId === 'new' ? '새 바디케어 카드' : '카드 수정'}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>호르몬 단계 (복수)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PHASE_LABELS.map(ph => {
                const active =
                  ph === '전체'
                    ? form.phase_tags.includes('all')
                    : form.phase_tags.includes(ph)
                return (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => togglePhase(ph)}
                    style={{
                      fontSize: 11,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: active ? '1px solid rgba(60,220,170,0.6)' : `1px solid ${CARD_BORDER}`,
                      background: active ? 'rgba(60,180,140,0.2)' : 'transparent',
                      color: TEXT_MAIN,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {ph}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>카테고리 (복수)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {DEFAULT_CATEGORIES.map(c => {
                const active = form.category_tags.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    style={{
                      fontSize: 11,
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: active ? '1px solid rgba(60,220,170,0.6)' : `1px solid ${CARD_BORDER}`,
                      background: active ? 'rgba(60,180,140,0.2)' : 'transparent',
                      color: TEXT_MAIN,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={customCatInput}
                onChange={e => setCustomCatInput(e.target.value)}
                placeholder="카테고리 직접 입력"
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: CARD_BG,
                  color: TEXT_MAIN,
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="button"
                onClick={addCustomCategory}
                style={{
                  fontSize: 11,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: `1px solid ${CARD_BORDER}`,
                  background: 'rgba(60,180,140,0.15)',
                  color: TEXT_MAIN,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                추가
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>제목</div>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG,
                color: TEXT_MAIN,
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>케어방법</div>
            <textarea
              value={form.care}
              onChange={e => setForm(f => ({ ...f, care: e.target.value }))}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG,
                color: TEXT_MAIN,
                fontSize: 12,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>오랜한마디</div>
            <textarea
              value={form.quote}
              onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
              rows={3}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG,
                color: TEXT_MAIN,
                fontSize: 12,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4 }}>제품 검색 (2글자 이상)</div>
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="제품명"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${CARD_BORDER}`,
                background: CARD_BG,
                color: TEXT_MAIN,
                fontSize: 12,
                fontFamily: 'inherit',
                marginBottom: 8,
              }}
            />
            {searchLoading ? <div style={{ fontSize: 10, color: TEXT_MUTED }}>검색 중…</div> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {searchResults.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 6,
                    borderRadius: 8,
                    border: `1px solid rgba(60,180,140,0.2)`,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'rgba(60,180,140,0.1)',
                    }}
                  >
                    {thumbUrl(p) ? (
                      <img src={thumbUrl(p)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>🧴</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: TEXT_MAIN, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: TEXT_MUTED }}>{productPrice(p).toLocaleString()}원</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => addProductFromSearch(p)}
                    disabled={form.product_ids.includes(p.id)}
                    style={{
                      fontSize: 10,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: `1px solid ${CARD_BORDER}`,
                      background: form.product_ids.includes(p.id) ? 'rgba(60,180,140,0.05)' : 'rgba(60,180,140,0.2)',
                      color: TEXT_MAIN,
                      cursor: form.product_ids.includes(p.id) ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {form.product_ids.includes(p.id) ? '추가됨' : '+ 추가'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 6 }}>선택된 제품</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {form.product_ids.map(pid => (
                <span
                  key={pid}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: 'rgba(60,180,140,0.15)',
                    border: `1px solid ${CARD_BORDER}`,
                    fontSize: 10,
                    color: TEXT_MAIN,
                  }}
                >
                  {formProductMeta[pid]?.name || pid.slice(0, 8)}
                  <button
                    type="button"
                    onClick={() => removeProductId(pid)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: TEXT_MUTED,
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 12,
                      lineHeight: 1,
                      fontFamily: 'inherit',
                    }}
                    aria-label="제거"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveForm()}
              style={{
                fontSize: 12,
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(60,220,170,0.5)',
                background: 'rgba(60,180,140,0.25)',
                color: TEXT_MAIN,
                cursor: saving ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              style={{
                fontSize: 12,
                padding: '10px 16px',
                borderRadius: 10,
                border: `1px solid ${CARD_BORDER}`,
                background: 'transparent',
                color: TEXT_MUTED,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {sheetOpen && sheetCard ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setSheetOpen(false)
          }}
          role="presentation"
        >
          <div
            style={{
              background: CARD_BG,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              border: `1px solid ${CARD_BORDER}`,
              maxHeight: '88vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              style={{
                padding: '12px 14px',
                borderBottom: `1px solid ${CARD_BORDER}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN }}>{sheetCard.title || '바디케어'}</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{
                  border: `1px solid ${CARD_BORDER}`,
                  background: 'rgba(60,180,140,0.12)',
                  color: TEXT_MAIN,
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: 'pointer',
                  fontSize: 18,
                  lineHeight: 1,
                  fontFamily: 'inherit',
                }}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '12px 14px 24px', flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MAIN, marginBottom: 6 }}>케어방법</div>
              <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
                {sheetCard.care}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MAIN, marginBottom: 6 }}>오랜한마디</div>
              <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
                {sheetCard.quote}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: TEXT_MAIN, marginBottom: 8 }}>추천 제품</div>
              {sheetProductsLoading ? (
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>불러오는 중…</div>
              ) : sheetProducts.length === 0 ? (
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>연결된 제품이 없어요</div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    overflowX: 'auto',
                    paddingBottom: 8,
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {sheetProducts.map(p => (
                    <div
                      key={p.id}
                      style={{
                        flexShrink: 0,
                        width: 120,
                        borderRadius: 12,
                        border: `1px solid ${CARD_BORDER}`,
                        overflow: 'hidden',
                        background: 'rgba(60,180,140,0.06)',
                      }}
                    >
                      <div style={{ width: '100%', height: 100, background: '#111' }}>
                        {thumbUrl(p) ? (
                          <img src={thumbUrl(p)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 28 }}>🧴</div>
                        )}
                      </div>
                      <div style={{ padding: 8 }}>
                        <div style={{ fontSize: 10, color: TEXT_MAIN, fontWeight: 500, lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 8 }}>
                          {productPrice(p).toLocaleString()}원
                          {p.is_timesale ? ' · 타임세일' : ''}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => addToCart(p)}
                            style={{
                              width: '100%',
                              fontSize: 10,
                              padding: '6px 0',
                              borderRadius: 8,
                              border: `1px solid ${CARD_BORDER}`,
                              background: 'rgba(60,180,140,0.2)',
                              color: TEXT_MAIN,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            담기
                          </button>
                          <button
                            type="button"
                            onClick={() => buyProduct(p.id)}
                            style={{
                              width: '100%',
                              fontSize: 10,
                              padding: '6px 0',
                              borderRadius: 8,
                              border: '1px solid rgba(60,220,170,0.45)',
                              background: 'rgba(60,180,140,0.08)',
                              color: TEXT_MAIN,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            구매
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
