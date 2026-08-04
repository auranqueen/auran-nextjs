'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import BrandOrderProductCard, { type BrandOrderProduct } from './BrandOrderProductCard'
import {
  buildOrderLineItem,
  calcPointsEarned,
  gradePointRate,
  hasValidSupplyPrice,
  promoLabel,
  type SupplyPromoRow,
} from '@/lib/brand/brandOrderPromos'
import { useBrandGradeRates } from '@/lib/brand/useBrandGradeRates'
import { resolveOwnerIds } from '@/lib/brand/resolveOwnerIds'
import { submitOrderBatch } from '@/lib/brand/submitOrderBatch'
import { resolveHqCampaignEffects, type HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'

const BG = '#ffffff'
const PURPLE = '#7B5EA7'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const SUB = '#888888'
const LIGHT = '#f8f7fc'
const QTY_STEP = 5
const DEFAULT_GRADE = '취급점'

interface Product {
  id: string
  name: string
  thumb_img: string | null
  brand_name: string
  brand_id: string
  supply_price: number
  status: string
}

interface CartItem {
  product: Product
  qty: number
  selectedPromo: SupplyPromoRow | null
}

interface OrderItem {
  name: string
  qty: number
  unit_price?: number
  line_amount?: number
  bonus?: number
  promo?: string
}

function formatOrderItemLine(it: OrderItem): string {
  const bonus = Math.trunc(Number(it.bonus) || 0)
  return `${it.name} ${it.qty}ea${bonus > 0 ? ` (+${bonus} 증정)` : ''}`
}

function gradeForBrand(gradeByBrandId: Record<string, string>, brandId: string | null | undefined): string {
  if (!brandId) return DEFAULT_GRADE
  return gradeByBrandId[brandId] || DEFAULT_GRADE
}

function promosForBrandGrade(
  promos: SupplyPromoRow[],
  brandId: string,
  grade: string,
): SupplyPromoRow[] {
  return promos
    .filter((p) => p.brand_id === brandId && (p.condition || '') === grade)
    .sort((a, b) => (a.qty ?? 0) - (b.qty ?? 0))
}

function matchesProductSearch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return name.toLowerCase().includes(q)
}

function displayBrandName(name: string): string {
  return name === '시바산그룹' ? '시바산' : name
}

