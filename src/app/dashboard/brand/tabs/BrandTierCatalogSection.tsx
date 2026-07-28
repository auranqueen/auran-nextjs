'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
const PURPLE = '#7B5EA7'
type Product = {
  id: string
  brand_id: string
  name: string
  supply_price: number
  thumb_img: string | null
  category: string | null
  status: string
  is_tier_catalog: boolean
}
type Props = {
  companyId: string | null
  myBrands: { id: string; name: string }[]
}
export default function BrandTierCatalogSection({ companyId, myBrands }: Props) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const brandNameById = (id: string) => myBrands.find((b) => b.id === id)?.name || '브랜드'
  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const brandIds = myBrands.map((b) => b.id)
      if (brandIds.length === 0) {
        setProducts([])
        return
      }
      const { data } = await supabase
        .from('brand_products')
        .select('id, brand_id, name, supply_price, thumb_img, category, status, is_tier_catalog')
        .in('brand_id', brandIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setProducts((data || []) as Product[])
    } finally {
      setLoading(false)
    }
  }, [companyId, myBrands])
  useEffect(() => {
    void load()
  }, [load])
  const toggle = async (product: Product) => {
    if (!companyId) return
    setTogglingId(product.id)
    const next = !product.is_tier_catalog
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_tier_catalog: next } : p)))
    try {
      const res = await fetch('/api/brand/tier-catalog-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ company_id: companyId, product_id: product.id, is_tier_catalog: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!json?.ok) {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, is_tier_catalog: !next } : p)))
        showToast('변경 실패')
        return
      }
      showToast(next ? '카탈로그에 포함됐어요' : '카탈로그에서 제외됐어요')
    } finally {
      setTogglingId(null)
    }
  }
  const filtered = products.filter((p) => {
    if (brandFilter && p.brand_id !== brandFilter) return false
    if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })
  return (
    <div style={{ marginTop: 20 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>등급 카탈로그 (제품·기기)</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
        이미 등록된 제품 중 원장이 등급구매 시 자율선택할 수 있게 할 항목을 켜주세요
      </div>
      <input
        type="text"
        placeholder="제품명 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 13, marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setBrandFilter(null)}
          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1px solid ${!brandFilter ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: !brandFilter ? 'rgba(123,94,167,0.2)' : 'transparent', color: !brandFilter ? '#c4a8f0' : 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
        >
          전체
        </button>
        {myBrands.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBrandFilter(b.id)}
            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1px solid ${brandFilter === b.id ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: brandFilter === b.id ? 'rgba(123,94,167,0.2)' : 'transparent', color: brandFilter === b.id ? '#c4a8f0' : 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
          >
            {b.name}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>제품이 없어요 (제품등록 탭에서 먼저 등록해 주세요)</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: p.is_tier_catalog ? 'rgba(123,94,167,0.08)' : 'rgba(255,255,255,0.03)' }}>
              {p.thumb_img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumb_img} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📦</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  {brandNameById(p.brand_id)}{p.category ? ` · ${p.category}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{Math.trunc(p.supply_price).toLocaleString()}원</div>
              <button
                type="button"
                disabled={togglingId === p.id}
                onClick={() => void toggle(p)}
                style={{
                  fontSize: 11,
                  padding: '5px 12px',
                  borderRadius: 20,
                  border: `1px solid ${p.is_tier_catalog ? PURPLE : 'rgba(255,255,255,0.15)'}`,
                  background: p.is_tier_catalog ? PURPLE : 'transparent',
                  color: p.is_tier_catalog ? '#fff' : 'rgba(255,255,255,0.4)',
                  cursor: togglingId === p.id ? 'wait' : 'pointer',
                  opacity: togglingId === p.id ? 0.6 : 1,
                }}
              >
                {p.is_tier_catalog ? '포함됨' : '포함하기'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
