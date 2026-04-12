'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const CARD_BG = '#1e1e26'
const BADGE_STEP_BG = '#1e1830'
const BADGE_STEP_FG = '#7b6cc0'
const BADGE_FUNC_BG = '#1a2818'
const BADGE_FUNC_FG = '#5adb8a'
const FORM_BG = '#1a1a24'

const STEP_CHIPS = ['전체', '클렌징', '토너', '앰플·세럼', '크림', '선크림'] as const
const FUNC_CHIPS = ['전체', '미백', '탄력', '수분', '진정', '장벽'] as const

const STEP_OPTIONS = ['클렌징', '토너', '앰플·세럼', '크림', '선크림', '기타'] as const
const FUNC_OPTIONS = ['미백', '탄력', '수분', '진정', '장벽', '기타'] as const

type ProductLite = {
  id: string
  name: string
  retail_price?: number | null
  sale_price?: number | null
  storage_thumb_url?: string | null
  thumb_img?: string | null
  tag?: string | null
  skin_types?: string[] | null
  sales_count?: number | null
  avg_rating?: number | null
  step_tags?: string[] | null
  func_tags?: string[] | null
}

type MappingRow = {
  id: string
  month: number
  product_id: string
  concern_tag?: string | null
  step_tag?: string | null
  func_tag?: string | null
  priority: number
  is_active: boolean
  products: ProductLite | null
}

export type SeasonRecommendSectionProps = {
  month: number
  showEditChrome: boolean
  supabaseClient: SupabaseClient
}

function displayPrice(p: ProductLite): number {
  const sale = p.sale_price != null ? Number(p.sale_price) : null
  const retail = Number(p.retail_price ?? 0)
  if (sale != null && !Number.isNaN(sale) && sale > 0) return sale
  return retail
}

function stepMatchesTag(step: string, tagLower: string): boolean {
  if (step === '앰플·세럼') return tagLower.includes('앰플') || tagLower.includes('세럼')
  return tagLower.includes(step.toLowerCase())
}

function funcMatchesTag(func: string, tagLower: string): boolean {
  return tagLower.includes(func.toLowerCase())
}

function rowMatchesFilters(
  row: MappingRow,
  stepF: string,
  funcF: string,
  isAuto: boolean
): boolean {
  const p = row.products
  if (!p) return false
  if (isAuto) {
    const prod = p as any
    const stepTags = prod?.step_tags || []
    const funcTags = prod?.func_tags || []

    if (stepF !== '전체') {
      const stepMap: Record<string, string> = {
        클렌징: '클렌징',
        토너: '토너',
        '앰플·세럼': '앰플·세럼',
        크림: '크림',
        선크림: '선케어',
      }
      const matched = stepTags.some(
        (t: string) =>
          t === stepF ||
          t === stepMap[stepF]
      )
      if (!matched) return false
    }

    if (funcF !== '전체') {
      const funcMap: Record<string, string> = {
        미백: '미백·톤업',
        탄력: '탄력·주름',
        수분: '보습·수분',
        진정: '진정·민감',
        장벽: '장벽·재생',
      }
      const matched = funcTags.some(
        (t: string) =>
          t === funcF ||
          t === funcMap[funcF]
      )
      if (!matched) return false
    }

    return true
  }
  const st = String(row.step_tag || '').trim()
  const ft = String(row.func_tag || '').trim()
  if (stepF !== '전체' && st !== stepF) return false
  if (funcF !== '전체' && ft !== funcF) return false
  return true
}