function brandPillStyle(selected: boolean): CSSProperties {
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

function brandPillCountStyle(selected: boolean): CSSProperties {
  return {
    marginLeft: 5,
    color: selected ? PURPLE : '#7B5EA7',
    fontWeight: 700,
  }
}

interface Order {
  id: string
  brand_id: string | null
  brand_name: string
  status: string
  items: OrderItem[]
  promo_applied: string | null
  points_earned: number
  total_amount: number
  created_at: string
  courier: string | null
  tracking_no: string | null
  shipped_at: string | null
}

export default function BrandOrdersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [supplyPromos, setSupplyPromos] = useState<SupplyPromoRow[]>([])
  const [hqForcedCampaigns, setHqForcedCampaigns] = useState<HqForcedCampaign[]>([])
  const [gradeByBrandId, setGradeByBrandId] = useState<Record<string, string>>({})
  const [linkedBrandIds, setLinkedBrandIds] = useState<string[]>([])
  const [linkedBrandNames, setLinkedBrandNames] = useState<Record<string, string>>({})
  const [brandFilter, setBrandFilter] = useState<'all' | string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [showPopup, setShowPopup] = useState(false)
  const [sending, setSending] = useState(false)
  const [returnPopup, setReturnPopup] = useState<{ open: boolean; order: Order | null }>({ open: false, order: null })
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return')
  const [returnReason, setReturnReason] = useState('')
  const [returnDetail, setReturnDetail] = useState('')
  const [returnQty, setReturnQty] = useState(1)
  const [returnPhotos, setReturnPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [returnSaving, setReturnSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<'shop' | 'orders'>('shop')
  const [ownerName, setOwnerName] = useState('')
  const [salonName, setSalonName] = useState('')
  const [ownerProfileId, setOwnerProfileId] = useState<string | null>(null)
  const [trackAllowed, setTrackAllowed] = useState<boolean | null>(null)
  const [productGridCols, setProductGridCols] = useState(3)
  const overlayRef = useRef<HTMLDivElement>(null)

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login?role=owner'); return }

    const [{ data: userRow }, ownerIds] = await Promise.all([
      supabase.from('users').select('id, name, salon_name, origin_track, role').eq('auth_id', user.id).maybeSingle(),
      resolveOwnerIds(supabase, user.id),
    ])

    const { data: ownerProf } = await supabase
      .from('profiles')
      .select('id, owner_store_name, full_name')
      .eq('auth_id', user.id)
      .maybeSingle()

    setOwnerName((ownerProf as { full_name?: string } | null)?.full_name || (userRow as { name?: string } | null)?.name || '')
    setSalonName(
      (ownerProf as { owner_store_name?: string } | null)?.owner_store_name
      || (userRow as { salon_name?: string } | null)?.salon_name
      || '',
    )
    setOwnerProfileId(ownerIds?.profileId ?? null)

    const originTrack = String((userRow as { origin_track?: string } | null)?.origin_track || 'B')
    if (originTrack !== 'A') {
      setTrackAllowed(false)
      setProducts([])
      setSupplyPromos([])
      setOrders([])
      setGradeByBrandId({})
      setLinkedBrandIds([])
      setLinkedBrandNames({})
      setBrandFilter('all')
      setSearchQuery('')
      setLoading(false)
      return
    }
    setTrackAllowed(true)

    const ownerUserId = ownerIds?.userId ?? (userRow as { id?: string } | null)?.id ?? null
    if (!ownerUserId || !ownerIds?.profileId) {
      showToast('프로필 정보를 불러올 수 없어요. 다시 시도해주세요.')
      setLoading(false)
      return
    }

    const profileId = ownerIds.profileId

    const { data: linkRows } = await supabase
      .from('brand_owner_links')
      .select('brand_id')
      .eq('owner_id', ownerUserId)
      .eq('status', 'active')

    const brandIds = Array.from(
      new Set((linkRows || []).map((r: { brand_id: string }) => String(r.brand_id)).filter(Boolean)),
    )
    setLinkedBrandIds(brandIds)

    let brandNameMap: Record<string, string> = {}
    const brandCompanyMap: Record<string, string> = {}
    if (brandIds.length > 0) {
      const { data: brandRows } = await supabase
        .from('brands')
        .select('id, name, company_id')
        .in('id', brandIds)
      for (const row of brandRows || []) {
        const rid = String((row as { id: string }).id)
        brandNameMap[rid] = String((row as { name?: string }).name || '브랜드')
        const cid = (row as { company_id?: string | null }).company_id
        if (cid) brandCompanyMap[rid] = String(cid)
      }
    }
    setLinkedBrandNames(brandNameMap)
    let gradeMap: Record<string, string> = {}
    const tierPackageByCompany: Record<string, string> = {}
    const gradeByCompanyOuter: Record<string, string> = {}
    const companyIdsForGrade = Array.from(new Set(Object.values(brandCompanyMap)))
    if (companyIdsForGrade.length > 0) {
      const { data: gradeRows } = await supabase
        .from('brand_owner_grades')
        .select('company_id, grade, tier_package_id, payment_status')
        .eq('owner_id', profileId)
        .eq('origin_track', 'A')
        .eq('payment_status', 'paid')
        .in('company_id', companyIdsForGrade)
      for (const row of gradeRows || []) {
        const cid = String((row as { company_id: string }).company_id)
        const g = String((row as { grade?: string }).grade || DEFAULT_GRADE)
        gradeByCompanyOuter[cid] = g
        const tpid = (row as { tier_package_id?: string | null }).tier_package_id
        if (tpid) tierPackageByCompany[cid] = String(tpid)
      }
      for (const bid of brandIds) {
        const cid = brandCompanyMap[bid]
        if (cid && gradeByCompanyOuter[cid]) gradeMap[bid] = gradeByCompanyOuter[cid]
      }
    }
    setGradeByBrandId(gradeMap)
    // HQ 강제이벤트 조회 (본사 강제노출, owner_id is null, 활성+기간내)
    let hqCampaigns: HqForcedCampaign[] = []
    if (companyIdsForGrade.length > 0) {
      const { data: campaignRows } = await supabase
        .from('hq_forced_campaigns')
        .select('id, company_id, target_product_ids, start_at, end_at')
        .in('company_id', companyIdsForGrade)
        .is('owner_id', null)
        .eq('is_active', true)
      const campaignIds = (campaignRows || []).map((r: { id: string }) => r.id)
      const tiersByCampaign: Record<string, HqForcedCampaign['tiers']> = {}
      if (campaignIds.length > 0) {
        const { data: tierRows } = await supabase
          .from('hq_forced_campaign_tiers')
          .select('campaign_id, min_qty, discount_pct, discount_amount, fixed_price, gifts, highlight_text')
          .in('campaign_id', campaignIds)
        for (const t of (tierRows || []) as {
          campaign_id: string
          min_qty: number
          discount_pct: number | null
          discount_amount: number | null
          fixed_price: number | null
          gifts: { product_id: string; qty: number }[] | null
          highlight_text: string | null
        }[]) {
          const cid = String(t.campaign_id)
          if (!tiersByCampaign[cid]) tiersByCampaign[cid] = []
          tiersByCampaign[cid]!.push({
            min_qty: t.min_qty,
            discount_pct: t.discount_pct,
            discount_amount: t.discount_amount,
            fixed_price: t.fixed_price,
            gifts: t.gifts ?? [],
            highlight_text: t.highlight_text,
          })
        }
      }
      hqCampaigns = ((campaignRows || []) as any[]).map((r) => ({
        ...r,
        tiers: tiersByCampaign[String(r.id)] || [],
      })) as HqForcedCampaign[]
    }
    setHqForcedCampaigns(hqCampaigns)

    if (brandIds.length > 0) {
      const tierPackageIds = Array.from(new Set(Object.values(tierPackageByCompany)))
      const gradeByTierPackage: Record<string, string> = {}
      for (const cid of Object.keys(tierPackageByCompany)) {
        gradeByTierPackage[tierPackageByCompany[cid]] = gradeByCompanyOuter[cid] || DEFAULT_GRADE
      }
      const [{ data: prodRows }, { data: promoRuleRows }] = await Promise.all([
        supabase
          .from('brand_products')
          .select('id, name, thumb_img, brand_id, supply_price, brands(name)')
          .in('brand_id', brandIds)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        tierPackageIds.length > 0
          ? supabase
              .from('brand_tier_promo_rules')
              .select('id, brand_id, min_qty, bonus_qty, tier_package_id')
              .in('tier_package_id', tierPackageIds)
              .eq('is_active', true)
          : Promise.resolve({ data: [] as any[] }),
      ])
      setSupplyPromos(
        ((promoRuleRows || []) as any[]).map((r) => ({
          id: String(r.id),
          brand_id: String(r.brand_id),
          qty: Math.trunc(Number(r.min_qty) || 0),
          bonus_qty: Math.trunc(Number(r.bonus_qty) || 0),
          bonus: null,
          condition: gradeByTierPackage[String(r.tier_package_id)] || null,
          title: null,
        })) as SupplyPromoRow[],
      )
      const prodIds = (prodRows || []).map((p: { id: string }) => p.id)
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
      setProducts((prodRows || []).map((p: {
        id: string
        name: string
        thumb_img: string | null
        brand_id: string
        supply_price: number | null
        brands: { name: string } | { name: string }[] | null
      }) => {
        const brandRef = p.brands
        const brandName = Array.isArray(brandRef) ? brandRef[0]?.name : brandRef?.name
        return {
          id: p.id,
          name: p.name || '',
          thumb_img: p.thumb_img || null,
          brand_id: p.brand_id,
          brand_name: brandName || brandNameMap[p.brand_id] || '',
          supply_price: Math.trunc(Number(p.supply_price) || 0),
          status: 'active',
        }
      }))
    } else {
      setProducts([])
      setSupplyPromos([])
    }

    const { data: orderRows } = await supabase
      .from('brand_orders')
      .select('id, brand_id, status, items, promo_applied, points_earned, total_amount, created_at, courier, tracking_no, shipped_at, brands(name)')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20)

    setOrders((orderRows || []).map((o: {
      id: string
      brand_id: string | null
      status: string
      items: OrderItem[]
      promo_applied: string | null
      points_earned: number | null
      total_amount: number | null
      created_at: string
      courier: string | null
      tracking_no: string | null
      shipped_at: string | null
      brands: { name: string } | { name: string }[] | null
    }) => {
      const brandRef = o.brands
      const brandName = Array.isArray(brandRef) ? brandRef[0]?.name : brandRef?.name
      return {
        id: o.id,
        brand_name: brandName || '',
        brand_id: o.brand_id || null,
        status: o.status,
        items: Array.isArray(o.items) ? o.items : [],
        promo_applied: o.promo_applied,
        points_earned: o.points_earned || 0,
        total_amount: o.total_amount || 0,
        created_at: o.created_at,
        courier: o.courier || null,
        tracking_no: o.tracking_no || null,
        shipped_at: o.shipped_at || null,
      }
    }))

    setBrandFilter((prev) => (prev !== 'all' && !brandIds.includes(prev) ? 'all' : prev))
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const applyGridCols = () => {
      const w = window.innerWidth
      if (w >= 768) setProductGridCols(5)
      else if (w < 400) setProductGridCols(2)
      else setProductGridCols(3)
    }

    applyGridCols()
    window.addEventListener('resize', applyGridCols)
    return () => window.removeEventListener('resize', applyGridCols)
  }, [])

  const linkedBrandOptions = useMemo(
    () => linkedBrandIds
      .map((id) => {
        const fromProduct = products.find((p) => p.brand_id === id)?.brand_name
        const name = fromProduct || linkedBrandNames[id] || '브랜드'
        return {
          id,
          name: displayBrandName(name),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [linkedBrandIds, linkedBrandNames, products],
  )

  const productCountByBrandId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of products) {
      counts.set(p.brand_id, (counts.get(p.brand_id) || 0) + 1)
    }
    return counts
  }, [products])

  const brandFilteredProducts = useMemo(() => {
    if (brandFilter === 'all') return products
    return products.filter((p) => p.brand_id === brandFilter)
  }, [products, brandFilter])

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return brandFilteredProducts
    return brandFilteredProducts.filter((p) => matchesProductSearch(p.name, searchQuery))
  }, [brandFilteredProducts, searchQuery])

  const brandGroups = useMemo(
    () => filteredProducts.reduce((acc, p) => {
      if (!acc[p.brand_name]) acc[p.brand_name] = []
      acc[p.brand_name].push(p)
      return acc
    }, {} as Record<string, Product[]>),
    [filteredProducts],
  )

  const popupCart = cart
  const popupBrandId =
    popupCart[0]?.product.brand_id
    || (brandFilter !== 'all' ? brandFilter : null)
    || linkedBrandIds[0]
    || null
  const cartBrandCount = useMemo(
    () => new Set(cart.map((c) => c.product.brand_id)).size,
    [cart],
  )
  const activeGrade = gradeForBrand(gradeByBrandId, popupBrandId)
  const headerBrandId = brandFilter !== 'all' ? brandFilter : linkedBrandIds[0]
  const headerGrade = gradeForBrand(gradeByBrandId, headerBrandId)
  const { rateMap: gradeRateMap } = useBrandGradeRates(supabase, popupBrandId)
  const { rateMap: headerGradeRateMap } = useBrandGradeRates(supabase, headerBrandId)

  const popupTotalAmount = popupCart.reduce(
    (s, c) => s + buildOrderLineItem(
      c.product,
      c.qty,
      promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
      c.selectedPromo,
    ).line_amount,
    0,
  )
  const hqCampaignEffects = resolveHqCampaignEffects(
    popupCart.map((c) => ({
      product_id: c.product.id,
      qty: c.qty,
      unit_price: buildOrderLineItem(
        c.product,
        c.qty,
        promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
        c.selectedPromo,
      ).unit_price,
    })),
    hqForcedCampaigns,
  )
  const popupFinalAmount = popupTotalAmount - hqCampaignEffects.discountTotal
  const popupPointsEarned = (() => {
    const byBrand = new Map<string, typeof popupCart>()
    for (const c of popupCart) {
      const id = c.product.brand_id
      if (!byBrand.has(id)) byBrand.set(id, [])
      byBrand.get(id)!.push(c)
    }
    let pts = 0
    Array.from(byBrand.entries()).forEach(([brandId, rows]) => {
      const amount = rows.reduce(
        (s, c) => s + buildOrderLineItem(
          c.product,
          c.qty,
          promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
          c.selectedPromo,
        ).line_amount,
        0,
      )
      pts += calcPointsEarned(amount, gradeForBrand(gradeByBrandId, brandId), gradeRateMap)
    })
    return pts
  })()
  const totalQty = cart.reduce((s, c) => s + c.qty, 0)

  const applyPromo = (prod: BrandOrderProduct, promo: SupplyPromoRow) => {
    if (!hasValidSupplyPrice(prod.supply_price)) {
      showToast('가격 미설정 제품이에요')
      return
    }
    const full = products.find((p) => p.id === prod.id)
    if (!full) return
    const qty = Math.max(1, Math.trunc(promo.qty ?? 1))
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === prod.id)
      if (ex) {
        return prev.map((c) =>
          c.product.id === prod.id ? { ...c, qty, selectedPromo: promo } : c,
        )
      }
      return [...prev, { product: full, qty, selectedPromo: promo }]
    })
    showToast(`${promoLabel(promo)} · ${qty}개 담김`)
  }

  const addToCart = (prod: BrandOrderProduct) => {
    if (!hasValidSupplyPrice(prod.supply_price)) {
      showToast('가격 미설정 제품이에요')
      return
    }
    const full = products.find((p) => p.id === prod.id)
    if (!full) return
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === prod.id)
      if (ex) return prev.map((c) => (c.product.id === prod.id ? { ...c, qty: c.qty + QTY_STEP, selectedPromo: null } : c))
      return [...prev, { product: full, qty: QTY_STEP, selectedPromo: null }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setCart((prev) => prev
      .map((c) => (c.product.id === id ? { ...c, qty: Math.max(0, c.qty + delta), selectedPromo: null } : c))
      .filter((c) => c.qty > 0))
  }

  const submitOrder = async () => {
    if (cart.length === 0) { showToast('제품을 선택해주세요'); return }

    const unpriced = cart.filter((c) => !hasValidSupplyPrice(c.product.supply_price))
    if (unpriced.length > 0) {
      showToast('가격 미설정 제품이 있어요. 브랜드에 문의해주세요')
      return
    }
    if (!ownerProfileId) {
      showToast('프로필이 없습니다')
      return
    }

    setSending(true)
    const byBrand = new Map<string, CartItem[]>()
    for (const c of cart) {
      const id = c.product.brand_id
      if (!byBrand.has(id)) byBrand.set(id, [])
      byBrand.get(id)!.push(c)
    }

    const cartItems = Array.from(byBrand.entries()).map(([brandId, rows]) => {
      const orderGrade = gradeForBrand(gradeByBrandId, brandId)
      const items = rows.map((c) => buildOrderLineItem(
        c.product,
        c.qty,
        promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
        c.selectedPromo,
      ))
      const totalItems = items.reduce((s, i) => s + i.qty, 0)
      const totalAmount = items.reduce((s, i) => s + i.line_amount, 0)
      const promoApplied = items.map((i) => i.promo).filter(Boolean).join(', ') || null
      const pointsEarned = calcPointsEarned(totalAmount, orderGrade, null)
      return {
        brand_id: brandId,
        profile_id: ownerProfileId,
        owner_name: ownerName,
        salon_name: salonName,
        grade: orderGrade,
        items,
        total_qty: totalItems,
        total_amount: totalAmount,
        promo_applied: promoApplied,
        points_earned: pointsEarned,
      }
    })

    const result = await submitOrderBatch(cartItems)
    if (!result.ok) {
      showToast(result.message || ('발주 실패: ' + result.error))
    } else {
      setCart([])
      setShowPopup(false)
      showToast(`발주 요청 완료! 주문번호 ${result.order_no}`)
      void load()
      setTab('orders')
    }
    setSending(false)
  }

  const handleReturnPhotoUpload = async (files: FileList) => {
    setUploadingPhoto(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files).slice(0, 5 - returnPhotos.length)) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `return-photos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { data, error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true })
        if (error || !data) continue
        const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(path)
        uploaded.push(urlData.publicUrl)
      }
      setReturnPhotos((prev) => [...prev, ...uploaded].slice(0, 5))
    } finally {
      setUploadingPhoto(false)
    }
  }

  const submitReturn = async () => {
    if (!returnReason.trim()) { showToast('사유를 선택해주세요'); return }
    if (!returnPopup.order?.brand_id) { showToast('브랜드 정보 없음'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('id').eq('auth_id', user.id).maybeSingle()
    setReturnSaving(true)
    const { error } = await supabase.from('brand_returns').insert({
      brand_id: returnPopup.order.brand_id,
      order_id: returnPopup.order.id,
      type: returnType,
      reason_code: returnReason,
      reason_detail: returnDetail.trim() || null,
      qty: returnQty,
      status: 'requested',
      requested_by: (prof as { id?: string } | null)?.id || user.id,
      photos: returnPhotos,
    })
    if (!error) {
      setReturnPopup({ open: false, order: null })
      setReturnReason('')
      setReturnDetail('')
      setReturnQty(1)
      setReturnPhotos([])
      showToast('반품·교환 신청 완료! 브랜드사 검토 중')
    } else {
      showToast('신청 실패: ' + error.message)
    }
    setReturnSaving(false)
  }

  const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '대기중', color: '#A07830', bg: '#FBF5E8' },
    approved: { label: '승인됨', color: '#1E6B40', bg: '#EAF5EE' },
    shipping: { label: '배송중', color: '#185FA5', bg: '#E6F1FB' },
    done: { label: '완료', color: '#888888', bg: '#F5F5F5' },
    cancelled: { label: '취소', color: '#C0392B', bg: '#FAEAEA' },
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

  if (loading) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB }}>
        불러오는 중...
      </div>
    )
  }

  if (trackAllowed === false) {
    return (
      <div style={{ background: BG, minHeight: '100vh', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT, marginBottom: 8 }}>
          브랜드 직거래(트랙A) 원장님 전용 메뉴입니다
        </div>
        <div style={{ fontSize: 13, color: SUB, lineHeight: 1.6 }}>
          이 발주 화면은 브랜드사 직접 제휴로 가입한 원장님만 이용할 수 있어요.
        </div>
        <DashboardBottomNav role="owner" />
      </div>
    )
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: 80 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>브랜드 발주</div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner/brand-orders/invoice')}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', borderRadius: 16, border: `1px solid ${PURPLE}`, background: `${PURPLE}10`, color: PURPLE, cursor: 'pointer' }}
        >
          월청구서
        </button>
        <button type="button" onClick={() => router.push('/dashboard/owner/delivery-history')} style={{ fontSize: 12, color: '#7B5EA7', background: 'none', border: 'none', cursor: 'pointer' }}>배송이력 보기</button>
        {totalQty > 0 && (
          <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: PURPLE, color: '#fff', cursor: 'pointer' }} onClick={() => setShowPopup(true)}>
            전체 발주하기 {totalQty}개
          </div>
        )}
      </div>

      <div style={{ padding: '8px 16px 12px' }}>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${PURPLE}15`, color: PURPLE, border: `0.5px solid ${PURPLE}40` }}>
          {headerGrade} · 적립 {gradePointRate(headerGrade, headerGradeRateMap)}%
        </span>
      </div>

      {linkedBrandOptions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, padding: '0 16px 10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setBrandFilter('all')}
            style={brandPillStyle(brandFilter === 'all')}
          >
            전체
            <span style={brandPillCountStyle(brandFilter === 'all')}>
              {products.length}
            </span>
          </button>
          {linkedBrandOptions.map((brand) => {
            const selected = brandFilter === brand.id
            return (
              <button
                key={brand.id}
                type="button"
                onClick={() => setBrandFilter(brand.id)}
                style={brandPillStyle(selected)}
              >
                {brand.name}
                <span style={brandPillCountStyle(selected)}>
                  {productCountByBrandId.get(brand.id) || 0}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ padding: '0 16px 12px' }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="제품명 검색"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            borderRadius: 8,
            border: `0.5px solid ${BORDER}`,
            background: LIGHT,
            color: TEXT,
            fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 16 }}>
        {(['shop', 'orders'] as const).map((t) => (
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
              {searchQuery.trim() ? (
                '검색 결과가 없습니다.'
              ) : brandFilter === 'all' ? (
                <>
                  연결된 브랜드 제품이 없어요.<br />
                  <span style={{ fontSize: 12 }}>브랜드사 제휴 연결(active) 후 이용할 수 있어요</span>
                </>
              ) : (
                <>
                  이 브랜드에 등록된 제품이 없어요.<br />
                  <span style={{ fontSize: 12 }}>다른 브랜드를 선택하거나 전체를 눌러보세요</span>
                </>
              )}
            </div>
          ) : (
            Object.entries(brandGroups).map(([brandName, prods]) => (
              <div key={brandName} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{brandName}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${productGridCols}, 1fr)`, gap: 8 }}>
                  {prods.map((prod) => {
                    const cartItem = cart.find((c) => c.product.id === prod.id)
                    const brandGrade = gradeForBrand(gradeByBrandId, prod.brand_id)
                    return (
                      <BrandOrderProductCard
                        key={prod.id}
                        prod={prod}
                        supplyPromos={promosForBrandGrade(supplyPromos, prod.brand_id, brandGrade)}
                        qty={cartItem?.qty || 0}
                        activePromoId={cartItem?.selectedPromo?.id}
                        onApplyPromo={applyPromo}
                        onAdd={addToCart}
                        onChangeQty={changeQty}
                        stock={stockMap[prod.id]}
                      />
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
            orders.map((o) => {
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
                    {o.items.map((it) => formatOrderItemLine(it)).join(' · ')}
                  </div>
                  {o.total_amount > 0 && (
                    <div style={{ fontSize: 12, color: TEXT, marginBottom: 4 }}>₩{o.total_amount.toLocaleString()}</div>
                  )}
                  {o.promo_applied && <div style={{ fontSize: 11, color: PURPLE }}>{o.promo_applied} 적용</div>}
                  {o.points_earned > 0 && <div style={{ fontSize: 11, color: '#1E6B40', marginTop: 2 }}>+{o.points_earned}T 적립 예정</div>}
                  {o.tracking_no && (
                    <div style={{ fontSize: 11, color: '#185FA5', marginTop: 4, padding: '4px 8px', background: '#E6F1FB', borderRadius: 6, display: 'inline-block' }}>
                      📦 {o.courier} {o.tracking_no}
                    </div>
                  )}
                  {(o.status === 'shipping' || o.status === 'done') && (
                    <button type="button"
                      onClick={() => { setReturnPopup({ open: true, order: o }); setReturnQty(o.items.reduce((s, i) => s + i.qty, 0)) }}
                      style={{ marginTop: 6, fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.06)', color: '#E53935', cursor: 'pointer', display: 'block' }}>
                      반품·교환 신청
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {showPopup && (
        <div
          ref={overlayRef}
          onClick={(e) => { if (e.target === overlayRef.current) setShowPopup(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>전체 발주 확인</div>
              <button type="button" onClick={() => setShowPopup(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: SUB, lineHeight: 1 }}>✕</button>
            </div>

            {popupCart.map((item) => {
              const brandGrade = gradeForBrand(gradeByBrandId, item.product.brand_id)
              const line = buildOrderLineItem(
                item.product,
                item.qty,
                promosForBrandGrade(supplyPromos, item.product.brand_id, brandGrade),
                item.selectedPromo,
              )
              return (
                <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>{item.product.name}</div>
                    <div style={{ fontSize: 11, color: SUB }}>₩{line.unit_price.toLocaleString()} × {item.qty} = ₩{line.line_amount.toLocaleString()}</div>
                    {line.promo && <div style={{ fontSize: 11, color: PURPLE }}>{line.promo} → +{line.bonus}개 증정</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => changeQty(item.product.id, -QTY_STEP)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`, background: LIGHT, fontSize: 14, cursor: 'pointer', color: TEXT }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 500, minWidth: 20, textAlign: 'center', color: TEXT }}>{item.qty}</span>
                    <button type="button" onClick={() => changeQty(item.product.id, QTY_STEP)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}>+</button>
                  </div>
                </div>
              )
            })}

            <div style={{ padding: '12px 0', borderBottom: `1px solid ${BORDER}`, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB, marginBottom: 4 }}>
                <span>브랜드</span><span style={{ color: PURPLE }}>{cartBrandCount > 1 ? `${cartBrandCount}개 브랜드` : (popupCart[0]?.product.brand_name || '-')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB, marginBottom: 4 }}>
                <span>등급</span><span style={{ color: PURPLE }}>{cartBrandCount > 1 ? '브랜드별' : activeGrade}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: SUB, marginBottom: 4 }}>
                <span>적립율</span><span style={{ color: SUB }}>{cartBrandCount > 1 ? '브랜드별' : `${gradePointRate(activeGrade, gradeRateMap)}%`}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
                <span>발주 합계</span><span style={{ color: PURPLE }}>₩{popupTotalAmount.toLocaleString()}</span>
              </div>
              {hqCampaignEffects.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#e74c3c' }}>
                  <span>캠페인 할인</span>
                  <span>-{hqCampaignEffects.discountTotal.toLocaleString()}원</span>
                </div>
              )}
              {hqCampaignEffects.giftLines.filter(g => g.effect_type === 'gift').map((g, i) => (
                <div key={i} style={{ fontSize: 13, color: '#7B5EA7' }}>
                  🎁 {g.label}
                </div>
              ))}
              {hqCampaignEffects.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 500 }}>
                  <span>최종 결제금액</span>
                  <span>{popupFinalAmount.toLocaleString()}원</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#1E6B40' }}>
                <span>적립 예정</span><span>{popupPointsEarned}T</span>
              </div>
            </div>

            <button type="button" onClick={() => void submitOrder()} disabled={sending}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: sending ? `${PURPLE}80` : PURPLE, color: '#fff', fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {sending ? '발주 요청 중...' : '전체 발주하기'}
            </button>
          </div>
        </div>
      )}

      {returnPopup.open && returnPopup.order && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setReturnPopup({ open: false, order: null }) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#1A1A2E' }}>반품·교환 신청</div>
              <button type="button" onClick={() => setReturnPopup({ open: false, order: null })}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              {returnPopup.order.brand_name} · {returnPopup.order.items.map((i) => `${i.name} ${i.qty}ea`).join(', ')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['return', 'exchange'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setReturnType(t)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${returnType === t ? '#E53935' : '#eee'}`, background: returnType === t ? 'rgba(229,57,53,0.06)' : '#fff', color: returnType === t ? '#E53935' : '#888', fontSize: 13, cursor: 'pointer' }}>
                  {t === 'return' ? '반품' : '교환'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>사유 선택 (필수)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginBottom: 12 }}>
              {['제품 불량·파손', '오배송', '수량 오류', '유통기한 임박', '단순 변심', '배송 중 파손'].map((r) => (
                <button key={r} type="button" onClick={() => setReturnReason(r)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `0.5px solid ${returnReason === r ? '#7B5EA7' : '#eee'}`, background: returnReason === r ? 'rgba(123,94,167,0.08)' : '#fff', color: returnReason === r ? '#7B5EA7' : '#888', cursor: 'pointer' }}>
                  {r}
                </button>
              ))}
            </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>사진 첨부 (최대 5장, 선택)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14 }}>
                {returnPhotos.map((url, i) => (
                  <div key={url} style={{ position: 'relative', width: 64, height: 64 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => setReturnPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#E53935', color: '#fff', fontSize: 12, cursor: 'pointer', lineHeight: '20px', padding: 0 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {returnPhotos.length < 5 && (
                  <label style={{ width: 64, height: 64, borderRadius: 8, border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#999', cursor: 'pointer' }}>
                    {uploadingPhoto ? '...' : '+'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploadingPhoto}
                      onChange={(e) => { if (e.target.files && e.target.files.length > 0) void handleReturnPhotoUpload(e.target.files) }}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>수량</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => setReturnQty((q) => Math.max(1, q - 1))}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #eee', background: '#f9f9f9', fontSize: 16, cursor: 'pointer', color: '#333' }}>−</button>
              <span style={{ fontSize: 16, fontWeight: 500, minWidth: 36, textAlign: 'center' as const, color: '#1A1A2E' }}>{returnQty}</span>
              <button type="button" onClick={() => setReturnQty((q) => q + 1)}
                style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 16, cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>상세 내용</div>
            <textarea value={returnDetail} onChange={(e) => setReturnDetail(e.target.value)} placeholder="구체적인 상황을 입력해주세요"
              style={{ width: '100%', minHeight: 60, border: '1px solid #eee', borderRadius: 8, padding: '8px 10px', fontSize: 12, resize: 'none', outline: 'none', marginBottom: 14, color: '#333' }} />
            <button type="button" onClick={() => void submitReturn()} disabled={returnSaving}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: returnSaving ? 'rgba(123,94,167,0.4)' : '#7B5EA7', color: '#fff', fontSize: 14, cursor: returnSaving ? 'not-allowed' : 'pointer' }}>
              {returnSaving ? '신청 중...' : '반품·교환 신청하기'}
            </button>
          </div>
        </div>
      )}

      <DashboardBottomNav role="owner" />
    </div>
  )
}
