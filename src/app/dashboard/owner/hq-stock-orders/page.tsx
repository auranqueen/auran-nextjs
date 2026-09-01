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
import { resolveHqCampaignEffects, type HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'
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
  const [hqForcedCampaigns, setHqForcedCampaigns] = useState<HqForcedCampaign[]>([])
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [cart, setCart] = useState<CartItem[]>([])
  const [showPopup, setShowPopup] = useState(false)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [salonName, setSalonName] = useState('')
  const [brandFilter, setBrandFilter] = useState<'all' | string>('all')
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
        setPrimaryCompanyId(companyIds[0] || null)
        if (companyIds.length > 0) {
          const { data: gradeRows } = await supabase
            .from('brand_owner_grades')
            .select('company_id, grade, tier_package_id, payment_status')
            .eq('owner_id', profileId)
            .eq('origin_track', 'B')
            .eq('payment_status', 'paid')
            .in('company_id', companyIds)
          const gradeByCompany: Record<string, string> = {}
          for (const g of (gradeRows || []) as { company_id?: string; grade?: string }[]) {
            const cid = String(g.company_id || '')
            if (cid) gradeByCompany[cid] = String(g.grade || '취급점')
          }
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
          const { data: campaignRows } = await supabase
            .from('hq_forced_campaigns')
            .select('id, company_id, target_product_ids, start_at, end_at, target_grades')
            .in('company_id', companyIds)
            .is('owner_id', null)
            .eq('is_active', true)
          const filteredCampaignRows = (campaignRows || []).filter((r: {
            target_grades?: string[] | null
            company_id?: string
          }) => {
            const tg = r.target_grades
            if (!tg || !Array.isArray(tg) || tg.length === 0) return true
            const myGrade = gradeByCompany[String(r.company_id || '')] || '취급점'
            return tg.includes(myGrade)
          })
          const campaignIds = filteredCampaignRows.map((r: { id: string }) => r.id)
          const tiersByCampaign: Record<string, HqForcedCampaign['tiers']> = {}
          if (campaignIds.length > 0) {
            const { data: tierRows } = await supabase
              .from('hq_forced_campaign_tiers')
              .select('campaign_id, min_qty, min_amount, discount_pct, discount_amount, fixed_price, gifts, highlight_text')
              .in('campaign_id', campaignIds)
            for (const t of (tierRows || []) as any[]) {
              const cid = String(t.campaign_id)
              if (!tiersByCampaign[cid]) tiersByCampaign[cid] = []
              tiersByCampaign[cid]!.push({
                min_qty: t.min_qty,
                min_amount: t.min_amount ?? null,
                discount_pct: t.discount_pct,
                discount_amount: t.discount_amount,
                fixed_price: t.fixed_price,
                gifts: t.gifts ?? [],
                highlight_text: t.highlight_text,
              })
            }
          }
          setHqForcedCampaigns(
            (filteredCampaignRows as any[]).map((r) => ({ ...r, tiers: tiersByCampaign[String(r.id)] || [] })) as HqForcedCampaign[]
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
  const hqCampaignEffects = resolveHqCampaignEffects(
    cart.map((c) => ({
      product_id: c.product.id,
      qty: c.qty,
      unit_price: buildOrderLineItem(c.product, c.qty, promoRules, c.selectedPromo).unit_price,
    })),
    hqForcedCampaigns,
  )
  const cartFinalTotal = cartTotal - hqCampaignEffects.discountTotal
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
      const giftItemsForBrand = hqCampaignEffects.giftLines
        .filter((g) => {
          if (g.effect_type !== 'gift' || !g.product_id) return false
          const giftBrandId = products.find((p) => p.id === g.product_id)?.brand_id
          if (giftBrandId) return giftBrandId === brandId
          const brandProductIds = new Set(rows.map((c) => c.product.id))
          return brandProductIds.has(g.product_id)
        })
        .map((g) => {
          const pid = String(g.product_id)
          const prod = products.find((p) => p.id === pid)
          return {
            product_id: pid,
            name: prod?.name || g.label,
            qty: g.qty,
            unit_price: 0,
            line_amount: 0,
            bonus: 0,
            promo: g.label,
          }
        })
      const lineAmount = lineItems.reduce((s, i) => s + i.line_amount, 0)
      return {
        brand_id: brandId,
        items: [...lineItems, ...giftItemsForBrand],
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
          final_amount: cartFinalTotal,
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
        {filtered.map((prod) => {
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
            장바구니 {cart.length} · {hqCampaignEffects.discountTotal > 0 && (<span style={{textDecoration:'line-through', opacity:0.5, fontSize:12}}>₩{cartTotal.toLocaleString()}</span>)} <span>₩{cartFinalTotal.toLocaleString()}</span>
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
              <span style={{ fontWeight: 600, color: PURPLE, textDecoration: hqCampaignEffects.discountTotal > 0 ? 'line-through' : undefined, opacity: hqCampaignEffects.discountTotal > 0 ? 0.5 : 1 }}>₩{cartTotal.toLocaleString()}</span>
            </div>
            {hqCampaignEffects.discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e74c3c', marginBottom: 6 }}>
                <span>캠페인 할인</span>
                <span>-{hqCampaignEffects.discountTotal.toLocaleString()}원</span>
              </div>
            )}
            {hqCampaignEffects.giftLines.filter(g => g.effect_type === 'gift').map((g, i) => (
              <div key={i} style={{ fontSize: 13, color: '#7B5EA7', marginBottom: 4 }}>
                {'🎁'} {g.label}
              </div>
            ))}
            {hqCampaignEffects.discountTotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, color: PURPLE, margin: '8px 0 14px' }}>
                <span>최종 결제금액</span>
                <span>₩{cartFinalTotal.toLocaleString()}</span>
              </div>
            )}

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
