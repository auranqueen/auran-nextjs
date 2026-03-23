'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import ProductsCatalogView from '@/components/views/ProductsCatalogView'
import ProductCatalogCard from '@/components/ui/ProductCatalogCard'

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
            <ProductCatalogCard key={p.id} p={p} />
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

