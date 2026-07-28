'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import BrandOrderProductCard, { type BrandOrderProduct } from '../brand-orders/BrandOrderProductCard'
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
  supply_price: number
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
  const [promoRules, setPromoRules] = useState<SupplyPromoRow[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [showPopup, setShowPopup] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [salonName, setSalonName] = useState('')
  const [brandFilter, setBrandFilter] = useState<'all' | string>('all')
  const [searchQuery, setSearchQuery] = useState('')
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
    const { data: rows } = await supabase
      .from('brand_products')
      .select('id, name, thumb_img, brand_id, supply_price, brands(name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200)
    const productList = (rows || []).map((p: any) => ({
      id: p.id,
      name: p.name || '',
      thumb_img: p.thumb_img || null,
      brand_id: p.brand_id,
      brand_name: p.brands?.name || '',
      supply_price: Math.trunc(Number(p.supply_price) || 0),
    }))
    setProducts(productList)
    const profileId = profile?.id ? String(profile.id) : null
    if (profileId) {
      const brandIds = Array.from(new Set(productList.map((p) => p.brand_id).filter(Boolean)))
      if (brandIds.length > 0) {
        const { data: brandRows } = await supabase
          .from('brands')
          .select('id, company_id')
          .in('id', brandIds)
        const companyIds = Array.from(
          new Set((brandRows || []).map((b: any) => String(b.company_id || '')).filter(Boolean)),
        )
        if (companyIds.length > 0) {
          const { data: gradeRows } = await supabase
            .from('brand_owner_grades')
            .select('company_id, tier_package_id, payment_status')
            .eq('owner_id', profileId)
            .eq('origin_track', 'B')
            .eq('payment_status', 'paid')
            .in('company_id', companyIds)
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
        } else {
          setPromoRules([])
        }
      } else {
        setPromoRules([])
      }
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
  const brandNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of products) m[p.brand_id] = p.brand_name || p.brand_id
    return m
  }, [products])
  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (brandFilter !== 'all' && p.brand_id !== brandFilter) return false
      const q = searchQuery.trim().toLowerCase()
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, brandFilter, searchQuery])
  const cartQty = (id: string) => cart.find((c) => c.product.id === id)?.qty || 0
  const addToCart = (prod: BrandOrderProduct) => {
    if (!hasValidSupplyPrice(prod.supply_price)) {
      showToast('가격 미설정 제품이에요')
      return
    }
    const full = products.find((p) => p.id === prod.id)
    if (!full) return
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === prod.id)
      if (ex) {
        return prev.map((c) =>
          c.product.id === prod.id ? { ...c, qty: c.qty + QTY_STEP, selectedPromo: null } : c,
        )
      }
      return [...prev, { product: full, qty: QTY_STEP, selectedPromo: null }]
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
    const brandIds = Array.from(new Set(cart.map((c) => c.product.brand_id)))
    if (brandIds.length !== 1) {
      showToast('한 번에 한 브랜드만 발주할 수 있어요')
      return
    }
    if (cartTotal < 1000) {
      showToast('최소 결제금액은 1,000원이에요')
      return
    }
    setSending(true)
    const items = cart.map((c) => buildOrderLineItem(c.product, c.qty, promoRules, c.selectedPromo))
    try {
      const createRes = await fetch('/api/hq-stock-orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandIds[0],
          items,
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
        <div style={{ fontSize: 16, marginBottom: 8 }}>본사 재고발주</div>
        <div style={{ fontSize: 13, color: SUB }}>트랙B 원장님만 이용할 수 있어요.</div>
        <DashboardBottomNav role="owner" />
      </div>
    )
  }
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 96 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>본사 재고발주</div>
        <button type="button" onClick={() => router.push('/dashboard/owner/delivery-history')} style={{ marginLeft: 'auto', fontSize: 12, color: '#7B5EA7', background: 'none', border: 'none', cursor: 'pointer' }}>배송이력 보기</button>
      </div>
      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setBrandFilter('all')}
          style={pillStyle(brandFilter === 'all')}
        >
          전체
        </button>
        {Object.entries(brandNames).map(([id, name]) => (
          <button key={id} type="button" onClick={() => setBrandFilter(id)} style={pillStyle(brandFilter === id)}>
            {name}
          </button>
        ))}
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제품 검색"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {filtered.map((prod) => (
          <BrandOrderProductCard
            key={prod.id}
            prod={prod}
            supplyPromos={promoRules.filter((r) => r.brand_id === prod.brand_id)}
            qty={cartQty(prod.id)}
            activePromoId={undefined}
            onApplyPromo={() => {}}
            onAdd={addToCart}
            onChangeQty={changeQty}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: SUB, fontSize: 13 }}>발주 가능 제품이 없어요</div>
      )}
      {cart.length > 0 && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 64, padding: '10px 16px', background: 'rgba(255,255,255,0.96)', borderTop: `1px solid ${BORDER}`, zIndex: 50 }}>
          <button
            type="button"
            onClick={() => setShowPopup(true)}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}
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
              <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>발주 확인</div>
              <button type="button" onClick={() => setShowPopup(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: SUB, cursor: 'pointer' }}>✕</button>
            </div>
            {cart.map((item) => {
              const line = buildOrderLineItem(item.product, item.qty, promoRules, item.selectedPromo)
              return (
                <div key={item.product.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: TEXT }}>{item.product.name}</div>
                    <div style={{ fontSize: 11, color: SUB }}>
                      ₩{line.line_amount.toLocaleString()}
                      {line.bonus > 0 ? ` · 🎁 +${line.bonus}개` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" onClick={() => changeQty(item.product.id, -QTY_STEP)} style={qtyBtn}>−</button>
                    <span style={{ fontSize: 13, width: 28, textAlign: 'center' }}>{item.qty}</span>
                    <button type="button" onClick={() => changeQty(item.product.id, QTY_STEP)} style={qtyBtn}>+</button>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '14px 0', fontSize: 14 }}>
              <span style={{ color: SUB }}>합계</span>
              <span style={{ fontWeight: 600, color: PURPLE }}>₩{cartTotal.toLocaleString()}</span>
            </div>
            <button
              type="button"
              disabled={sending}
              onClick={() => void submitOrder()}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: sending ? `${PURPLE}88` : PURPLE, color: '#fff', fontSize: 14, cursor: sending ? 'wait' : 'pointer' }}
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
    fontSize: 12,
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
