'use client'

import Link from 'next/link'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import ProductThumbImage from '@/components/ProductThumbImage'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useCart } from '@/context/CartContext'
import ProductsCatalogView from '@/components/views/ProductsCatalogView'

function ProductCard({ p }: { p: any }) {
  const [toast, setToast] = useState('')
  const { addItem } = useCart()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const onCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const price = Number(p.retail_price) || 0
    if (price < 1) {
      setToast('가격이 설정된 상품만 담을 수 있어요')
      return
    }
    const { wasNewLine } = addItem({
      product_id: String(p.id),
      name: String(p.name || '제품'),
      price,
      thumb_img: p.thumb_img ?? null,
      brand_name: p.brands?.name || '',
      quantity: 1,
    })
    setToast(wasNewLine ? '🛒 장바구니에 담겼어요!' : '수량이 +1 되었습니다')
  }

  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 18,
        padding: '14px 14px 14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      {toast ? (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: -6,
            zIndex: 2,
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(201,168,76,0.35)',
            background: 'rgba(201,168,76,0.14)',
            color: 'var(--gold)',
            fontSize: 11,
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      ) : null}
      <Link
        href={`/products/${p.id}`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          gap: 12,
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          <ProductThumbImage src={p.thumb_img} alt={p.name || ''} fill sizes="72px" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{p.name}</div>
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
              <div style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }} />
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : ''}</div>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: (p.retail_price || 0) === 0 ? 'var(--text3)' : 'var(--gold)' }}>
              {(p.retail_price || 0) === 0 ? '가격 설정 필요' : `₩${Number(p.retail_price).toLocaleString()}`}
            </div>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onCart}
        aria-label="장바구니에 담기"
        style={{
          alignSelf: 'center',
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px solid rgba(201,168,76,0.35)',
          background: 'rgba(201,168,76,0.1)',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🛒
      </button>
    </div>
  )
}

function ProductsPageInner() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [selectedBrand, setSelectedBrand] = useState<any | null>(null)
  const specialIdsParam = searchParams.get('specialIds') || ''
  const specialIds = useMemo(
    () => specialIdsParam.split(',').map(v => v.trim()).filter(Boolean),
    [specialIdsParam]
  )
  const skinParam = searchParams.get('skin') || ''
  const concernParam = searchParams.get('concern') || ''

  useEffect(() => {
    const bid = searchParams.get('brandFilter')
    if (bid) setBrandFilter(bid)
  }, [searchParams])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('products')
        .select('*, brands(name)')
        .order('created_at', { ascending: false })
      if (err) {
        setError(err.message || '제품 목록을 불러오지 못했습니다.')
        setProducts([])
      } else {
        setProducts(
          (data || []).map((row: any) => ({
            ...row,
            price: row.retail_price,
            brand_name: row.brands?.name || '',
          }))
        )
      }
      setLoading(false)
    }
    run()
  }, [supabase])

  useEffect(() => {
    const run = async () => {
      if (brandFilter === 'all') {
        setSelectedBrand(null)
        return
      }
      const { data } = await supabase
        .from('brands')
        .select('id,name,origin,description,logo_url,story_title,story_body,story_image_url,promo_enabled,promo_title,promo_body,promo_image_url,promo_link_url,promo_starts_at,promo_ends_at')
        .eq('id', brandFilter)
        .maybeSingle()
      setSelectedBrand(data || null)
    }
    run()
  }, [brandFilter, supabase])

  const brands = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const p of products) {
      const bid = p.brand_id || ''
      const bname = p.brands?.name || ''
      if (!bid || !bname) continue
      const cur = map.get(bid)
      if (cur) cur.count += 1
      else map.set(bid, { id: bid, name: bname, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [products])

  const visible = useMemo(() => {
    let source = specialIds.length > 0 ? products.filter(p => specialIds.includes(String(p.id))) : products
    if (brandFilter !== 'all') source = source.filter(p => p.brand_id === brandFilter)
    if (skinParam) {
      source = source.filter(
        p => Array.isArray(p.skin_types) && p.skin_types.some((s: string) => String(s) === skinParam)
      )
    }
    if (concernParam) {
      source = source.filter(p => {
        const qm = Array.isArray(p.quiz_match) ? p.quiz_match.join(' ') : ''
        const blob = [p.name, p.description, p.tag, p.category, qm].filter(Boolean).join(' ')
        return blob.includes(concernParam)
      })
    }
    return source
  }, [brandFilter, products, specialIds, skinParam, concernParam])

  return (
    <ProductsCatalogView
      header={<DashboardHeader title="제품추천" right={<CustomerHeaderRight />} />}
      bottomNav={<DashboardBottomNav role="customer" />}
      specialIdsActive={specialIds.length > 0}
      skinParam={skinParam}
      concernParam={concernParam}
      brands={brands}
      brandFilter={brandFilter}
      onBrandFilter={setBrandFilter}
      productTotal={products.length}
      selectedBrand={selectedBrand}
      error={error}
      loading={loading}
      empty={!loading && visible.length === 0}
      list={
        <>
          {visible.map(p => (
            <ProductCard key={p.id} p={p} />
          ))}
        </>
      }
    />
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <ProductsPageInner />
    </Suspense>
  )
}

