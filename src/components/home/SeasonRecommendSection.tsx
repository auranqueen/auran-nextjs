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

const STEP_CHIPS = ['전체', '클렌징', '토너', '앰플·세럼·에센스', '크림·로션', '선크림'] as const
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
  issue_key?: string | null
  priority: number
  is_active: boolean
  products: ProductLite | null
}

export type SeasonRecommendSectionProps = {
  month: number
  showEditChrome: boolean
  supabaseClient: SupabaseClient
  hormonePhase?: string
}

function displayPrice(p: ProductLite): number {
  const sale = p.sale_price != null ? Number(p.sale_price) : null
  const retail = Number(p.retail_price ?? 0)
  if (sale != null && !Number.isNaN(sale) && sale > 0) return sale
  return retail
}

function stepMatchesTag(step: string, tagLower: string): boolean {
  if (step === '앰플·세럼·에센스') {
    return tagLower.includes('앰플') || tagLower.includes('세럼') || tagLower.includes('에센스')
  }
  if (step === '크림·로션') {
    return tagLower.includes('크림') || tagLower.includes('로션')
  }
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
      const stepKeywords: Record<string, string[]> = {
        클렌징: ['클렌징', '클렌저', '폼클', '오일클렌', '클렌밤'],
        토너: ['토너', '스킨', '토닉', '미스트'],
        '앰플·세럼·에센스': ['앰플', '세럼', '에센스', '부스터', '컨센트레이트'],
        '크림·로션': ['크림', '로션', '에멀전', '모이스처'],
        선크림: ['선크림', '선스틱', '선젤', '썬', 'spf'],
        '마스크·팩': ['마스크', '팩', '시트'],
        바디케어: ['바디', '입욕', '솔트', '마사지오일'],
        헤어케어: ['헤어', '샴푸', '트리트먼트'],
      }
      const stepF_keywords = stepKeywords[stepF] || [stepF]
      const matched = stepTags.some((t: string) =>
        stepF_keywords.some(k =>
          t.replace(/[·・•\s]/g, '').toLowerCase()
            .includes(k.replace(/[·・•\s]/g, '').toLowerCase())
        )
      )
      if (!matched) return false
    }

    if (funcF !== '전체') {
      const funcKeywords: Record<string, string[]> = {
        미백: ['미백', '톤업', '브라이트', '화이트'],
        탄력: ['탄력', '주름', '리프팅', '콜라겐', '안티에이징'],
        수분: ['수분', '보습', '하이드', '촉촉'],
        진정: ['진정', '민감', '예민', '수딩', '칼밍'],
        장벽: ['장벽', '재생', '리페어', '배리어', '세라마이드'],
        모공: ['모공', '피지', '블랙헤드'],
        아로마: ['아로마', '릴렉스', '에센셜'],
      }
      const funcF_keywords = funcKeywords[funcF] || [funcF]
      const funcMatched = funcTags.some((t: string) =>
        funcF_keywords.some(k =>
          t.replace(/[·・•\s]/g, '').toLowerCase()
            .includes(k.replace(/[·・•\s]/g, '').toLowerCase())
        )
      )
      if (!funcMatched) return false
    }

    return true
  }
  const st = String(row.step_tag || '').trim()
  const ft = String(row.func_tag || '').trim()
  if (stepF !== '전체' && st !== stepF) return false
  if (funcF !== '전체' && ft !== funcF) return false
  return true
}

