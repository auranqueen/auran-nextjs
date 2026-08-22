'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import BrandOrderProductCard from './BrandOrderProductCard'
import EventPackageSection from './components/EventPackageSection'
import AreteMembershipCard from './components/AreteMembershipCard'
import OwnerOrderStatement from './components/OwnerOrderStatement'
import { BORDER, PURPLE, SUB, TEXT } from './brandOrdersUi'
import {
  buildOrderLineItem,
  calcPointsEarned,
  gradePointRate,
  hasValidSupplyPrice,
  type SupplyPromoRow,
} from '@/lib/brand/brandOrderPromos'
import { useBrandGradeRates } from '@/lib/brand/useBrandGradeRates'
import { resolveOwnerIds } from '@/lib/brand/resolveOwnerIds'
import { submitOrderBatch } from '@/lib/brand/submitOrderBatch'
import { resolveHqCampaignEffects, type HqForcedCampaign } from '@/lib/brand/hqForcedCampaignPromos'
import { billingCycleRange } from '@/lib/billing/aggregateBrandBilling'

const BG = '#ffffff'
const LIGHT = '#f8f7fc'
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
  promo: SupplyPromoRow
  sets: number
}

function cartLineQty(item: CartItem): number {
  return Math.max(1, Math.trunc(item.promo.qty ?? 1)) * item.sets
}

function cartLineBonus(bonus: number, sets: number): number {
  return Math.trunc(bonus) * sets
}

