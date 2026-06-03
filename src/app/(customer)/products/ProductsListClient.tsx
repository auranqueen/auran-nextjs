'use client'

import { createClient } from '@/lib/supabase/client'
import { calcHormoneBriefing } from '@/lib/hormoneUtils'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const BG = '#0f0f12'
const CARD = '#1e1e26'
const BRAND = '#7b6cc0'
const BADGE_BG = '#1a0f28'
const BADGE_FG = '#c4a8ff'

type Row = {
  id: string
  name: string
  retail_price?: number | null
  sale_price?: number | null
  storage_thumb_url?: string | null
  thumb_img?: string | null
  step_tags?: string[] | null
  func_tags?: string[] | null
  hormone_tags?: string[] | null
  brands?: { name?: string | null } | null
  gender_tag?: string | null
  season_tags?: string[] | null
  sales_count?: number | null
  created_at?: string | null
  /** pick 목록 전용: season_product_mapping 행 id */
  mapping_id?: string | null
  season_priority?: number | null
}

function priceOf(p: Row) {
  const s = p.sale_price != null ? Number(p.sale_price) : null
  const r = Number(p.retail_price ?? 0)
  if (s != null && !Number.isNaN(s) && s > 0) return s
  return r
}

function tagMatch(tags: string[] | null | undefined, q: string) {
  const n = q.replace(/[·・•\s]/g, '').toLowerCase()
  return (tags || []).some(t => String(t).replace(/[·・•\s]/g, '').toLowerCase().includes(n))
}

function dramaticLine(p: Row, phase: string, focus: string, hormoneMatch: boolean) {
  if (hormoneMatch) return `지금 ${phase} · ${focus.split('/')[0]}에 어울려요`
  const s = p.step_tags?.[0]
  const f = p.func_tags?.[0]
  if (s && f) return `${s} × ${f} — 오늘의 한 줄`
  if (s) return `${s} 케어로 마무리`
  return '피부가 고마워할 거예요'
}

