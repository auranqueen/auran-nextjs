'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BG = '#0D0B09'
type CategoryNode = { id: string; name: string; parent_id: string | null; level: number; sort_order: number | null }
type Product = {
  id: string; name: string; thumb_img: string | null; brand_id: string
  consumer_price: number; sales_count: number; review_count: number; rating_sum: number
  brands: { name: string } | null
}
const CONCERN_OPTIONS = ['보습', '진정', '미백', '탄력', '모공', '각질', '트러블']
const SORT_OPTIONS: [string, string][] = [
  ['popular', '인기순'], ['newest', '신상품순'], ['review', '리뷰많은순'],
  ['price_asc', '낮은가격순'], ['price_desc', '높은가격순'],
]
const LIMIT = 20
export default function SalonProductsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [q, setQ] = useState(searchParams.get('q') || '')
  const [brandId, setBrandId] = useState(searchParams.get('brand_id') || '')
  const [leafCategoryId, setLeafCategoryId] = useState(searchParams.get('category_id') || '')
  const [concerns, setConcerns] = useState<string[]>(searchParams.get('concerns')?.split(',').filter(Boolean) || [])
  const [sort, setSort] = useState(searchParams.get('sort') || 'popular')
  const [openFilter, setOpenFilter] = useState<'brand' | 'step' | 'concern' | null>(null)
  const [catPicked, setCatPicked] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockReason, setLockReason] = useState<string | null>(null)
  const [categoriesFlat, setCategoriesFlat] = useState<CategoryNode[]>([])
  const [brandOptions, setBrandOptions] = useState<{ id: string; name: string }[]>([])
  const [copied, setCopied] = useState(false)
  const [isPc, setIsPc] = useState(false)
  const requestRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const catTree = useMemo(() => {
    const byParent: Record<string, CategoryNode[]> = {}
    for (const c of categoriesFlat) {
      const key = c.parent_id || 'root'
      ;(byParent[key] ||= []).push(c)
    }
    return byParent
  }, [categoriesFlat])
  useEffect(() => {
    if (!leafCategoryId || categoriesFlat.length === 0 || catPicked.length > 0) return
    const path: { id: string; name: string }[] = []
    let current = categoriesFlat.find(c => c.id === leafCategoryId)
    while (current) {
      path.unshift({ id: current.id, name: current.name })
      current = current.parent_id ? categoriesFlat.find(c => c.id === current!.parent_id) : undefined
    }
    if (path.length > 0) setCatPicked(path)
  }, [leafCategoryId, categoriesFlat])
  const syncUrl = useCallback((next: { q?: string; brandId?: string; categoryId?: string; concerns?: string[]; sort?: string }) => {
    const p = new URLSearchParams()
    const nq = next.q ?? q
    const nb = next.brandId ?? brandId
    const nc = next.categoryId ?? leafCategoryId
    const ncc = next.concerns ?? concerns
    const ns = next.sort ?? sort
    if (nq) p.set('q', nq)
    if (nb) p.set('brand_id', nb)
    if (nc) p.set('category_id', nc)
    if (ncc.length > 0) p.set('concerns', ncc.join(','))
    if (ns !== 'popular') p.set('sort', ns)
    router.replace(`${pathname}${p.toString() ? '?' + p.toString() : ''}`)
  }, [q, brandId, leafCategoryId, concerns, sort, pathname, router])
  const fetchProducts = useCallback(async (targetOffset: number, append: boolean) => {
    const reqId = ++requestRef.current
    setLoading(true)
    const p = new URLSearchParams()
    if (q.length >= 2) p.set('q', q)
    if (brandId) p.set('brand_id', brandId)
    if (leafCategoryId) p.set('category_id', leafCategoryId)
    if (concerns.length > 0) p.set('concerns', concerns.join(','))
    p.set('sort', sort)
    p.set('offset', String(targetOffset))
    p.set('limit', String(LIMIT))
    const res = await fetch(`/api/salons/${params.id}/brand-products?${p.toString()}`, { cache: 'no-store' }).then(r => r.json())
    if (reqId !== requestRef.current) return
    if (res.locked) {
      setLocked(true)
      setLockReason(res.lock_reason)
      setLoading(false)
      return
    }
    setLocked(false)
    setTotal(res.total || 0)
    setCategoriesFlat(res.categories || [])
    if (!brandOptions.length) {
      const uniqueBrands = Array.from(
        new Map((res.products || []).map((pr: any) => [pr.brand_id, pr.brands?.name || ''])).entries()
      ).map(([id, name]) => ({ id: id as string, name: name as string }))
      setBrandOptions(uniqueBrands)
    }
    setProducts(prev => append ? [...prev, ...(res.products || [])] : (res.products || []))
    setOffset(targetOffset)
    setLoading(false)
  }, [q, brandId, leafCategoryId, concerns, sort, params.id, brandOptions.length])
  useEffect(() => {
    syncUrl({})
    fetchProducts(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, leafCategoryId, concerns, sort])
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (q.length === 0 || q.length >= 2) {
        syncUrl({ q })
        fetchProducts(0, false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])
  useEffect(() => {
    const check = () => setIsPc(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ url }); return } catch {}
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const toggleConcern = (c: string) => {
    setConcerns(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  const chipStyle = (selected: boolean, small?: boolean): React.CSSProperties => ({
    flexShrink: 0,
    border: selected ? 'none' : `1px solid ${BORDER}`,
    background: selected ? PURPLE : 'transparent',
    color: selected ? '#fff' : 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    padding: small ? '6px 12px' : '7px 14px',
    fontSize: small ? 11 : 12,
  })
  if (locked) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: TEXT_SUB, background: BG, minHeight: '100vh', maxWidth: isPc ? 1100 : 480, margin: '0 auto' }}>
        스토어 상품 진열 기능이 잠겨있어요 ({lockReason})
      </div>
    )
  }
  return (
    <div style={{ color: '#fff', background: BG, minHeight: '100vh', maxWidth: isPc ? 1100 : 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '9px 12px' }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="제품명으로 검색"
            style={{ flex: 1, border: 'none', background: 'transparent', color: '#fff', fontSize: 13, outline: 'none' }}
          />
        </div>
        <button onClick={handleShare} style={{ flexShrink: 0, border: `1px solid ${BORDER}`, background: 'transparent', borderRadius: 10, padding: '0 14px', color: PURPLE, fontSize: 12 }}>
          {copied ? '복사됨' : '공유'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px' }}>
        {(['brand', 'step', 'concern'] as const).map(key => {
          const label = key === 'brand' ? '브랜드' : key === 'step' ? '단계별' : '고민별'
          const hasSelection = (key === 'brand' && brandId) || (key === 'step' && catPicked.length > 0) || (key === 'concern' && concerns.length > 0)
          return (
            <button
              key={key}
              onClick={() => setOpenFilter(openFilter === key ? null : key)}
              style={chipStyle(openFilter === key)}
            >
              {label}{hasSelection ? ' ●' : ''}
            </button>
          )
        })}
      </div>
      {openFilter === 'brand' && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', overflowX: 'auto' }}>
          <button onClick={() => setBrandId('')} style={chipStyle(!brandId)}>전체</button>
          {brandOptions.map(b => (
            <button key={b.id} onClick={() => setBrandId(b.id)} style={chipStyle(brandId === b.id)}>{b.name}</button>
          ))}
        </div>
      )}
      {openFilter === 'step' && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(level => {
            const parentId = level === 0 ? 'root' : catPicked[level - 1]?.id
            if (level > 0 && !catPicked[level - 1]) return null
            const options = catTree[parentId || 'root'] || []
            if (options.length === 0) return null
            return (
              <div key={level} style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                {options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      const isSame = catPicked[level]?.id === opt.id
                      const nextPicked = isSame ? catPicked.slice(0, level) : [...catPicked.slice(0, level), { id: opt.id, name: opt.name }]
                      setCatPicked(nextPicked)
                      setLeafCategoryId(nextPicked.length > 0 ? nextPicked[nextPicked.length - 1].id : '')
                    }}
                    style={chipStyle(catPicked[level]?.id === opt.id, true)}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {openFilter === 'concern' && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', overflowX: 'auto' }}>
          {CONCERN_OPTIONS.map(c => (
            <button key={c} onClick={() => toggleConcern(c)} style={chipStyle(concerns.includes(c))}>{c}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, padding: '6px 16px 8px', borderTop: `1px solid ${BORDER}`, overflowX: 'auto' }}>
        {SORT_OPTIONS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setSort(val)}
            style={{ border: 'none', background: 'transparent', fontSize: 12, color: sort === val ? PURPLE : TEXT_SUB, flexShrink: 0 }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ padding: '4px 16px', fontSize: 11, color: TEXT_SUB }}>{total}개 제품</div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: isPc ? 'repeat(5, 1fr)' : 'repeat(2, 1fr)', gap: 12 }}>
        {products.map(p => {
          const avgRating = p.review_count > 0 ? (p.rating_sum / p.review_count).toFixed(1) : null
          return (
            <a key={p.id} href={`/salons/${params.id}/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ width: '100%', aspectRatio: '1', borderRadius: 10, background: PURPLE_LIGHT, overflow: 'hidden' }}>
                {p.thumb_img && <img src={p.thumb_img} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 6 }}>{p.brands?.name}</div>
              <div style={{ fontSize: 12, color: '#fff' }}>{p.name}</div>
              <div style={{ fontSize: 13, color: '#fff', marginTop: 2 }}>{p.consumer_price.toLocaleString()}원</div>
              {avgRating && (
                <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 1 }}>★ {avgRating} ({p.review_count})</div>
              )}
            </a>
          )
        })}
      </div>
      {products.length < total && (
        <div style={{ padding: '0 16px 16px' }}>
          <button
            onClick={() => fetchProducts(offset + LIMIT, true)}
            disabled={loading}
            style={{ width: '100%', border: `1px solid ${BORDER}`, background: 'transparent', color: PURPLE, borderRadius: 12, padding: 11, fontSize: 13 }}
          >
            {loading ? '불러오는 중...' : '더보기'}
          </button>
        </div>
      )}
    </div>
  )
}