interface OrderItem {
  name: string
  qty: number
  unit_price?: number
  line_amount?: number
  bonus?: number
  promo?: string
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
  const [brandCompanyMap, setBrandCompanyMap] = useState<Record<string, string>>({})
  const [rewardBalances, setRewardBalances] = useState<Record<string, number>>({})
  const [usePointsReward, setUsePointsReward] = useState(true)
  const [brandFilter, setBrandFilter] = useState<'all' | string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [ownerNote, setOwnerNote] = useState('')
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
  const [monthlyOrderCount, setMonthlyOrderCount] = useState(0)
  const [monthlyOrderAmount, setMonthlyOrderAmount] = useState(0)
  const [unpaidAmount, setUnpaidAmount] = useState(0)
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(true)
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
      setBrandCompanyMap({})
      setRewardBalances({})
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
    setBrandCompanyMap(brandCompanyMap)
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
      const missingPkgCompanyIds = Object.keys(gradeByCompanyOuter).filter(
        (cid) => Boolean(gradeByCompanyOuter[cid]) && !tierPackageByCompany[cid],
      )
      if (missingPkgCompanyIds.length > 0) {
        const { data: fallbackPkgs } = await supabase
          .from('brand_tier_packages')
          .select('id, company_id, tier_name')
          .in('company_id', missingPkgCompanyIds)
          .eq('is_active', true)
        for (const pkg of fallbackPkgs || []) {
          const cid = String((pkg as { company_id?: string }).company_id || '')
          if (!cid || tierPackageByCompany[cid]) continue
          const ownerGrade = gradeByCompanyOuter[cid]
          if (ownerGrade && String((pkg as { tier_name?: string }).tier_name || '') === ownerGrade) {
            tierPackageByCompany[cid] = String((pkg as { id: string }).id)
          }
        }
      }
    }
    setGradeByBrandId(gradeMap)
    // HQ 강제이벤트 조회 (본사 강제노출, owner_id is null, 활성+기간내)
    let hqCampaigns: HqForcedCampaign[] = []
    if (companyIdsForGrade.length > 0) {
      const { data: campaignRows } = await supabase
        .from('hq_forced_campaigns')
        .select('id, company_id, title, description, image_url, badge_text, target_product_ids, start_at, end_at, target_grades')
        .in('company_id', companyIdsForGrade)
        .is('owner_id', null)
        .eq('is_active', true)
      // target_grades null/[] = 전체노출; 배열이면 해당 회사 소속 브랜드 등급 중 하나라도 포함 시 노출
      const filteredCampaignRows = (campaignRows || []).filter((r: {
        target_grades?: string[] | null
        company_id?: string
      }) => {
        const tg = r.target_grades
        if (!tg || !Array.isArray(tg) || tg.length === 0) return true
        const companyId = String(r.company_id || '')
        const brandsInCompany = brandIds.filter((bid) => brandCompanyMap[bid] === companyId)
        const grades = (brandsInCompany.length > 0 ? brandsInCompany : brandIds).map((bid) =>
          gradeForBrand(gradeMap, bid),
        )
        return grades.some((g) => tg.includes(g))
      })
      const campaignIds = filteredCampaignRows.map((r: { id: string }) => r.id)
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
      hqCampaigns = (filteredCampaignRows as any[]).map((r) => ({
        ...r,
        tiers: tiersByCampaign[String(r.id)] || [],
      })) as HqForcedCampaign[]
    }
    setHqForcedCampaigns(hqCampaigns)

    if (brandIds.length > 0) {
      const tierPackageIds = Array.from(new Set(Object.values(tierPackageByCompany)))
      const gradeByTierPackage: Record<string, string> = {}
      for (const cid of Object.keys(tierPackageByCompany)) {
        const mappedGrade = gradeByCompanyOuter[cid]
        if (mappedGrade) gradeByTierPackage[tierPackageByCompany[cid]] = mappedGrade
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
  const popupCompanyId = popupBrandId ? (brandCompanyMap[popupBrandId] || null) : null
  const headerCompanyId = headerBrandId ? (brandCompanyMap[headerBrandId] || null) : null
  const { rateMap: gradeRateMap } = useBrandGradeRates(supabase, popupCompanyId)
  const { rateMap: headerGradeRateMap } = useBrandGradeRates(supabase, headerCompanyId)

  const popupTotalAmount = popupCart.reduce(
    (s, c) => s + buildOrderLineItem(
      c.product,
      cartLineQty(c),
      promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
      c.promo,
    ).line_amount,
    0,
  )
  const hqCampaignEffects = resolveHqCampaignEffects(
    popupCart.map((c) => ({
      product_id: c.product.id,
      qty: cartLineQty(c),
      unit_price: buildOrderLineItem(
        c.product,
        cartLineQty(c),
        promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
        c.promo,
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
          cartLineQty(c),
          promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
          c.promo,
        ).line_amount,
        0,
      )
      pts += calcPointsEarned(amount, gradeForBrand(gradeByBrandId, brandId), gradeRateMap)
    })
    return pts
  })()
  const popupCompanyTotals = (() => {
    const byBrand = new Map<string, typeof popupCart>()
    for (const c of popupCart) {
      const id = c.product.brand_id
      if (!byBrand.has(id)) byBrand.set(id, [])
      byBrand.get(id)!.push(c)
    }
    const totals: Record<string, number> = {}
    Array.from(byBrand.entries()).forEach(([brandId, rows]) => {
      const amount = rows.reduce(
        (s, c) => s + buildOrderLineItem(c.product, cartLineQty(c), promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)), c.promo).line_amount,
        0,
      )
      const cid = brandCompanyMap[brandId]
      if (!cid) return
      totals[cid] = (totals[cid] || 0) + amount
    })
    return totals
  })()
  const popupRewardBalanceTotal = Object.keys(popupCompanyTotals).reduce((s, cid) => s + (rewardBalances[cid] || 0), 0)
  const popupRewardUsable = Object.entries(popupCompanyTotals).reduce(
    (s, [cid, amount]) => s + Math.min(rewardBalances[cid] || 0, amount),
    0,
  )
  const popupRewardApplied = usePointsReward ? Math.min(popupRewardUsable, popupFinalAmount) : 0
  const popupFinalAfterReward = Math.max(0, popupFinalAmount - popupRewardApplied)
  const totalQty = cart.reduce((s, c) => s + cartLineQty(c), 0)
  const cartKindCount = new Set(cart.map((c) => c.product.id)).size

  const changeSet = (productId: string, promoId: string, delta: number) => {
    const full = products.find((p) => p.id === productId)
    const promo = supplyPromos.find((p) => p.id === promoId)
    if (delta > 0) {
      if (!full || !promo) return
      if (!hasValidSupplyPrice(full.supply_price)) {
        showToast('가격 미설정 제품이에요')
        return
      }
    }
    setCart((prev) => {
      const ex = prev.find((c) => c.product.id === productId && c.promo.id === promoId)
      if (ex) {
        const sets = ex.sets + delta
        if (sets <= 0) return prev.filter((c) => !(c.product.id === productId && c.promo.id === promoId))
        return prev.map((c) => (c.product.id === productId && c.promo.id === promoId ? { ...c, sets } : c))
      }
      if (delta <= 0 || !full || !promo) return prev
      return [...prev, { product: full, promo, sets: delta }]
    })
  }

  useEffect(() => {
    const companyIds = Array.from(
      new Set(cart.map((c) => brandCompanyMap[c.product.brand_id]).filter(Boolean)),
    ) as string[]
    if (!ownerProfileId || companyIds.length === 0) {
      setRewardBalances({})
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('brand_points')
        .select('company_id, balance')
        .in('company_id', companyIds)
        .eq('owner_id', ownerProfileId)
        .eq('track', 'REWARD')
      if (cancelled) return
      const map: Record<string, number> = {}
      for (const row of data || []) {
        const cid = String((row as { company_id?: string }).company_id || '')
        if (!cid) continue
        map[cid] = Math.trunc(Number((row as { balance?: number }).balance) || 0)
      }
      setRewardBalances(map)
    })()
    return () => { cancelled = true }
  }, [cart, brandCompanyMap, ownerProfileId])

  useEffect(() => {
    if (!headerCompanyId || !ownerProfileId) {
      setMonthlyOrderCount(0)
      setMonthlyOrderAmount(0)
      setUnpaidAmount(0)
      setMonthlySummaryLoading(false)
      return
    }
    const brandIds = Object.entries(brandCompanyMap)
      .filter(([, cid]) => cid === headerCompanyId)
      .map(([bid]) => bid)
    if (brandIds.length === 0) {
      setMonthlyOrderCount(0)
      setMonthlyOrderAmount(0)
      setUnpaidAmount(0)
      setMonthlySummaryLoading(false)
      return
    }

    let cancelled = false
    setMonthlySummaryLoading(true)
    const { startIso, endIso } = billingCycleRange(new Date())

    void (async () => {
      try {
        const [{ data: orderRows, error: orderErr }, { data: invoiceRows, error: invoiceErr }] = await Promise.all([
          supabase
            .from('brand_orders')
            .select('total_amount, points_used, points_used_reward')
            .eq('profile_id', ownerProfileId)
            .in('brand_id', brandIds)
            .gte('created_at', startIso)
            .lt('created_at', endIso),
          supabase
            .from('brand_billing_invoices')
            .select('total_amount')
            .eq('owner_id', ownerProfileId)
            .eq('company_id', headerCompanyId)
            .eq('status', 'unpaid'),
        ])
        if (cancelled) return
        if (orderErr) console.error('[monthly-summary] brand_orders', orderErr)
        if (invoiceErr) console.error('[monthly-summary] brand_billing_invoices', invoiceErr)

        const rows = orderErr ? [] : (orderRows || [])
        const count = rows.length
        const amount = rows.reduce((s, o) => {
          const total = Math.trunc(Number((o as { total_amount?: number }).total_amount) || 0)
          const used = Math.trunc(Number((o as { points_used?: number }).points_used) || 0)
          const usedReward = Math.trunc(Number((o as { points_used_reward?: number }).points_used_reward) || 0)
          return s + Math.max(0, total - used - usedReward)
        }, 0)
        const unpaid = invoiceErr
          ? 0
          : (invoiceRows || []).reduce(
            (s, inv) => s + Math.trunc(Number((inv as { total_amount?: number }).total_amount) || 0),
            0,
          )

        setMonthlyOrderCount(count)
        setMonthlyOrderAmount(amount)
        setUnpaidAmount(unpaid)
      } catch (e) {
        console.error('[monthly-summary]', e)
        if (!cancelled) {
          setMonthlyOrderCount(0)
          setMonthlyOrderAmount(0)
          setUnpaidAmount(0)
        }
      } finally {
        if (!cancelled) setMonthlySummaryLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [headerCompanyId, brandCompanyMap, ownerProfileId, supabase])

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
    const cartCompanyIds = Array.from(new Set(Array.from(byBrand.keys()).map((bid) => brandCompanyMap[bid]).filter(Boolean))) as string[]
    const ratesByCompany: Record<string, Record<string, number>> = {}
    if (cartCompanyIds.length > 0) {
      const { data: rateRows } = await supabase
        .from('brand_grade_point_rates')
        .select('company_id, grade, rate')
        .in('company_id', cartCompanyIds)
      for (const row of rateRows || []) {
        const cid = String((row as { company_id: string }).company_id)
        if (!ratesByCompany[cid]) ratesByCompany[cid] = {}
        ratesByCompany[cid][String((row as { grade: string }).grade)] = Number((row as { rate: number }).rate)
      }
    }
    const wholeCartItems = cart.map((c) => ({
      product_id: c.product.id,
      qty: cartLineQty(c),
      unit_price: buildOrderLineItem(c.product, cartLineQty(c), promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)), c.promo).unit_price,
    }))
    const wholeCartEffects = resolveHqCampaignEffects(wholeCartItems, hqForcedCampaigns)
    const wholeCartLineTotal = wholeCartItems.reduce((s, i) => s + i.qty * i.unit_price, 0)
    const cartItems = Array.from(byBrand.entries()).map(([brandId, rows]) => {
      const orderGrade = gradeForBrand(gradeByBrandId, brandId)
      const items = rows.map((c) => {
        const line = buildOrderLineItem(
          c.product,
          cartLineQty(c),
          promosForBrandGrade(supplyPromos, c.product.brand_id, gradeForBrand(gradeByBrandId, c.product.brand_id)),
          c.promo,
        )
        return { ...line, bonus: cartLineBonus(line.bonus, c.sets) }
      })
      const giftItemsForBrand = wholeCartEffects.giftLines
        .filter((g) => {
          if (g.effect_type !== 'gift' || !g.product_id) return false
          const giftBrandId = products.find((p) => p.id === g.product_id)?.brand_id
          if (giftBrandId) return giftBrandId === brandId
          const camp = hqForcedCampaigns.find((c) => c.id === g.campaign_id)
          const targets = camp?.target_product_ids ?? []
          return rows.some((r) => targets.includes(r.product.id))
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
      const itemsWithGifts = [...items, ...giftItemsForBrand]
      const totalItems = itemsWithGifts.reduce((s, i) => s + i.qty, 0)
      const brandLineTotal = items.reduce((s, i) => s + i.line_amount, 0)
      const brandShareDiscount = wholeCartLineTotal > 0
        ? Math.round(wholeCartEffects.discountTotal * (brandLineTotal / wholeCartLineTotal))
        : 0
      const totalAmount = brandLineTotal - brandShareDiscount
      const promoApplied = items.map((i) => i.promo).filter(Boolean).join(', ') || null
      const companyIdForBrand = brandCompanyMap[brandId]
      const pointsEarned = calcPointsEarned(totalAmount, orderGrade, companyIdForBrand ? (ratesByCompany[companyIdForBrand] ?? null) : null)
      return {
        brand_id: brandId,
        profile_id: ownerProfileId,
        owner_name: ownerName,
        salon_name: salonName,
        grade: orderGrade,
        items: itemsWithGifts,
        total_qty: totalItems,
        total_amount: totalAmount,
        promo_applied: promoApplied,
        points_earned: pointsEarned,
      }
    })

    const result = await submitOrderBatch(cartItems, ownerNote)
    if (!result.ok) {
      showToast(result.message || ('발주 실패: ' + result.error))
    } else {
      if (usePointsReward && result.order_ids && result.order_ids.length === cartItems.length) {
        const companyAmounts: Record<string, number> = {}
        cartItems.forEach((item) => {
          const cid = brandCompanyMap[item.brand_id]
          if (!cid) return
          companyAmounts[cid] = (companyAmounts[cid] || 0) + item.total_amount
        })
        const pointsByOrder: Record<string, number> = {}
        Object.entries(companyAmounts).forEach(([cid, companyTotal]) => {
          const balance = rewardBalances[cid] || 0
          const rewardForCompany = Math.min(balance, companyTotal)
          if (rewardForCompany <= 0 || companyTotal <= 0) return
          const idxList = cartItems
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => brandCompanyMap[item.brand_id] === cid)
          let remaining = rewardForCompany
          idxList.forEach(({ item, idx }, i) => {
            const orderId = result.order_ids![idx]
            if (!orderId) return
            const share = i === idxList.length - 1
              ? remaining
              : Math.round(rewardForCompany * (item.total_amount / companyTotal))
            const applied = Math.min(share, remaining)
            if (applied > 0) pointsByOrder[orderId] = applied
            remaining -= applied
          })
        })
        const earnedByOrder: Record<string, number> = {}
        cartItems.forEach((item, idx) => {
          const orderId = result.order_ids![idx]
          if (!orderId) return
          const cid = brandCompanyMap[item.brand_id]
          const rateMap = cid ? (ratesByCompany[cid] ?? null) : null
          const rewardUsed = pointsByOrder[orderId] || 0
          const netForEarning = Math.max(0, item.total_amount - rewardUsed)
          earnedByOrder[orderId] = calcPointsEarned(netForEarning, item.grade, rateMap)
        })
        if (Object.keys(pointsByOrder).length > 0 || Object.keys(earnedByOrder).length > 0) {
          await fetch('/api/brand-orders/apply-reward-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points_by_order: pointsByOrder, earned_by_order: earnedByOrder }),
          }).catch(() => {})
        }
      }
      setCart([])
      setOwnerNote('')
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
    <div style={{ background: BG, minHeight: '100vh', paddingBottom: totalQty > 0 ? 160 : 80 }}>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>브랜드 발주</div>
      </div>

      <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${PURPLE}15`, color: PURPLE, border: `0.5px solid ${PURPLE}40` }}>
          {headerGrade} · 적립 {gradePointRate(headerGrade, headerGradeRateMap)}%
        </span>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner/brand-orders/invoice')}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: PURPLE, cursor: 'pointer' }}
        >
          월청구서
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner/delivery-history')}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: PURPLE, cursor: 'pointer' }}
        >
          배송이력 보기
        </button>
      </div>
      {!monthlySummaryLoading && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #ECE7DE',
            borderRadius: 16,
            padding: '16px 18px',
            margin: '0 16px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: '#8A7E72', fontWeight: 500 }}>이번 달 발주 현황</div>
            <div style={{ fontSize: 12, color: '#B4A99A' }}>{new Date().getMonth() + 1}월</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: unpaidAmount > 0 ? 10 : 12 }}>
            <div style={{ background: '#FBF7EE', border: '1px solid #EFE3C8', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#B08A46', marginBottom: 6 }}>발주 건수</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#8A6A2E' }}>{monthlyOrderCount}건</div>
            </div>
            <div style={{ background: '#F5F1FA', border: '1px solid #E1D8F0', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 12, color: '#7B5EA7', marginBottom: 6 }}>발주 금액</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#5A4380' }}>{monthlyOrderAmount.toLocaleString()}원</div>
            </div>
          </div>
          {unpaidAmount > 0 && (
            <div
              style={{
                background: '#FBF0EC',
                border: '1px solid #F0D9CF',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, color: '#C0724E', fontWeight: 500 }}>결제대기</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#A85B38' }}>{unpaidAmount.toLocaleString()}원</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => router.push('/dashboard/owner/brand-orders/invoice')}
            style={{
              width: '100%',
              background: '#7B5EA7',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: 13,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            결제하러 가기
          </button>
        </div>
      )}
      <EventPackageSection campaigns={hqForcedCampaigns} ownerProfileId={ownerProfileId} />
      <AreteMembershipCard ownerProfileId={ownerProfileId} />
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)', margin: '0 16px 12px' }} />
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
                    const cartLines = cart.filter((c) => c.product.id === prod.id)
                    const brandGrade = gradeForBrand(gradeByBrandId, prod.brand_id)
                    const setsByPromoId: Record<string, number> = {}
                    for (const line of cartLines) setsByPromoId[line.promo.id] = line.sets
                    return (
                      <BrandOrderProductCard
                        key={prod.id}
                        prod={prod}
                        supplyPromos={promosForBrandGrade(supplyPromos, prod.brand_id, brandGrade)}
                        setsByPromoId={setsByPromoId}
                        onChangeSet={changeSet}
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
          <OwnerOrderStatement
            ownerProfileId={ownerProfileId}
            onReturnRequest={(o) => {
              setReturnPopup({ open: true, order: o as Order })
              setReturnQty(o.items.reduce((s, i) => s + i.qty, 0))
            }}
          />
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
              const lineQty = cartLineQty(item)
              const line = buildOrderLineItem(
                item.product,
                lineQty,
                promosForBrandGrade(supplyPromos, item.product.brand_id, brandGrade),
                item.promo,
              )
              return (
                <div key={`${item.product.id}-${item.promo.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>{item.product.name}</div>
                    <div style={{ fontSize: 11, color: SUB }}>₩{line.unit_price.toLocaleString()} × {lineQty} = ₩{line.line_amount.toLocaleString()}</div>
                    {line.promo && <div style={{ fontSize: 11, color: PURPLE }}>{line.promo} × {item.sets}세트 → +{cartLineBonus(line.bonus, item.sets)}개 증정</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <button type="button" onClick={() => changeSet(item.product.id, item.promo.id, -1)}
                      style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${BORDER}`, background: LIGHT, fontSize: 14, cursor: 'pointer', color: TEXT }}>−</button>
                    <span style={{ fontSize: 14, fontWeight: 500, minWidth: 20, textAlign: 'center', color: TEXT }}>{item.sets}</span>
                    <button type="button" onClick={() => changeSet(item.product.id, item.promo.id, 1)}
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
              {popupRewardUsable > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TEXT, marginBottom: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={usePointsReward} onChange={(e) => setUsePointsReward(e.target.checked)} />
                  일반적립금으로 결제할게요 (누적잔액 {popupRewardBalanceTotal.toLocaleString()}P)
                </label>
              )}
              {(hqCampaignEffects.discountTotal > 0 || popupRewardApplied > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 500 }}>
                  <span>최종 결제금액</span>
                  <span>{popupFinalAfterReward.toLocaleString()}원</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#1E6B40' }}>
                <span>적립 예정</span><span>{popupPointsEarned}T</span>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>요청사항 (선택)</div>
              <textarea
                value={ownerNote}
                onChange={(e) => setOwnerNote(e.target.value)}
                placeholder="특별히 전달할 내용이 있으면 적어주세요"
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  fontSize: 13,
                  resize: 'vertical',
                  color: TEXT,
                }}
              />
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

      {totalQty > 0 && (
        <button
          type="button"
          onClick={() => setShowPopup(true)}
          style={{
            position: 'fixed',
            left: 16,
            right: 16,
            bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
            zIndex: 31,
            padding: '14px 16px',
            border: 'none',
            borderRadius: 999,
            background: PURPLE,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          전체 발주하기 {cartKindCount}가지 제품
        </button>
      )}

      <DashboardBottomNav role="owner" />
    </div>
  )
}