export default function ProductsListClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [hormoneBadge, setHormoneBadge] = useState('')
  const [phaseFocus, setPhaseFocus] = useState({ phase: '', focus: '' })
  const [showEditChrome, setShowEditChrome] = useState(false)
  const [addProdOpen, setAddProdOpen] = useState(false)
  const [addProdSearch, setAddProdSearch] = useState('')
  const [addProdResults, setAddProdResults] = useState<any[]>([])
  const [addProdSearchLoading, setAddProdSearchLoading] = useState(false)
  const [userGender, setUserGender] = useState<string | null>(null)
  const [userHca, setUserHca] = useState<boolean | null>(null)
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())

  const step = sp.get('step') ? decodeURIComponent(sp.get('step')!) : ''
  const func = sp.get('func') ? decodeURIComponent(sp.get('func')!) : ''
  const pick = sp.get('pick') === 'true'
  const brandId = sp.get('brand') || ''

  const currentMonth = useMemo(() => new Date().getMonth() + 1, [])

  const [brandName, setBrandName] = useState('')

  const title = useMemo(() => {
    if (brandId) return brandName || '제품'
    if (pick) return '원장 픽'
    if (step) return '단계별'
    if (func) return '고민별'
    return '제품'
  }, [brandId, brandName, pick, step, func])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user as { app_metadata?: { role?: string }; raw_app_meta_data?: { role?: string } } | undefined
      const role = user?.app_metadata?.role ?? user?.raw_app_meta_data?.role ?? ''
      setShowEditChrome(role === 'super_admin')
    })
  }, [supabase])

  const maxSeasonPriority = useMemo(() => {
    if (!rows.length) return 0
    return Math.max(0, ...rows.map(r => r.season_priority ?? 0))
  }, [rows])

  const mappedPickIds = useMemo(() => new Set(pick ? rows.map(r => r.id) : []), [rows, pick])

  const load = useCallback(async () => {
    setLoading(true)
    let brandName = ''
    if (brandId) {
      const { data: bData } = await supabase.from('brands').select('brand_name_kr, name').eq('id', brandId).single()
      brandName = bData?.brand_name_kr || bData?.name || ''
      setBrandName(brandName)
    } else {
      setBrandName('')
    }
    const month = new Date().getMonth() + 1
    let list: Row[] = []
    const season = (() => {
      const m = new Date().getMonth() + 1
      if (m >= 3 && m <= 5) return '봄'
      if (m >= 6 && m <= 8) return '여름'
      if (m >= 9 && m <= 11) return '가을'
      return '겨울'
    })()
    const { data: { user } } = await supabase.auth.getUser()
    let hcRow: any = null
    if (user) {
      const { data: hc } = await supabase.from('hormone_cycle').select('*').eq('auth_id', user.id).maybeSingle()
      hcRow = hc
      const b = hc ? calcHormoneBriefing(hc) : null
      setHormoneBadge(b?.phase ?? '')
      const { data: pRow } = await supabase
        .from('profiles')
        .select('gender, hormone_cycle_applicable')
        .eq('auth_id', user.id)
        .maybeSingle()
      setUserGender((pRow as any)?.gender ?? null)
      setUserHca(
        (pRow as any)?.hormone_cycle_applicable === true ? true :
        (pRow as any)?.hormone_cycle_applicable === false ? false :
        null
      )
      const { data: uRow } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (uRow?.id) {
        const { data: items } = await supabase
          .from('order_items')
          .select('product_id, orders!inner(customer_id)')
          .eq('orders.customer_id', uRow.id)
        const ids = new Set<string>((items || []).map((i: any) => i.product_id).filter(Boolean))
        setPurchasedIds(ids)
      }
      setPhaseFocus(b ? { phase: b.phase, focus: b.focus } : { phase: '', focus: '' })
    } else {
      setHormoneBadge('')
      setPhaseFocus({ phase: '', focus: '' })
    }
    const sel =
      'id, name, brand_id, retail_price, sale_price, storage_thumb_url, thumb_img, step_tags, func_tags, hormone_tags, gender_tag, season_tags, sales_count, created_at, brands(name)'

    if (pick) {
      const { data: maps } = await supabase
        .from('season_product_mapping')
        .select(`id, priority, products(${sel})`)
        .eq('month', month)
        .eq('is_active', true)
        .order('priority', { ascending: true })
      list = (maps || [])
        .map((m: any) => {
          const raw = m.products
          const prod = (Array.isArray(raw) ? raw[0] : raw) as Row | null | undefined
          if (!prod) return null
          return { ...prod, mapping_id: m.id, season_priority: m.priority ?? 0 }
        })
        .filter(Boolean) as Row[]
    } else {
      let query = supabase.from('products').select(sel).eq('is_active', true).eq('status', 'active')
      if (brandId) query = query.eq('brand_id', brandId)
      const { data } = await query.limit(200)
      list = (data as Row[]) || []
      if (step && step !== '전체') list = list.filter(p => tagMatch(p.step_tags, step))
      if (func && func !== '전체') list = list.filter(p => tagMatch(p.func_tags, func))
    }

    const br = hcRow ? calcHormoneBriefing(hcRow) : { phase: '', focus: '' }
    const phase = br.phase ?? ''
    const maxSales = Math.max(0, ...list.map(p => p.sales_count ?? 0))
    const scored = list.map(p => {
      let s = 0
      const htags = (p.hormone_tags || []).map(String)
      if (userGender === 'male') {
        if (htags.some(t => t.includes('남성') || t.includes('전연령'))) s += 3
      } else if (userHca === false) {
        if (htags.some(t => t.includes('갱년기') || t.includes('전연령'))) s += 3
      } else if (phase) {
        if (htags.some(t => t.includes(phase) || t.includes('전연령'))) s += 3
      }
      const gt = p.gender_tag || '공용'
      if (gt === '공용') s += 2
      else if (gt === '남성' && userGender === 'male') s += 2
      else if (gt === '여성' && userGender !== 'male') s += 2
      const stags = (p.season_tags || []).map(String)
      if (stags.some(t => t.includes(season) || t.includes('전계절'))) s += 2
      if (p.created_at) {
        const days = (Date.now() - new Date(p.created_at).getTime()) / 86400000
        if (days <= 30) s += 1
      }
      if (maxSales > 0 && (p.sales_count ?? 0) >= maxSales * 0.8) s += 1
      if (purchasedIds.has(p.id)) s -= 10
      return { p, s }
    })
    scored.sort((a, b) => b.s - a.s)
    setRows(scored.map(s => s.p))
    setLoading(false)
  }, [supabase, pick, step, func, brandId])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const p of rows) {
      const name = p.brands?.name?.trim() || '기타'
      if (!m.has(name)) m.set(name, [])
      m.get(name)!.push(p)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [rows])

  const deletePickProduct = async (productId: string) => {
    const { error } = await supabase
      .from('season_product_mapping')
      .update({ is_active: false })
      .eq('product_id', productId)
      .eq('month', currentMonth)
    if (!error) void load()
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#e8e8ec', paddingBottom: 32 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 18 }}>←</button>
        <div style={{ flex: 1, fontSize: 16, fontWeight: 600 }}>{title}</div>
        {hormoneBadge ? <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: BADGE_BG, color: BADGE_FG }}>{hormoneBadge}</span> : null}
      </header>

      {addProdOpen && pick && showEditChrome ? (
        <div
          style={{
            margin: '0 0 10px',
            padding: '10px 14px',
            background: 'rgba(123,94,167,0.08)',
            borderBottom: '0.5px solid rgba(123,94,167,0.3)',
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
              const { data } = await supabase
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
              const added = mappedPickIds.has(p.id)
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
                      const { error } = await supabase.from('season_product_mapping').insert({
                        month: currentMonth,
                        product_id: p.id,
                        step_tag: st,
                        func_tag: ft,
                        priority: maxSeasonPriority + 1,
                        is_active: true,
                      })
                      if (error) return
                      setAddProdSearch('')
                      setAddProdResults([])
                      setAddProdOpen(false)
                      void load()
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

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 13 }}>불러오는 중…</div>
      ) : grouped.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 13 }}>
          제품이 없어요
          {pick && showEditChrome ? (
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setAddProdOpen(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px dashed rgba(123,108,192,0.45)',
                  background: 'rgba(30,24,48,0.35)',
                  color: '#c4b8f0',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + 제품 추가
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        grouped.map(([brandName, items]) => (
          <section key={brandName} style={{ marginTop: 18, paddingLeft: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ color: BRAND, fontSize: 14, fontWeight: 600 }}>{brandName}</span>
              <span style={{ fontSize: 12, color: '#666' }}>{items.length}개</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 14px 6px' }}>
              {items.map((p: Row) => {
                const hit =
                  !!phaseFocus.focus &&
                  (p.hormone_tags || []).some((t: string) =>
                    phaseFocus.focus.split('/').some(k => k.trim() && String(t).includes(k.trim()))
                  )
                return (
                  <div
                    key={p.id}
                    style={{
                      position: 'relative',
                    }}
                  >
                    {pick && showEditChrome ? (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          void deletePickProduct(p.id)
                        }}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          zIndex: 2,
                          fontSize: 9,
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: '1px solid rgba(220,80,80,0.45)',
                          background: 'rgba(40,20,20,0.9)',
                          color: '#f0a0a0',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        삭제
                      </button>
                    ) : null}
                    <Link
                      href={`/products/${p.id}`}
                      style={{
                        display: 'block',
                        background: CARD,
                        borderRadius: 12,
                        padding: 8,
                        textDecoration: 'none',
                        color: 'inherit',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', marginBottom: 6 }}>
                        {p.storage_thumb_url || p.thumb_img ? (
                          <img src={p.storage_thumb_url || p.thumb_img || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : null}
                      </div>
                      <div style={{ fontSize: 8, color: '#7b6cc0', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.step_tags?.[0] || '·'}
                      </div>
                      <div style={{ fontSize: 10, color: '#fff', lineHeight: 1.3, minHeight: 26, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#c9a96e', marginTop: 4 }}>₩{priceOf(p).toLocaleString()}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.38)', marginTop: 4, lineHeight: 1.35 }}>
                        {dramaticLine(p, phaseFocus.phase, phaseFocus.focus, hit)}
                      </div>
                    </Link>
                  </div>
                )
              })}
              {pick && showEditChrome ? (
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
          </section>
        ))
      )}
    </div>
  )
}
