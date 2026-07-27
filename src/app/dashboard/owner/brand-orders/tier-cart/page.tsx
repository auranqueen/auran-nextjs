'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
const PURPLE = '#7B5EA7'
const BG = '#ffffff'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
type TierPkg = { id: string; company_id: string; tier_name: string; price: number }
type BrandOpt = { id: string; name: string }
type CatalogItem = { id: string; brand_id: string; name: string; supply_price: number; thumb_img: string | null }
type KitItem = { id: string; item_name: string; item_type: string; qty: number }
function TierCartContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const tierPackageId = searchParams.get('tier_package_id') || ''
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [pkg, setPkg] = useState<TierPkg | null>(null)
  const [brands, setBrands] = useState<BrandOpt[]>([])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [kitItems, setKitItems] = useState<KitItem[]>([])
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const showToast = (t: string) => {
    setToast(t)
    setTimeout(() => setToast(''), 2500)
  }
  const load = useCallback(async () => {
    if (!tierPackageId) return
    setLoading(true)
    try {
      const { data: pkgRow } = await supabase
        .from('brand_tier_packages')
        .select('id, company_id, tier_name, price')
        .eq('id', tierPackageId)
        .maybeSingle()
      if (!pkgRow?.company_id) {
        showToast('등급 정보를 찾을 수 없어요')
        return
      }
      setPkg(pkgRow as TierPkg)
      const { data: brandRows } = await supabase
        .from('brands')
        .select('id, name')
        .eq('company_id', pkgRow.company_id)
      setBrands((brandRows || []) as BrandOpt[])
      const brandIds = (brandRows || []).map((b: { id: string }) => b.id)
      const { data: catalogRows } = await supabase
        .from('brand_products')
        .select('id, brand_id, name, supply_price, thumb_img')
        .in('brand_id', brandIds.length ? brandIds : ['00000000-0000-0000-0000-000000000000'])
        .eq('is_tier_catalog', true)
        .eq('status', 'active')
      setCatalog((catalogRows || []) as CatalogItem[])
      const { data: kitRows } = await supabase
        .from('brand_tier_kit_items')
        .select('id, item_name, item_type, qty')
        .eq('tier_package_id', tierPackageId)
        .eq('is_active', true)
      setKitItems((kitRows || []) as KitItem[])
    } finally {
      setLoading(false)
    }
  }, [tierPackageId, supabase])
  useEffect(() => {
    void load()
  }, [load])
  const brandName = (id: string) => brands.find((b) => b.id === id)?.name || ''
  const filteredCatalog = useMemo(() => {
    return catalog.filter((c) => {
      if (brandFilter && c.brand_id !== brandFilter) return false
      if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [catalog, brandFilter, search])
  const total = useMemo(() => {
    return catalog.reduce((sum, c) => sum + (cart[c.id] || 0) * Math.trunc(Number(c.supply_price)), 0)
  }, [catalog, cart])
  const minAmount = pkg ? Math.trunc(Number(pkg.price)) : 0
  const remaining = Math.max(0, minAmount - total)
  const canCheckout = total >= minAmount && total > 0
  const setQty = (itemId: string, qty: number) => {
    setCart((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[itemId]
      else next[itemId] = qty
      return next
    })
  }
  const checkout = async () => {
    if (!pkg || !canCheckout) return
    setBusy(true)
    try {
      const items = Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([product_id, qty]) => ({ product_id, qty }))
      const res = await fetch('/api/payments/brand-self/civasan/tier-cart-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ tier_package_id: pkg.id, items }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok && json?.pay_url) {
        window.location.href = json.pay_url as string
        return
      }
      if (json?.ok && json?.demo) {
        showToast('결제가 완료됐어요(데모)')
        router.push('/dashboard/owner')
        return
      }
      showToast(json?.error || '결제 요청 실패')
    } finally {
      setBusy(false)
    }
  }
  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>
        불러오는 중...
      </div>
    )
  }
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 160 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>
          {toast}
        </div>
      )}
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>{pkg?.tier_name} 등급 구매</div>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 12, color: SUB }}>
        카탈로그에서 자유롭게 담아주세요. {minAmount.toLocaleString()}원 이상 담으면 결제할 수 있어요.
      </div>
      <div style={{ padding: '0 16px 12px' }}>
        <input
          type="text"
          placeholder="제품명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setBrandFilter(null)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1px solid ${!brandFilter ? PURPLE : BORDER}`, background: !brandFilter ? 'rgba(123,94,167,0.12)' : 'transparent', color: !brandFilter ? PURPLE : SUB, cursor: 'pointer' }}>전체</button>
          {brands.map((b) => (
            <button key={b.id} type="button" onClick={() => setBrandFilter(b.id)} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, border: `1px solid ${brandFilter === b.id ? PURPLE : BORDER}`, background: brandFilter === b.id ? 'rgba(123,94,167,0.12)' : 'transparent', color: brandFilter === b.id ? PURPLE : SUB, cursor: 'pointer' }}>{b.name}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 16px' }}>
        {filteredCatalog.map((item) => {
          const qty = cart[item.id] || 0
          const lineAmount = qty * Math.trunc(Number(item.supply_price))
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
              {item.thumb_img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumb_img} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: LIGHT, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: TEXT }}>{item.name}</div>
                <div style={{ fontSize: 11, color: SUB, marginTop: 1 }}>{brandName(item.brand_id)} · {Math.trunc(item.supply_price).toLocaleString()}원</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '2px 4px' }}>
                <button type="button" onClick={() => setQty(item.id, qty - 1)} style={{ width: 24, height: 24, border: 'none', background: 'none', fontSize: 14, cursor: 'pointer' }}>-</button>
                <span style={{ fontSize: 13, minWidth: 16, textAlign: 'center' }}>{qty}</span>
                <button type="button" onClick={() => setQty(item.id, qty + 1)} style={{ width: 24, height: 24, border: 'none', background: 'none', fontSize: 14, cursor: 'pointer' }}>+</button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, minWidth: 80, textAlign: 'right', color: TEXT }}>{lineAmount.toLocaleString()}원</div>
            </div>
          )
        })}
        {kitItems.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, color: SUB, marginBottom: 8 }}>이 등급 구매시 아래 구성품이 함께 지급돼요 (선택 불가, 금액에 포함 안됨)</div>
            {kitItems.map((k) => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: LIGHT, borderRadius: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 13, flex: 1, color: TEXT }}>{k.item_name} ({k.item_type})</span>
                <span style={{ fontSize: 11, color: SUB }}>수량 {k.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${BORDER}`, padding: 16, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span style={{ color: SUB }}>담은 금액</span>
          <span style={{ fontWeight: 600 }}>{total.toLocaleString()}원</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
          <span style={{ color: SUB }}>최소 필요금액</span>
          <span style={{ color: SUB }}>{minAmount.toLocaleString()}원 이상</span>
        </div>
        {!canCheckout && (
          <div style={{ fontSize: 12, color: '#c9822a', marginBottom: 10 }}>{remaining.toLocaleString()}원 더 담아야 결제할 수 있어요</div>
        )}
        <button
          type="button"
          disabled={!canCheckout || busy}
          onClick={() => void checkout()}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: canCheckout ? PURPLE : 'rgba(123,94,167,0.35)', color: '#fff', fontSize: 14, fontWeight: 500, cursor: canCheckout ? 'pointer' : 'not-allowed', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? '처리 중…' : '결제하기'}
        </button>
      </div>
      <DashboardBottomNav role="owner" />
    </div>
  )
}
export default function TierCartPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>불러오는 중...</div>}>
      <TierCartContent />
    </Suspense>
  )
}
