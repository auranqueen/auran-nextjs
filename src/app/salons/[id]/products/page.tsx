'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BG = '#0D0B09'
type Product = {
  id: string; name: string; thumb_img: string | null; brand_id: string
  consumer_price: number; sales_count: number; review_count: number; rating_sum: number
  brands: { name: string } | null
}
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
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [locked, setLocked] = useState(false)
  const [lockReason, setLockReason] = useState<string | null>(null)
  const [categoriesFlat, setCategoriesFlat] = useState<any[]>([])
  const [brandOptions, setBrandOptions] = useState<{ id: string; name: string }[]>([])
  const [copied, setCopied] = useState(false)
  const [isPc, setIsPc] = useState(false)
  const [stories, setStories] = useState<
    {
      id: string
      story_type: 'treatment' | 'homecare'
      title: string
      banner_image_url_pc: string | null
      banner_image_url_mobile: string | null
      created_at: string
    }[]
  >([])
  const requestRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  useEffect(() => {
    fetch(`/api/salons/${params.id}/stories`)
      .then((r) => r.json())
      .then((res) => {
        if (res.ok) setStories(res.stories || [])
      })
      .catch(() => {})
  }, [params.id])
  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ url }); return } catch {}
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
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
      {stories.length > 0 && (
        <div style={{ paddingBottom: 16 }}>
          <div style={{ padding: '0 16px 8px', fontSize: 12, color: GOLD }}>스토리</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isPc ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
              gap: 10,
              padding: '0 16px',
            }}
          >
            {stories.map((s) => {
              const thumb = isPc
                ? s.banner_image_url_pc || s.banner_image_url_mobile
                : s.banner_image_url_mobile || s.banner_image_url_pc
              return (
                <a
                  key={s.id}
                  href={`/salons/${params.id}/story/${s.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '2.7',
                      borderRadius: 10,
                      background: PURPLE_LIGHT,
                      overflow: 'hidden',
                    }}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11, color: '#fff', marginTop: 6, lineHeight: 1.3 }}>{s.title}</div>
                  <div
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 20,
                      background: PURPLE_LIGHT,
                      color: PURPLE,
                      border: `0.5px solid ${BORDER}`,
                    }}
                  >
                    {s.story_type === 'treatment' ? '관리프로그램' : '홈케어'}
                  </div>
                </a>
              )
            })}
          </div>
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