export default function SeasonRecommendSection({
  month,
  showEditChrome,
  supabaseClient,
  hormonePhase,
}: SeasonRecommendSectionProps) {
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
  const [activeTab, setActiveTab] = useState<'pick' | 'step' | 'func'>('pick')
  const [issueButtons, setIssueButtons] = useState<
    Array<{
      key: string
      label: string
      step_tag?: string
      func_tag?: string
    }>
  >([])
  const [activeIssue, setActiveIssue] = useState<string>('전체')
  const [addProdOpen, setAddProdOpen] = useState(false)
  const [addProdSearch, setAddProdSearch] = useState('')
  const [addProdResults, setAddProdResults] = useState<any[]>([])
  const [addProdSearchLoading, setAddProdSearchLoading] = useState(false)

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
        'id, name, retail_price, sale_price, storage_thumb_url, thumb_img, tag, skin_types, sales_count, avg_rating, step_tags, func_tags, concern_tags, skin_tags, hormone_timing'
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
    supabaseClient
      .from('admin_settings')
      .select('key, value')
      .eq('category', 'monthly_issue')
      .like('key', `${month}_%%`)
      .order('key')
      .then(({ data }) => {
        if (!data) return
        setIssueButtons(
          data.map((row: any) => ({
            key: row.key,
            ...JSON.parse(row.value),
          }))
        )
      })
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
    const activeIssueBtnData = issueButtons.find(ib => ib.label === activeIssue)
    if (activeTab === 'pick') {
      if (isAuto) {
        const btn = issueButtons.find(ib => ib.label === activeIssue)
        return rows
          .map(r => r.products as any)
          .filter(Boolean)
          .filter((p: any) => {
            if (!btn || activeIssue === '전체') return true
            const stepTags = (p.step_tags || []).map((t: string) => t.toLowerCase())
            const funcTags = (p.func_tags || []).map((t: string) => t.toLowerCase())
            const concernTags = (p.concern_tags || []).map((t: string) => t.toLowerCase())
            if (btn.step_tag) {
              return stepTags.some((t: string) => t.includes(btn.step_tag!.toLowerCase()))
            }
            if (btn.func_tag) {
              return funcTags.some((t: string) => t.includes(btn.func_tag!.toLowerCase())) ||
                     concernTags.some((t: string) => t.includes(btn.func_tag!.toLowerCase()))
            }
            return true
          })
          .sort((a: any, b: any) => (b.sales_count || 0) - (a.sales_count || 0))
          .slice(0, 8)
          .map((p: any, i: number): MappingRow => ({
            id: `auto-pick-${p.id}`,
            month,
            product_id: p.id,
            concern_tag: null,
            step_tag: '',
            func_tag: '',
            priority: i,
            is_active: true,
            products: p as ProductLite,
          }))
      }
      const pickRows = rows.filter(r => rowMatchesFilters(r, '전체', '전체', false))
      if (activeIssue === '전체') {
        return rows
          .map(r => r.products as any)
          .filter(Boolean)
          .sort((a: any, b: any) => (b.sales_count || 0) - (a.sales_count || 0))
          .slice(0, 8)
          .map((p: any, i: number): MappingRow => ({
            id: `auto-pick-${p.id}`,
            month,
            product_id: p.id,
            concern_tag: null,
            step_tag: '',
            func_tag: '',
            priority: i,
            is_active: true,
            products: p as ProductLite,
          }))
      }
      if (!activeIssueBtnData) return pickRows
      return pickRows.filter(r => {
        if (activeIssue === '전체') return true
        if (!r.issue_key) return false
        return String(r.issue_key).trim() === String(activeIssue).trim()
      })
    }
    if (activeTab === 'step') {
      return rows.filter(r => rowMatchesFilters(r, stepFilter, '전체', isAuto))
    }
    return rows.filter(r => rowMatchesFilters(r, '전체', funcFilter, isAuto))
  }, [rows, stepFilter, funcFilter, isAuto, activeTab, hormonePhase, issueButtons, activeIssue])

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

  const mappedProductIds = useMemo(
    () => new Set(rows.filter(r => !r.id.startsWith('auto-')).map(r => r.product_id)),
    [rows]
  )

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

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>오랜 픽 💜</div>
        {showEditChrome ? (
          <button
            type="button"
            onClick={() => setAddProdOpen(v => !v)}
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
            {addProdOpen ? '닫기' : '+ 제품 추가'}
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          margin: '10px 0 12px',
          background: '#1a1a20',
          borderRadius: 11,
          padding: 3,
        }}
      >
        {([
          { key: 'pick', label: '오늘의 스킨 큐레이션' },
        ] as const).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1,
              padding: '7px',
              borderRadius: 8,
              fontSize: 11,
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit',
              fontWeight: activeTab === t.key ? 500 : 400,
              background: activeTab === t.key ? '#7B5EA7' : 'transparent',
              color: activeTab === t.key ? '#fff' : '#555',
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isAuto ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginBottom: 8 }}>판매량·평점 기준 자동 추천이에요</div>
      ) : null}

      {activeTab === 'pick' && (
        <>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 10,
              paddingLeft: 2,
            }}
          >
            원장님이 직접 고른 제품이에요 💜
          </div>
          {issueButtons.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                scrollbarWidth: 'none',
                marginBottom: 10,
                paddingBottom: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveIssue('전체')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 11,
                  cursor: 'pointer',
                  border: activeIssue === '전체' ? '1px solid rgba(123,94,167,0.6)' : '0.5px solid #2a2a36',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: activeIssue === '전체' ? '#2a1a3e' : '#1e1e26',
                  color: activeIssue === '전체' ? '#c4a8ff' : '#555',
                }}
              >
                전체
              </button>
              {issueButtons.map(ib => (
                <button
                  key={ib.key}
                  type="button"
                  onClick={() => setActiveIssue(ib.label)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 11,
                    cursor: 'pointer',
                    border: activeIssue === ib.label ? '1px solid rgba(123,94,167,0.6)' : '0.5px solid #2a2a36',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    background: activeIssue === ib.label ? '#2a1a3e' : '#1e1e26',
                    color: activeIssue === ib.label ? '#c4a8ff' : '#555',
                  }}
                >
                  {ib.label}
                </button>
              ))}
            </div>
          )}
          {showEditChrome ? (
            <>
              <div
                style={{
                  marginBottom: 8,
                  padding: '8px 10px',
                  background: 'rgba(123,94,167,0.08)',
                  borderRadius: 8,
                  border: '0.5px dashed rgba(123,94,167,0.3)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(196,168,255,0.5)',
                    marginBottom: 6,
                  }}
                >
                  이슈 버튼 관리 (슈퍼어드민)
                </div>
                {issueButtons.map((ib, idx) => (
                  <div
                    key={ib.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 5,
                    }}
                  >
                    <input
                      type="text"
                      defaultValue={ib.label}
                      onBlur={async e => {
                        const val = e.target.value.trim()
                        if (!val) return
                        const newVal = JSON.stringify({
                          ...ib,
                          label: val,
                        })
                        await supabaseClient
                          .from('admin_settings')
                          .update({ value: newVal })
                          .eq('category', 'monthly_issue')
                          .eq('key', ib.key)
                        setIssueButtons(prev => prev.map((b, i) => (i === idx ? { ...b, label: val } : b)))
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.04)',
                        border: '0.5px solid rgba(255,255,255,0.1)',
                        borderRadius: 7,
                        padding: '4px 8px',
                        fontSize: 11,
                        color: '#ccc',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        await supabaseClient.from('admin_settings').delete().eq('category', 'monthly_issue').eq('key', ib.key)
                        setIssueButtons(prev => prev.filter((_, i) => i !== idx))
                      }}
                      style={{
                        fontSize: 11,
                        color: '#e87b4a',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        flexShrink: 0,
                      }}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <input
                  type="text"
                  placeholder="이슈 버튼 추가 (예: 🌸 봄 환절기)"
                  id="newIssueLabel"
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 11,
                    color: '#ccc',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const input = document.getElementById('newIssueLabel') as HTMLInputElement
                    const val = input?.value.trim()
                    if (!val) return
                    const newKey = `${month}_${Date.now()}`
                    const newVal = JSON.stringify({
                      label: val,
                    })
                    await supabaseClient.from('admin_settings').insert({
                      category: 'monthly_issue',
                      key: newKey,
                      value: newVal,
                      label: val,
                    })
                    setIssueButtons(prev => [...prev, { key: newKey, label: val }])
                    if (input) input.value = ''
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 7,
                    fontSize: 11,
                    cursor: 'pointer',
                    border: '1px solid rgba(123,94,167,0.4)',
                    background: '#2a1a3e',
                    color: '#c4a8ff',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  + 추가
                </button>
              </div>
            </>
          ) : null}
        </>
      )}
      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '20px 0' }}>불러오는 중…</div>
      ) : (
        <>
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
          {showEditChrome ? (
            <div
              onClick={() => setAddProdOpen(true)}
              style={{
                flexShrink: 0,
                width: 115,
                minHeight: 140,
                borderRadius: 13,
                border: '1px dashed rgba(123,108,192,0.45)',
                background: 'rgba(30,24,48,0.3)',
                color: '#c4b8f0',
                fontSize: 24,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +
            </div>
          ) : null}
        </div>
      {addProdOpen ? (
        <div
          style={{
            margin: '0 0 10px',
            padding: '10px',
            background: 'rgba(123,94,167,0.08)',
            borderRadius: 10,
            border: '0.5px solid rgba(123,94,167,0.3)',
          }}
        >
          <div style={{ fontSize: 10, color: 'rgba(196,168,255,0.5)', marginBottom: 4 }}>제품 검색 (2글자 이상)</div>
          <input
            type="text"
            value={addProdSearch}
            onChange={async e => {
              const q = e.target.value
              setAddProdSearch(q)
              if (q.trim().length < 2) {
                setAddProdResults([])
                setAddProdSearchLoading(false)
                return
              }
              setAddProdSearchLoading(true)
              const { data } = await supabaseClient
                .from('products')
                .select('id, name, step_tags, func_tags, storage_thumb_url, thumb_img')
                .eq('is_active', true)
                .ilike('name', `%${q.trim().slice(0, 80)}%`)
                .limit(8)
              setAddProdResults(data || [])
              setAddProdSearchLoading(false)
            }}
            placeholder="제품명"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 8,
              border: '0.5px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#ccc',
              fontSize: 12,
              fontFamily: 'inherit',
              marginBottom: 8,
              outline: 'none',
            }}
          />
          {addProdSearchLoading ? <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>검색 중…</div> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {addProdResults.map(p => {
              const added = mappedProductIds.has(p.id)
              const thumb = p.storage_thumb_url || p.thumb_img
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 6,
                    borderRadius: 8,
                    border: '1px solid rgba(123,108,192,0.2)',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'rgba(123,108,192,0.1)',
                    }}
                  >
                    {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>{p.step_tags?.[0] || '—'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (added) return
                      const st = p.step_tags?.[0] || ''
                      const ft = p.func_tags?.[0] || ''
                      const { error } = await supabaseClient.from('season_product_mapping').insert({
                        month,
                        product_id: p.id,
                        step_tag: st,
                        func_tag: ft,
                        concern_tag: '',
                        priority: maxPriority + 1,
                        is_active: true,
                      })
                      if (error) return
                      await fetchData()
                      setAddProdSearch('')
                      setAddProdResults([])
                      setAddProdOpen(false)
                    }}
                    disabled={added}
                    style={{
                      fontSize: 10,
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '0.5px solid rgba(123,108,192,0.45)',
                      background: added ? 'rgba(123,108,192,0.05)' : 'rgba(123,108,192,0.2)',
                      color: added ? '#666' : '#c4b8f0',
                      cursor: added ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      flexShrink: 0,
                    }}
                  >
                    {added ? '추가됨' : '+ 추가'}
                  </button>
                </div>
              )
            })}
          </div>
          {addProdSearch.trim().length >= 2 && addProdResults.length === 0 && !addProdSearchLoading ? (
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center', padding: '10px 0' }}>검색 결과가 없어요</div>
          ) : null}
        </div>
      ) : null}
        </>
      )}

      {filtered.length === 0 && !loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '8px 0 12px' }}>조건에 맞는 제품이 없어요</div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (activeTab === 'pick') {
            router.push('/products?pick=true')
          } else if (activeTab === 'step') {
            router.push(`/products?step=${encodeURIComponent(stepFilter)}`)
          } else {
            router.push(`/products?func=${encodeURIComponent(funcFilter)}`)
          }
        }}
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
        {activeTab === 'pick'
          ? '전체보기 →'
          : activeTab === 'step'
            ? '단계별 전체보기 →'
            : '고민별 전체보기 →'}
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