export default function SeasonRecommendSection({ month, showEditChrome, supabaseClient }: SeasonRecommendSectionProps) {
  const router = useRouter()
  const [rows, setRows] = useState<MappingRow[]>([])
  const [isAuto, setIsAuto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stepFilter, setStepFilter] = useState<string>('전체')
  const [funcFilter, setFuncFilter] = useState<string>('전체')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<ProductLite[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [pickProduct, setPickProduct] = useState<ProductLite | null>(null)
  const [formStep, setFormStep] = useState<string>(STEP_OPTIONS[0])
  const [formFunc, setFormFunc] = useState<string>(FUNC_OPTIONS[0])
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseClient
        .from('season_product_mapping')
        .select('*, products(*)')
        .eq('month', month)
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(10)

      if (!error && data && data.length > 0) {
        setIsAuto(false)
        setRows(data as MappingRow[])
        return
      }

      const sel =
        'id, name, retail_price, sale_price, storage_thumb_url, thumb_img, tag, skin_types, sales_count, avg_rating, step_tags, func_tags'
      const fb = await supabaseClient
        .from('products')
        .select(sel)
        .eq('is_active', true)
        .eq('status', 'active')
        .order('sales_count', { ascending: false })
        .limit(8)

      if (fb.error || !fb.data?.length) {
        setIsAuto(false)
        setRows([])
        return
      }

      setIsAuto(true)
      const synthetic: MappingRow[] = (fb.data as ProductLite[]).map((p, i) => ({
        id: `auto-${p.id}`,
        month,
        product_id: p.id,
        concern_tag: null,
        step_tag: '',
        func_tag: '',
        priority: i,
        is_active: true,
        products: {
          ...p,
          step_tags: p.step_tags ?? [],
          func_tags: p.func_tags ?? [],
        },
      }))
      setRows(synthetic)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    const q = searchQ.trim()
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
          .select('id, name, retail_price, sale_price, storage_thumb_url, thumb_img, tag')
          .ilike('name', `%${q.slice(0, 80)}%`)
          .eq('is_active', true)
          .limit(15)
        if (!cancelled) {
          setSearchResults((data as ProductLite[]) || [])
          setSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [searchQ, supabaseClient])

  const filtered = useMemo(() => {
    return rows.filter(r => rowMatchesFilters(r, stepFilter, funcFilter, isAuto))
  }, [rows, stepFilter, funcFilter, isAuto])

  const openAdd = () => {
    setEditingId(null)
    setPickProduct(null)
    setFormStep(STEP_OPTIONS[0])
    setFormFunc(FUNC_OPTIONS[0])
    setSearchQ('')
    setSearchResults([])
    setFormOpen(true)
  }

  const openEdit = (row: MappingRow) => {
    if (row.id.startsWith('auto-')) return
    setEditingId(row.id)
    setPickProduct(row.products)
    const st = String(row.step_tag || '').trim()
    const ft = String(row.func_tag || '').trim()
    setFormStep((STEP_OPTIONS as readonly string[]).includes(st) ? st : STEP_OPTIONS[0])
    setFormFunc((FUNC_OPTIONS as readonly string[]).includes(ft) ? ft : FUNC_OPTIONS[0])
    setSearchQ('')
    setSearchResults([])
    setFormOpen(true)
  }

  const maxPriority = useMemo(() => {
    const real = rows.filter(r => !r.id.startsWith('auto-'))
    if (real.length === 0) return 0
    return Math.max(...real.map(r => r.priority ?? 0))
  }, [rows])

  const saveMapping = async () => {
    if (!pickProduct) return
    const st = formStep.trim()
    const ft = formFunc.trim()
    const concern = `${st} ${ft}`.trim()
    setSaving(true)
    try {
      if (editingId) {
        const { error } = await supabaseClient
          .from('season_product_mapping')
          .update({
            product_id: pickProduct.id,
            step_tag: st,
            func_tag: ft,
            concern_tag: concern,
          })
          .eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabaseClient.from('season_product_mapping').insert({
          month,
          product_id: pickProduct.id,
          step_tag: st,
          func_tag: ft,
          priority: maxPriority + 1,
          is_active: true,
          concern_tag: concern,
          score_range_min: 0,
          score_range_max: 100,
        } as any)
        if (error) throw error
      }
      setFormOpen(false)
      await fetchData()
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (row: MappingRow) => {
    if (row.id.startsWith('auto-')) return
    if (!confirm('이 매핑을 삭제할까요?')) return
    const { error } = await supabaseClient.from('season_product_mapping').delete().eq('id', row.id)
    if (error) return
    await fetchData()
  }

  const chipScroll = (children: React.ReactNode) => (
    <div
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 6,
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {children}
    </div>
  )

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>이달의 시즌 추천</div>
        {showEditChrome ? (
          <button
            type="button"
            onClick={openAdd}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 8,
              border: '1px dashed rgba(123,108,192,0.55)',
              background: 'rgba(30,24,48,0.4)',
              color: '#c4b8f0',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + 제품 추가
          </button>
        ) : null}
      </div>

      {isAuto ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>판매량·평점 기준 자동 추천이에요</div>
      ) : null}

      <div style={{ marginBottom: 8 }}>
        {chipScroll(
          <>
            {STEP_CHIPS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStepFilter(s)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: stepFilter === s ? '1px solid rgba(123,108,192,0.6)' : '1px solid rgba(255,255,255,0.1)',
                  background: stepFilter === s ? 'rgba(123,108,192,0.2)' : 'rgba(255,255,255,0.04)',
                  color: stepFilter === s ? '#e0d8ff' : 'rgba(255,255,255,0.55)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {s}
              </button>
            ))}
          </>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        {chipScroll(
          <>
            {FUNC_CHIPS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setFuncFilter(s)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: funcFilter === s ? '1px solid rgba(90,219,138,0.45)' : '1px solid rgba(255,255,255,0.1)',
                  background: funcFilter === s ? 'rgba(90,219,138,0.12)' : 'rgba(255,255,255,0.04)',
                  color: funcFilter === s ? '#b8f0cf' : 'rgba(255,255,255,0.55)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {s}
              </button>
            ))}
          </>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '20px 0' }}>불러오는 중…</div>
      ) : (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {filtered.map(row => {
            const p = row.products
            if (!p) return null
            const thumb = p.storage_thumb_url || p.thumb_img || ''
            const autoRow = row.id.startsWith('auto-')
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => router.push(`/products/${p.id}`)}
                style={{
                  position: 'relative',
                  width: 128,
                  flexShrink: 0,
                  background: CARD_BG,
                  borderRadius: 12,
                  border: showEditChrome && !autoRow ? '1px dashed rgba(123,108,192,0.45)' : '1px solid rgba(255,255,255,0.06)',
                  padding: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  overflow: 'hidden',
                }}
              >
                {showEditChrome && !autoRow ? (
                  <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4, zIndex: 2 }} onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      style={{
                        fontSize: 9,
                        padding: '2px 5px',
                        borderRadius: 4,
                        border: '1px solid rgba(123,108,192,0.5)',
                        background: 'rgba(30,24,48,0.9)',
                        color: '#c4b8f0',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRow(row)}
                      style={{
                        fontSize: 9,
                        padding: '2px 5px',
                        borderRadius: 4,
                        border: '1px solid rgba(220,80,80,0.45)',
                        background: 'rgba(40,20,20,0.85)',
                        color: '#f0a0a0',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ) : null}
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.05)',
                    marginBottom: 6,
                  }}
                >
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                {!isAuto && (row.step_tag || row.func_tag) ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                    {row.step_tag ? (
                      <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, background: BADGE_STEP_BG, color: BADGE_STEP_FG }}>{row.step_tag}</span>
                    ) : null}
                    {row.func_tag ? (
                      <span style={{ fontSize: 8, padding: '2px 5px', borderRadius: 4, background: BADGE_FUNC_BG, color: BADGE_FUNC_FG }}>{row.func_tag}</span>
                    ) : null}
                  </div>
                ) : null}
                <div
                  style={{
                    fontSize: 11,
                    color: '#fff',
                    lineHeight: 1.35,
                    marginBottom: 4,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: 30,
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 12, color: '#c9a96e' }}>₩{displayPrice(p).toLocaleString()}</div>
              </button>
            )
          })}
        </div>
      )}

      {filtered.length === 0 && !loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '8px 0 12px' }}>조건에 맞는 제품이 없어요</div>
      ) : null}

      <button
        type="button"
        onClick={() => router.push('/products?season=true')}
        style={{
          marginTop: 8,
          width: '100%',
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        이달 추천 전체보기 →
      </button>

      {showEditChrome && formOpen ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: FORM_BG,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>{editingId ? '매핑 수정' : '매핑 추가'}</div>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="제품명 검색 (2자 이상)"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#14141a',
              color: '#fff',
              fontSize: 12,
              marginBottom: 8,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchLoading ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>검색 중…</div> : null}
          <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
            {searchResults.map(sp => (
              <button
                key={sp.id}
                type="button"
                onClick={() => setPickProduct(sp)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: 6,
                  marginBottom: 4,
                  borderRadius: 8,
                  border: pickProduct?.id === sp.id ? '1px solid rgba(123,108,192,0.55)' : '1px solid transparent',
                  background: pickProduct?.id === sp.id ? 'rgba(123,108,192,0.12)' : 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                  {sp.storage_thumb_url || sp.thumb_img ? (
                    <img src={sp.storage_thumb_url || sp.thumb_img || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>₩{displayPrice(sp).toLocaleString()}</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <select
              value={formStep}
              onChange={e => setFormStep(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: 6, borderRadius: 8, background: '#14141a', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: 11 }}
            >
              {STEP_OPTIONS.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select
              value={formFunc}
              onChange={e => setFormFunc(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: 6, borderRadius: 8, background: '#14141a', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', fontSize: 11 }}
            >
              {FUNC_OPTIONS.map(o => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={saving || !pickProduct}
              onClick={() => void saveMapping()}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: pickProduct ? 'rgba(123,108,192,0.45)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 12,
                cursor: pickProduct && !saving ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.55)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
