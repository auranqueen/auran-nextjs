'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
interface Product {
  id: string
  name: string
  thumb_img: string | null
  brand_name: string
  brand_id: string
  status: string
}
interface CartItem {
  product: Product
  qty: number
}
interface Order {
  id: string
  brand_name: string
  status: string
  items: Array<{ name: string; qty: number }>
  promo_applied: string | null
  points_earned: number
  created_at: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
}
const GRADE_PROMOS: Record<string, { promos: string[]; point: number }> = {
  '메디슈티컬': { promos: ['10+10', '10+5'], point: 3 },
  '프리미엄전문점': { promos: ['10+5', '10+4'], point: 2 },
  '전문점': { promos: ['10+3', '5+5'], point: 1.5 },
  '취급점': { promos: ['10+1', '5+1'], point: 1 },
}
function getPromo(grade: string, qty: number): string {
  const g = GRADE_PROMOS[grade]
  if (!g) return ''
  if (qty >= 10) return g.promos[0]
  if (qty >= 5 && g.promos[1]?.includes('5+')) return g.promos[1]
  return ''
}
function getBonus(promo: string): number {
  if (!promo) return 0
  const parts = promo.split('+')
  return parseInt(parts[1] || '0')
}
export default function BrandOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [grade, setGrade] = useState('취급점')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showPopup, setShowPopup] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<'shop' | 'orders'>('shop')
  const [ownerName, setOwnerName] = useState('')
  const [salonName, setSalonName] = useState('')
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login?role=owner'); return }
    const [{ data: prof }, { data: ownerProf }] = await Promise.all([
      supabase.from('users').select('id, name, store_name').eq('auth_id', user.id).maybeSingle(),
      supabase.from('profiles').select('id, grade, arete_member, trade_brands, preferred_brands, owner_store_name, full_name').eq('auth_id', user.id).maybeSingle(),
    ])
    setOwnerName((ownerProf as any)?.full_name || (prof as any)?.name || '')
    setSalonName((ownerProf as any)?.owner_store_name || (prof as any)?.store_name || '')
    setOwnerProfileId((ownerProf as any)?.id || null)
    if (!(ownerProf as any)?.id) {
      showToast('프로필 정보를 불러올 수 없어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }
    const profileId = (ownerProf as any).id as string
    const g = (ownerProf as any)?.grade || '취급점'
    setGrade(g)
    const tradeBrands: string[] = Array.isArray((ownerProf as any)?.trade_brands) && (ownerProf as any).trade_brands.length > 0
      ? (ownerProf as any).trade_brands
      : (Array.isArray((ownerProf as any)?.preferred_brands) ? (ownerProf as any).preferred_brands : [])
    if (tradeBrands.length > 0) {
      const { data: brandRows } = await supabase
        .from('brands')
        .select('id, name')
        .in('name', tradeBrands)
      if (brandRows && brandRows.length > 0) {
        const brandIds = brandRows.map((b: any) => b.id)
        const { data: prodRows } = await supabase
          .from('products')
          .select('id, name, thumb_img, brands(name)')
          .in('brand_id', brandIds)
          .eq('status', 'active')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (prodRows) {
          setProducts(prodRows.map((p: any) => ({
            id: p.id,
            name: p.name || '',
            thumb_img: p.thumb_img || null,
            brand_name: p.brands?.name || '',
            brand_id: brandIds[0],
            status: p.status,
          })))
        }
      }
    }
    const { data: orderRows } = await supabase
      .from('brand_orders')
      .select('id, brand_id, status, items, promo_applied, points_earned, created_at, courier, tracking_no, shipped_at, brands(name)')
      .eq('profile_id', profileId || '')
      .order('created_at', { ascending: false })
      .limit(20)
    if (orderRows) {
      setOrders(orderRows.map((o: any) => ({
        id: o.id,
        brand_name: o.brands?.name || '',
        status: o.status,
        items: Array.isArray(o.items) ? o.items : [],
        promo_applied: o.promo_applied,
        points_earned: o.points_earned || 0,
        created_at: o.created_at,
        courier: o.courier || null,
        tracking_no: o.tracking_no || null,
        shipped_at: o.shipped_at || null,
      })))
    }
    setLoading(false)
  }, [router])
  useEffect(() => { void load() }, [load])
  const brandGroups = products.reduce((acc, p) => {
    if (!acc[p.brand_name]) acc[p.brand_name] = []
    acc[p.brand_name].push(p)
    return acc
  }, {} as Record<string, Product[]>)
  const addToCart = (prod: Product) => {
    setCart(prev => {
      const ex = prev.find(c => c.product.id === prod.id)
      if (ex) return prev.map(c => c.product.id === prod.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { product: prod, qty: 1 }]
    })
  }
  const changeQty = (id: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.product.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c)
      .filter(c => c.qty > 0))
  }
  const totalQty = cart.reduce((s, c) => s + c.qty, 0)
  const openPopup = (brand: string) => {
    setSelectedBrand(brand)
    setShowPopup(true)
  }
  const closePopup = () => {
    setShowPopup(false)
    setSelectedBrand(null)
  }
  const submitOrder = async () => {
    if (cart.length === 0) { showToast('제품을 선택해주세요'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { showToast('로그인이 필요합니다'); return }
    setSending(true)
    const cartBrandName = selectedBrand || cart[0]?.product.brand_name || ''
    const { data: brandRow } = await supabase
      .from('brands')
      .select('id')
      .eq('name', cartBrandName)
      .maybeSingle()
    if (!brandRow) { showToast('브랜드 정보를 찾을 수 없습니다'); setSending(false); return }
    const items = cart
      .filter(c => !selectedBrand || c.product.brand_name === selectedBrand)
      .map(c => {
        const promo = getPromo(grade, c.qty)
        const bonus = getBonus(promo)
        return { name: c.product.name, qty: c.qty, bonus, promo }
      })
    const totalItems = items.reduce((s, i) => s + i.qty, 0)
    const promoApplied = items.map(i => i.promo).filter(Boolean).join(', ') || null
    const pointsEarned = Math.floor(totalItems * (GRADE_PROMOS[grade]?.point || 1))
    const { error } = await supabase.from('brand_orders').insert({
      brand_id: brandRow.id,
      profile_id: ownerProfileId || '',
      owner_name: ownerName,
      salon_name: salonName,
      grade,
      status: 'pending',
      items: items.map(i => ({ name: i.name, qty: i.qty, bonus: i.bonus, promo: i.promo })),
      total_qty: totalItems,
      promo_applied: promoApplied,
      points_earned: pointsEarned,
    })
    if (!error) {
      await supabase.from('brand_messages').insert({
        brand_id: brandRow.id,
        message_type: 'auto_order',
        target_type: 'all',
        title: `${ownerName} 원장님 발주 접수`,
        body: `${ownerName} 원장님(${salonName})이 발주를 요청했습니다. ${items.map(i => `${i.name} ${i.qty}ea`).join(', ')}`,
        send_count: 1,
      })
      setCart([])
      closePopup()
      showToast('발주 요청 완료!')
      void load()
      setTab('orders')
    } else {
      showToast('발주 실패: ' + error.message)
    }
    setSending(false)
  }
  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending:   { label: '대기중',   color: '#A07830', bg: '#FBF5E8' },
    approved:  { label: '승인됨',   color: '#1E6B40', bg: '#EAF5EE' },
    shipping:  { label: '배송중',   color: '#185FA5', bg: '#E6F1FB' },
    done:      { label: '완료',     color: '#888888', bg: '#F5F5F5' },
    cancelled: { label: '취소',     color: '#C0392B', bg: '#FAEAEA' },
  }
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금 전'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  if (loading) return <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>불러오는 중...</div>
  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>
      )}
      {/* 헤더 */}
      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>브랜드 발주</div>
        {totalQty > 0 && (
          <div style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 12px', borderRadius: 20, background: PURPLE, color: '#fff', cursor: 'pointer' }} onClick={() => setShowPopup(true)}>
            장바구니 {totalQty}개
          </div>
        )}
      </div>
      {/* 등급 표시 */}
      <div style={{ padding: '8px 16px 12px' }}>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${PURPLE}15`, color: PURPLE, border: `0.5px solid ${PURPLE}40` }}>
          {grade} · 적립 {GRADE_PROMOS[grade]?.point || 1}%
        </span>
      </div>
      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 16 }}>
        {(['shop', 'orders'] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px', fontSize: 13, border: 'none', background: 'none', color: tab === t ? PURPLE : SUB, borderBottom: tab === t ? `2px solid ${PURPLE}` : '2px solid transparent', cursor: 'pointer' }}>
            {t === 'shop' ? '브랜드 제품' : `발주 내역 (${orders.length})`}
          </button>
        ))}
      </div>
      {tab === 'shop' && (
        <div style={{ padding: '0 16px' }}>
          {Object.keys(brandGroups).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>
              거래 브랜드 제품이 없어요.<br />
              <span style={{ fontSize: 12 }}>원장님 프로필에서 거래 브랜드를 설정해주세요</span>
            </div>
          ) : (
            Object.entries(brandGroups).map(([brandName, prods]) => (
              <div key={brandName} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{brandName}</div>
                  {cart.filter(c => c.product.brand_name === brandName).length > 0 && (
                    <button type="button" onClick={() => openPopup(brandName)}
                      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: `1px solid ${PURPLE}`, background: `${PURPLE}15`, color: PURPLE, cursor: 'pointer' }}>
                      발주하기 ({cart.filter(c => c.product.brand_name === brandName).reduce((s, c) => s + c.qty, 0)}개)
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {prods.map(prod => {
                    const cartItem = cart.find(c => c.product.id === prod.id)
                    const qty = cartItem?.qty || 0
                    const promo = getPromo(grade, qty)
                    return (
                      <div key={prod.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ height: 80, background: LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {prod.thumb_img
                            ? <img src={prod.thumb_img} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 26 }}>🧴</span>}
                        </div>
                        <div style={{ padding: '8px' }}>
                          <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{prod.name}</div>
                          {promo && <div style={{ fontSize: 10, color: PURPLE, marginBottom: 4 }}>{promo}</div>}
                          {qty === 0 ? (
                            <button type="button" onClick={() => addToCart(prod)}
                              style={{ width: '100%', padding: '5px', borderRadius: 6, border: `1px solid ${PURPLE}`, background: `${PURPLE}15`, color: PURPLE, fontSize: 11, cursor: 'pointer' }}>
                              + 담기
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <button type="button" onClick={() => changeQty(prod.id, -1)}
                                style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${BORDER}`, background: LIGHT, fontSize: 14, cursor: 'pointer', color: TEXT }}>−</button>
                              <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{qty}</span>
                              <button type="button" onClick={() => changeQty(prod.id, 1)}
                                style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      {tab === 'orders' && (
        <div style={{ padding: '0 16px' }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: SUB, fontSize: 14 }}>발주 내역이 없어요</div>
          ) : (
            orders.map((o, i) => {
              const st = STATUS_MAP[o.status] || { label: o.status, color: SUB, bg: '#F5F5F5' }
              return (
                <div key={o.id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{o.brand_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: SUB }}>{timeAgo(o.created_at)}</span>
                      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: SUB, marginBottom: 4 }}>
                    {o.items.map(it => `${it.name} ${it.qty}ea`).join(' · ')}
                  </div>
                  {o.promo_applied && <div style={{ fontSize: 11, color: PURPLE }}>{o.promo_applied} 적용</div>}
                  {o.points_earned > 0 && <div style={{ fontSize: 11, color: '#1E6B40', marginTop: 2 }}>+{o.points_earned}T 적립 예정</div>}
                  {o.tracking_no && (
                    <div style={{ fontSize: 11, color: '#185FA5', marginTop: 4, padding: '4px 8px', background: '#E6F1FB', borderRadius: 6, display: 'inline-block' }}>
                      📦 {o.courier} {o.tracking_no}
                      {o.shipped_at && <span style={{ color: '#888', marginLeft: 6 }}>{new Date(o.shipped_at).toLocaleDateString('ko-KR')} 발송</span>}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
      {/* 발주 팝업 */}
      {showPopup && (
        <div
          ref={overlayRef}
          onClick={e => { if (e.target === overlayRef.current) closePopup() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>발주 확인</div>
              <button type="button" onClick={closePopup}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: SUB, lineHeight: 1 }}>✕</button>
            </div>
            {cart.filter(c => !selectedBrand || c.product.brand_name === selectedBrand).map(item => {
              const promo = getPromo(grade, item.qty)
              const bonus = getBonus(promo)
              return (
                <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ width: 44, height: 44, background: LIGHT, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {item.product.thumb_img
                      ? <img src={item.product.thumb_img} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                      : <span style={{ fontSize: 20 }}>🧴</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>{item.product.name}</div>
                    {promo && <div style={{ fontSize: 11, color: PURPLE }}>{promo} → +{bonus}개 증정</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => changeQty(item.product.id, -1)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`, background: LIGHT, fontSize: 14, cursor: 'pointer', color: TEXT }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 500, minWidth: 20, textAlign: 'center', color: TEXT }}>{item.qty}</span>
                    <button type="button" onClick={() => changeQty(item.product.id, 1)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}>+</button>
                  </div>
                </div>
              )
            })}
            <div style={{ padding: '12px 0', borderBottom: `1px solid ${BORDER}`, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB, marginBottom: 4 }}>
                <span>등급</span><span style={{ color: PURPLE }}>{grade}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB }}>
                <span>적립 예정 포인트</span>
                <span style={{ color: '#1E6B40' }}>{GRADE_PROMOS[grade]?.point || 1}% (시바산 제품 구매 시 사용)</span>
              </div>
            </div>
            <button type="button" onClick={submitOrder} disabled={sending}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: sending ? `${PURPLE}80` : PURPLE, color: '#fff', fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {sending ? '발주 요청 중...' : '발주 요청하기'}
            </button>
          </div>
        </div>
      )}
      <DashboardBottomNav role="salon" />
    </div>
  )
}
