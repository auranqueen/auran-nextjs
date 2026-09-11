'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import BrandOrderProductCard from '../brand-orders/BrandOrderProductCard'
import {
  buildOrderLineItem,
  hasValidSupplyPrice,
  type SupplyPromoRow,
} from '@/lib/brand/brandOrderPromos'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
const QTY_STEP = 5
interface Product {
  id: string
  name: string
  thumb_img: string | null
  brand_name: string
  brand_id: string
  company_id: string
  company_name: string
  supply_price: number
}
interface CompanyGroup {
  id: string
  name: string
}
interface CartItem {
  product: Product
  qty: number
  selectedPromo: SupplyPromoRow | null
}
function HqStockOrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [trackAllowed, setTrackAllowed] = useState<boolean | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [companies, setCompanies] = useState<CompanyGroup[]>([])
  const [promoRules, setPromoRules] = useState<SupplyPromoRow[]>([])
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [cart, setCart] = useState<CartItem[]>([])
  const [showPopup, setShowPopup] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [salonName, setSalonName] = useState('')
  /** 회사별 브랜드칩 필터 (companyId → 'all' | brandId) */
  const [brandFilterByCompany, setBrandFilterByCompany] = useState<Record<string, 'all' | string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [primaryCompanyId, setPrimaryCompanyId] = useState<string | null>(null)
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login?role=owner')
      return
    }
    const { data: userRow } = await supabase
      .from('users')
      .select('id, name, salon_name, origin_track')
      .eq('auth_id', user.id)
      .maybeSingle()
    if (String(userRow?.origin_track || '') !== 'B') {
      setTrackAllowed(false)
      setProducts([])
      setCompanies([])
      setPrimaryCompanyId(null)
      setLoading(false)
      return
    }
    setTrackAllowed(true)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, owner_store_name')
      .eq('auth_id', user.id)
      .maybeSingle()
    setOwnerName(String(profile?.full_name || userRow?.name || '원장님'))
    setSalonName(String(profile?.owner_store_name || userRow?.salon_name || ''))
    const profileId = profile?.id ? String(profile.id) : null
    if (!profileId) {
      setProducts([])
      setCompanies([])
      setPrimaryCompanyId(null)
      setPromoRules([])
      setStockMap({})
      setLoading(false)
      return
    }
    // 1) paid 등급 먼저 → companyIds
    const { data: gradeRows } = await supabase
      .from('brand_owner_grades')
      .select('company_id, grade, tier_package_id, payment_status')
      .eq('owner_id', profileId)
      .eq('origin_track', 'B')
      .eq('payment_status', 'paid')
    const companyIds = Array.from(
      new Set((gradeRows || []).map((g: any) => String(g.company_id || '')).filter(Boolean)),
    )
    setPrimaryCompanyId(companyIds[0] || null)
    if (companyIds.length === 0) {
      setProducts([])
      setCompanies([])
      setPromoRules([])
      setStockMap({})
      setLoading(false)
      return
    }
    // 2) 회사명 조인
    const { data: companyRows } = await supabase
      .from('brand_companies')
      .select('id, name')
      .in('id', companyIds)
    const companyNameById: Record<string, string> = {}
    for (const c of (companyRows || []) as any[]) {
      companyNameById[String(c.id)] = String(c.name || '')
    }
    // 3) 해당 회사들의 brands
    const { data: brandRows } = await supabase
      .from('brands')
      .select('id, name, company_id')
      .in('company_id', companyIds)
    const brandMeta: Record<string, { name: string; company_id: string }> = {}
    const brandIds: string[] = []
    for (const b of (brandRows || []) as any[]) {
      const id = String(b.id || '')
      const cid = String(b.company_id || '')
      if (!id || !cid) continue
      brandIds.push(id)
      brandMeta[id] = { name: String(b.name || ''), company_id: cid }
    }
    if (brandIds.length === 0) {
      setProducts([])
      setCompanies(
        companyIds.map((id) => ({ id, name: companyNameById[id] || id })),
      )
      setPromoRules([])
      setStockMap({})
      setLoading(false)
      return
    }
    // 4) 그 브랜드들의 active 상품만
    const { data: rows } = await supabase
      .from('brand_products')
      .select('id, name, thumb_img, brand_id, supply_price')
      .eq('status', 'active')
      .in('brand_id', brandIds)
      .order('created_at', { ascending: false })
      .limit(200)
    const productList: Product[] = (rows || [])
      .map((p: any) => {
        const brandId = String(p.brand_id || '')
        const meta = brandMeta[brandId]
        if (!meta) return null
        const companyId = meta.company_id
        return {
          id: p.id,
          name: p.name || '',
          thumb_img: p.thumb_img || null,
          brand_id: brandId,
          brand_name: meta.name,
          company_id: companyId,
          company_name: companyNameById[companyId] || companyId,
          supply_price: Math.trunc(Number(p.supply_price) || 0),
        } satisfies Product
      })
      .filter((p): p is Product => p != null)
    setProducts(productList)
    // 상품이 있는 회사만 UI에 노출 (paid 순서 유지)
    const productCompanyIds = new Set(productList.map((p) => p.company_id))
    const companyList = companyIds
      .filter((id) => productCompanyIds.has(id))
      .map((id) => ({ id, name: companyNameById[id] || id }))
    setCompanies(companyList)
    setBrandFilterByCompany((prev) => {
      const next: Record<string, 'all' | string> = {}
      for (const c of companyList) {
        next[c.id] = prev[c.id] ?? 'all'
      }
      return next
    })
    const prodIds = productList.map((p) => p.id)
    if (prodIds.length > 0) {
      const { data: invRows } = await supabase
        .from('brand_inventory')
        .select('product_id, available_stock')
        .in('product_id', prodIds)
      const sMap: Record<string, number> = {}
      for (const r of (invRows || []) as any[]) {
        sMap[String(r.product_id)] = Math.trunc(Number(r.available_stock) || 0)
      }
      setStockMap(sMap)
    } else {
      setStockMap({})
    }
    // 프로모: paid 등급의 tier_package
    const tierPackageIds = Array.from(
      new Set((gradeRows || []).map((g: any) => String(g.tier_package_id || '')).filter(Boolean)),
    )
    if (tierPackageIds.length > 0) {
      const { data: ruleRows } = await supabase
        .from('brand_tier_promo_rules')
        .select('id, brand_id, min_qty, bonus_qty')
        .in('tier_package_id', tierPackageIds)
        .eq('is_active', true)
      setPromoRules(
        (ruleRows || []).map((r: any) => ({
          id: String(r.id),
          brand_id: String(r.brand_id),
          qty: Math.trunc(Number(r.min_qty) || 0),
          bonus_qty: Math.trunc(Number(r.bonus_qty) || 0),
          bonus: null,
          condition: null,
          title: null,
        })),
      )
    } else {
      setPromoRules([])
    }
    setLoading(false)
  }, [router, supabase])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (searchParams.get('paid') === '1') {
      showToast('결제가 완료됐어요')
      setCart([])
      setShowPopup(false)
    }
  }, [searchParams])
  const isSearching = searchQuery.trim().length > 0
  const brandsByCompany = useMemo(() => {
    const m: Record<string, { id: string; name: string }[]> = {}
    for (const p of products) {
      if (!m[p.company_id]) m[p.company_id] = []
      if (!m[p.company_id].some((b) => b.id === p.brand_id)) {
        m[p.company_id].push({ id: p.brand_id, name: p.brand_name || p.brand_id })
      }
    }
    return m
  }, [products])
  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, searchQuery])
  const productsForCompany = (companyId: string) => {
    const filter = brandFilterByCompany[companyId] ?? 'all'
    return products.filter((p) => {
      if (p.company_id !== companyId) return false
      if (filter !== 'all' && p.brand_id !== filter) return false
      return true
    })
  }
  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.product.id === id ? { ...c, qty: Math.max(0, c.qty + delta), selectedPromo: null } : c,
        )
        .filter((c) => c.qty > 0),
    )
  }
  const changeSet = (productId: string, promoId: string, delta: number) => {
    const full = products.find((p) => p.id === productId)
    const promo = promoRules.find((p) => p.id === promoId)
    if (!full || !promo) return
    if (delta > 0 && !hasValidSupplyPrice(full.supply_price)) {
      showToast('가격 미설정 제품이에요')
      return
    }
    const unit = Math.max(1, Math.trunc(promo.qty ?? 1))
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === productId)
      if (ex) {
        const same = ex.selectedPromo?.id === promoId
        const currentSets = same ? Math.max(0, Math.round(ex.qty / unit)) : 0
        const sets = currentSets + delta
        if (sets <= 0) return prev.filter((c) => c.product.id !== productId)
        return prev.map((c) =>
          c.product.id === productId ? { ...c, qty: unit * sets, selectedPromo: promo } : c,
        )
      }
      if (delta <= 0) return prev
      return [...prev, { product: full, qty: unit * delta, selectedPromo: promo }]
    })
  }
  const cartTotal = cart.reduce((s, c) => {
    const line = buildOrderLineItem(c.product, c.qty, promoRules, c.selectedPromo)
    return s + line.line_amount
  }, 0)
  const submitOrder = async () => {
    if (cart.length === 0) {
      showToast('제품을 선택해주세요')
      return
    }
    const unpriced = cart.filter((c) => !hasValidSupplyPrice(c.product.supply_price))
    if (unpriced.length > 0) {
      showToast('가격 미설정 제품이 있어요')
      return
    }
    if (!primaryCompanyId) {
      showToast('회사 정보를 확인할 수 없어요')
      return
    }
    if (cartTotal < 1000) {
      showToast('최소 결제금액은 1,000원이에요')
      return
    }
    setSending(true)
    // 브랜드별로 카트 그룹핑
    const byBrand = new Map<string, typeof cart>()
    for (const c of cart) {
      const bid = c.product.brand_id
      if (!byBrand.has(bid)) byBrand.set(bid, [])
      byBrand.get(bid)!.push(c)
    }
    const lines = Array.from(byBrand.entries()).map(([brandId, rows]) => {
      const lineItems = rows.map((c) => buildOrderLineItem(c.product, c.qty, promoRules, c.selectedPromo))
      const lineAmount = lineItems.reduce((s, i) => s + i.line_amount, 0)
      return {
        brand_id: brandId,
        items: lineItems,
        line_amount: lineAmount,
      }
    })
    try {
      const createRes = await fetch('/api/hq-stock-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: primaryCompanyId,
          lines,
          subtotal: cartTotal,
          final_amount: cartTotal,
          owner_name: ownerName,
          salon_name: salonName,
        }),
      })
      const created = await createRes.json().catch(() => ({}))
      if (!createRes.ok || !created?.order_id) {
        showToast(created.message || '발주 생성 실패')
        return
      }
      const payRes = await fetch('/api/payments/payapp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'hq_stock_order',
          amount: created.final_amount,
          target_id: created.order_id,
        }),
      })
      const pay = await payRes.json().catch(() => ({}))
      if (pay?.ok && pay?.pay_url) {
        window.location.href = pay.pay_url as string
        return
      }
      showToast(pay.error || '결제 생성 실패')
    } finally {
      setSending(false)
    }
  }
  const renderProductGrid = (list: Product[]) => (
    <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {list.map((prod) => {
        const item = cart.find((c) => c.product.id === prod.id)
        const setsByPromoId: Record<string, number> = {}
        for (const p of promoRules.filter((r) => r.brand_id === prod.brand_id)) {
          const unit = Math.max(1, Math.trunc(p.qty ?? 1))
          setsByPromoId[p.id] = item && item.selectedPromo?.id === p.id
            ? Math.max(0, Math.round(item.qty / unit))
            : 0
        }
        return (
          <BrandOrderProductCard
            key={prod.id}
            prod={prod}
            supplyPromos={promoRules.filter((r) => r.brand_id === prod.brand_id)}
            setsByPromoId={setsByPromoId}
            onChangeSet={changeSet}
            stock={stockMap[prod.id]}
          />
        )
      })}
    </div>
  )
  const renderBrandChips = (companyId: string, brands: { id: string; name: string }[]) => {
    if (brands.length <= 1) return null
    const selected = brandFilterByCompany[companyId] ?? 'all'
    return (
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
        <button
          type="button"
          onClick={() => setBrandFilterByCompany((prev) => ({ ...prev, [companyId]: 'all' }))}
          style={{ ...pillStyle(selected === 'all'), flexShrink: 0 }}
        >
          전체
        </button>
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBrandFilterByCompany((prev) => ({ ...prev, [companyId]: b.id }))}
            style={{ ...pillStyle(selected === b.id), flexShrink: 0 }}
          >
            {b.name}
          </button>
        ))}
      </div>
    )
  }
  if (loading || trackAllowed === null) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>
        불러오는 중...
      </div>
    )
  }
  if (!trackAllowed) {
    return (
      <div style={{ background: BG, minHeight: '100vh', padding: 24, color: TEXT }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>본사 재고발주</div>
        <div style={{ fontSize: 9, color: SUB }}>트랙B 원장님만 이용할 수 있어요.</div>
        <DashboardBottomNav role="owner" />
      </div>
    )
  }
  const showCompanyHeaders = companies.length >= 2
  let emptyMessage = false
  if (isSearching) {
    emptyMessage = searchFiltered.length === 0
  } else if (companies.length === 0) {
    emptyMessage = true
  } else {
    emptyMessage = companies.every((c) => productsForCompany(c.id).length === 0)
  }
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 96 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 9, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT }}>←</button>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>본사 재고발주</div>
        <button type="button" onClick={() => router.push('/dashboard/owner/delivery-history')} style={{ marginLeft: 'auto', fontSize: 9, color: '#7B5EA7', background: 'none', border: 'none', cursor: 'pointer' }}>배송이력 보기</button>
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제품명 검색"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 9, boxSizing: 'border-box' }}
        />
      </div>
      {isSearching ? (
        <>
          {renderProductGrid(searchFiltered)}
        </>
      ) : (
        companies.map((company, idx) => {
          const brands = brandsByCompany[company.id] || []
          const list = productsForCompany(company.id)
          return (
            <div key={company.id} style={{ marginBottom: 8 }}>
              {showCompanyHeaders && (
                <div
                  style={{
                    margin: idx === 0 ? '0 16px 10px' : '16px 16px 10px',
                    paddingTop: idx === 0 ? 0 : 12,
                    borderTop: idx === 0 ? 'none' : `1px solid ${BORDER}`,
                    fontSize: 11,
                    fontWeight: 600,
                    color: TEXT,
                  }}
                >
                  {company.name}
                </div>
              )}
              {renderBrandChips(company.id, brands)}
              {renderProductGrid(list)}
            </div>
          )
        })
      )}
      {emptyMessage && (
        <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 9 }}>
          {isSearching ? '검색 결과가 없어요' : '발주 가능 제품이 없어요'}
        </div>
      )}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, padding: '10px 16px', background: 'rgba(255,255,255,0.96)', borderTop: `1px solid ${BORDER}`, zIndex: 50 }}>
          <button
            type="button"
            onClick={() => setShowPopup(true)}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer' }}
          >
            장바구니 {cart.length} · ₩{cartTotal.toLocaleString()}
          </button>
        </div>
      )}
      {showPopup && (
        <div
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget && !sending) setShowPopup(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div style={{ width: '100%', maxHeight: '70vh', overflowY: 'auto', background: '#fff', borderRadius: '16px 16px 0 0', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>발주 확인</div>
              <button type="button" onClick={() => setShowPopup(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: SUB, cursor: 'pointer' }}>✕</button>
            </div>
            {cart.map((item) => {
              const line = buildOrderLineItem(item.product, item.qty, promoRules, item.selectedPromo)
              return (
                <div key={item.product.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: TEXT }}>{item.product.name}</div>
                    <div style={{ fontSize: 9, color: SUB }}>
                      ₩{line.line_amount.toLocaleString()}
                      {line.bonus > 0 ? ` · 🎁 +${line.bonus}개` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => changeQty(item.product.id, -QTY_STEP)} style={qtyBtn}>−</button>
                    <span style={{ fontSize: 9, width: 28, textAlign: 'center' }}>{item.qty}</span>
                    <button type="button" onClick={() => changeQty(item.product.id, QTY_STEP)} style={qtyBtn}>+</button>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 0', fontSize: 11 }}>
              <span style={{ color: SUB }}>합계</span>
              <span style={{ fontWeight: 600, color: PURPLE }}>₩{cartTotal.toLocaleString()}</span>
            </div>

            <button
              type="button"
              disabled={sending}
              onClick={() => void submitOrder()}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: sending ? `${PURPLE}88` : PURPLE, color: '#fff', fontSize: 11, cursor: sending ? 'wait' : 'pointer' }}
            >
              {sending ? '처리 중…' : '결제하기'}
            </button>
          </div>
        </div>
      )}
      <DashboardBottomNav role="owner" />
    </div>
  )
}
function pillStyle(selected: boolean): CSSProperties {
  return {
    fontSize: 9,
    padding: '5px 14px',
    borderRadius: 20,
    border: `0.5px solid ${selected ? PURPLE : BORDER}`,
    background: selected ? `${PURPLE}20` : 'transparent',
    color: selected ? PURPLE : SUB,
    cursor: 'pointer',
  }
}
const qtyBtn: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  background: LIGHT,
  color: TEXT,
  cursor: 'pointer',
}
export default function HqStockOrdersPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>불러오는 중...</div>}>
      <HqStockOrdersContent />
    </Suspense>
  )
}
