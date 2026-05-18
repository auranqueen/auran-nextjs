'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import DashboardHeader from '@/components/DashboardHeader'
import CartHeaderButton from '@/components/CartHeaderButton'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import CheckoutPageView from '@/components/ui/CheckoutPageView'
import CustomerDashboardShell from '@/components/views/CustomerDashboardShell'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'
import {
  computeCouponDiscount,
  isCouponApplicableForOrder,
  isCouponExpiredForUser,
  type OrderLineForCoupon,
} from '@/lib/coupon/computeDiscount'
import { fetchUserCouponsWithCoupons } from '@/lib/coupon/fetchUserCouponsWithCoupons'

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type UcRow = {
  id: string
  status: string
  coupon_id: string
  expired_at?: string | null
  coupons: any
}

function CheckoutPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const supabase = createClient()
  const { getSettingNum, loading: settingsLoading } = useAdminSettings()
  const [loading, setLoading] = useState(true)
  const [meId, setMeId] = useState('')
  const [balance, setBalance] = useState(0)
  const [points, setPoints] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [paying, setPaying] = useState(false)
  const [toast, setToast] = useState('')
  const [couponSheetOpen, setCouponSheetOpen] = useState(false)
  const [userCoupons, setUserCoupons] = useState<UcRow[]>([])
  const [selectedUserCouponId, setSelectedUserCouponId] = useState<string | null>(null)
  const [authUid, setAuthUid] = useState<string | null>(null)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [addressSheetOpen, setAddressSheetOpen] = useState(false)
  const [payWithToast, setPayWithToast] = useState(true)
  const [payModal, setPayModal] = useState(false)
  const [earnToast, setEarnToast] = useState(true)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinChecking, setPinChecking] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [gradeDiscount, setGradeDiscount] = useState(0)
  const [gradeName, setGradeName] = useState('')
  const [shippingFee, setShippingFee] = useState(0)
  const [extraShippingFee, setExtraShippingFee] = useState(0)
  const [toastDraftWon, setToastDraftWon] = useState<number | null>(null)
  const [payWithOran, setPayWithOran] = useState(false)
  const [oranDraftWon, setOranDraftWon] = useState<number | null>(null)
  const [isFounderUser, setIsFounderUser] = useState(false)

  const toastRate = getSettingNum('toast', 'exchange_rate', 100)
  const maxCouponPct = getSettingNum('coupon', 'max_percent_discount', 70)
  const showChargeOption = getSettingNum('checkout', 'show_charge_option', 1) === 1
  const minOrderAmount = getSettingNum('checkout', 'min_order_amount', 0)
  const minToastOrderAmount = getSettingNum('checkout', 'min_toast_order_amount', 50000)
  const freeShippingThreshold = getSettingNum('shipping', 'free_shipping_threshold', 50000)
  const basicShippingFeeCfg = getSettingNum('shipping', 'basic_shipping_fee', 3000)
  const jejuShippingFeeCfg = getSettingNum('shipping', 'jeju_shipping_fee', 0)
  const islandShippingFeeCfg = getSettingNum('shipping', 'island_shipping_fee', 0)
  const productIds = useMemo(() => {
    const fromProducts = String(search.get('products') || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    if (fromProducts.length > 0) return fromProducts
    const one = (search.get('productId') || search.get('product_id') || '').trim()
    return one ? [one] : []
  }, [search])
  const giftTo = search.get('gift_to') || ''
  const giftMessage = search.get('gift_message') || search.get('message') || ''
  const shareJournalId = search.get('share_journal_id') || ''
  const [refUserId, setRefUserId] = useState('')
  useEffect(() => {
    setRefUserId(search.get('ref') ?? '')
  }, [search])

  const qtyList = useMemo(() => {
    const raw = String(search.get('qty') || '1')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => Number(v))
    const nums = raw.length ? raw : [1]
    return nums.map((n) => Math.max(1, Math.min(99, Number.isFinite(n) ? n : 1)))
  }, [search])

  const orderedProducts = useMemo(() => {
    const orderMap = new Map(productIds.map((id, i) => [id, i]))
    return [...products].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
  }, [products, productIds])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const chargeDone = search.get('charge_done')
    const paymentQ = search.get('payment')
    if (chargeDone !== '1' && paymentQ !== 'done') return
    setToast('충전 완료! 이제 결제해주세요 💜')
    const p = new URLSearchParams(search.toString())
    p.delete('charge_done')
    p.delete('payment')
    const q = p.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }, [search, pathname, router])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      let user = sessionData.session?.user ?? null
      if (!user) {
        const { data: auth } = await supabase.auth.getUser()
        user = auth?.user ?? null
      }
      if (!user) {
        setLoading(false)
        return
      }
      const { data: me } = await supabase
        .from('users')
        .select('id,name,phone,points,charge_balance,customer_grade,is_founder')
        .eq('auth_id', user.id)
        .maybeSingle()
      if (!me?.id) {
        setLoading(false)
        return
      }
      setAuthUid(user.id)
      setMeId(me.id)
      setRecipientName(String((me as any).name || ''))
      setRecipientPhone(String((me as any).phone || ''))
      setPoints(toNum(me.points))
      setBalance(toNum(me.charge_balance))
      setIsFounderUser(!!(me as { is_founder?: boolean }).is_founder)
      const cg = String((me as any).customer_grade || '').trim()
      setGradeName(cg)
      const gKey = cg ? `grade_discount_${cg}` : ''
      const gradeSettingPromise = cg
        ? supabase
            .from('admin_settings')
            .select('value')
            .eq('category', 'grade')
            .eq('key', gKey)
            .maybeSingle()
        : Promise.resolve({ data: null as { value?: string } | null })
      const productsPromise =
        productIds.length > 0
          ? supabase
              .from('products')
              .select('id,name,thumb_img,retail_price,brand_id,is_timesale,timesale_ends_at,is_groupbuy,sale_price')
              .in('id', productIds)
              .eq('status', 'active')
              .gt('retail_price', 0)
          : Promise.resolve({ data: null as unknown[] | null })

      const [
        { data: shippingRows },
        { rows: ucs, error: ucErr },
        { data: brandCoupons },
        { data: gRow },
        { data: productRows },
      ] = await Promise.all([
        supabase
          .from('shipping_addresses')
          .select('*')
          .eq('user_id', me.id)
          .order('is_default', { ascending: false }),
        fetchUserCouponsWithCoupons(supabase, me.id, { status: 'unused' }),
        supabase.from('coupons').select('*').eq('is_active', true).eq('coupon_type', 'regular').eq('scope', 'brand'),
        gradeSettingPromise,
        productsPromise,
      ])
      if (ucErr) console.warn('[checkout] user_coupons', ucErr.message)

      const gPct = cg ? Number((gRow as any)?.value || 0) : 0
      setGradeDiscount(Number.isFinite(gPct) ? gPct : 0)

      const rows = shippingRows || []
      setSavedAddresses(rows)
      const defaultAddr = rows.find((r: any) => r.is_default) || rows[0] || null
      if (defaultAddr) {
        setRecipientName(String(defaultAddr.recipient_name || defaultAddr.name || ''))
        setRecipientPhone(String(defaultAddr.phone || defaultAddr.recipient_phone || ''))
        setAddress(String(defaultAddr.address || ''))
        setAddressDetail(String(defaultAddr.address_detail || ''))
      }

      // 브랜드 상시 쿠폰 조회 후 가상 row로 주입
      const existingCouponIds = new Set((ucs || []).map((u: any) => u.coupon_id))
      const virtualRows: UcRow[] = (brandCoupons || [])
        .filter((c: any) => !existingCouponIds.has(c.id))
        .map((c: any) => ({
          id: `virtual_${c.id}`,
          status: 'unused',
          issued_at: null,
          used_at: null,
          expired_at: null,
          coupon_id: c.id,
          coupons: c,
        })) as UcRow[]

      setUserCoupons([...(ucs || []), ...virtualRows] as UcRow[])
      if (productIds.length > 0) {
        const fetched = productRows || []
        const hasValidPrice = fetched.some((p: any) => toNum(p.retail_price) > 0)
        if (!hasValidPrice) {
          router.replace('/')
          return
        }
        setProducts(hasValidPrice ? fetched : [])
      } else {
        router.replace('/')
        return
      }
      setLoading(false)
    }
    run()
  }, [productIds.join(','), search?.toString()])

  const subtotal = useMemo(
    () =>
      orderedProducts.reduce((s, p, i) => {
        const q = qtyList[i] ?? qtyList[0] ?? 1
        const now = new Date()
        let unit = toNum(p.retail_price)
        if (p.is_timesale && p.timesale_ends_at) {
          const end = new Date(p.timesale_ends_at)
          if (end > now) unit = toNum(p.sale_price)
        } else if (p.is_groupbuy) {
          unit = toNum(p.sale_price)
        }
        return s + unit * q
      }, 0),
    [orderedProducts, qtyList]
  )

  const orderLines: OrderLineForCoupon[] = useMemo(
    () =>
      orderedProducts.map((p, i) => {
        const q = qtyList[i] ?? qtyList[0] ?? 1
        const now = new Date()
        let unit = toNum(p.retail_price)
        if (p.is_timesale && p.timesale_ends_at) {
          const end = new Date(p.timesale_ends_at)
          if (end > now) unit = toNum(p.sale_price)
        } else if (p.is_groupbuy) {
          unit = toNum(p.sale_price)
        }
        return {
          product_id: p.id,
          brand_id: p.brand_id ?? null,
          subtotal: unit * q,
          is_timesale: p.is_timesale === true,
          is_groupbuy: p.is_groupbuy === true,
          is_event: false,
        }
      }),
    [orderedProducts, qtyList]
  )

  // ===== [또또복권] 체크아웃 미달 안내 계산 =====
  // orderLines에서 르노벨/통합 금액 분리
  // 공구/타임세일/플래시세일 제외
  const RENOBEL_ID = '90175aa9-70c8-4568-865a-195f11bd7859'

  let rnbAmount = 0
  let genAmount = 0
  orderLines.forEach((line: any) => {
    if (line.is_groupbuy || line.is_timesale || line.is_flash_sale) return
    const amt = line.subtotal || 0
    if (line.brand_id === RENOBEL_ID) {
      rnbAmount += amt
    } else {
      genAmount += amt
    }
  })

  // 다음 티어까지 부족 금액 계산
  // 통합 티어: 20만/30만/50만/100만
  const GEN_TIERS = [200000, 300000, 500000, 1000000]
  const nextGenTier = GEN_TIERS.find(t => genAmount < t)
  const generalShortage = nextGenTier !== undefined ? nextGenTier - genAmount : undefined
  const generalProgress = nextGenTier
    ? Math.min(100, Math.round((genAmount / nextGenTier) * 100))
    : 100

  // 르노벨 티어: 70만/120만/200만
  const RNB_TIERS = [700000, 1200000, 2000000]
  const nextRnbTier = RNB_TIERS.find(t => rnbAmount < t)
  const rnobelShortage = nextRnbTier !== undefined ? nextRnbTier - rnbAmount : undefined
  const rnobelProgress = nextRnbTier
    ? Math.min(100, Math.round((rnbAmount / nextRnbTier) * 100))
    : 100

  const { groupbuyDiscount, timesaleDiscount } = useMemo(() => {
    let gb = 0
    let ts = 0
    const now = new Date()
    orderedProducts.forEach((p, i) => {
      const q = qtyList[i] ?? qtyList[0] ?? 1
      const retail = toNum(p.retail_price)
      const sale = toNum(p.sale_price)
      if (p.is_timesale && p.timesale_ends_at) {
        const end = new Date(p.timesale_ends_at)
        if (end > now && retail > sale) ts += (retail - sale) * q
      } else if (p.is_groupbuy && retail > sale) {
        gb += (retail - sale) * q
      }
    })
    return { groupbuyDiscount: gb, timesaleDiscount: ts }
  }, [orderedProducts, qtyList])

  useEffect(() => {
    const addr = String(address || '')
    const basic = subtotal >= freeShippingThreshold ? 0 : Math.max(0, Math.floor(basicShippingFeeCfg))
    let extra = 0
    if (addr.includes('제주')) extra += Math.max(0, Math.floor(jejuShippingFeeCfg))
    if (addr.includes('울릉')) extra += Math.max(0, Math.floor(islandShippingFeeCfg))
    setShippingFee(basic)
    setExtraShippingFee(extra)
  }, [address, subtotal, freeShippingThreshold, basicShippingFeeCfg, jejuShippingFeeCfg, islandShippingFeeCfg])

  const founderDiscountAmt = useMemo(
    () => (isFounderUser ? Math.floor((subtotal * 2) / 100) : 0),
    [subtotal, isFounderUser]
  )
  const afterFounder = Math.max(0, subtotal - founderDiscountAmt)
  const gradeDiscountAmt = useMemo(
    () => Math.floor((afterFounder * Math.max(0, gradeDiscount)) / 100),
    [afterFounder, gradeDiscount]
  )
  const afterGrade = Math.max(0, afterFounder - gradeDiscountAmt)

  const selectedRow = useMemo(
    () => userCoupons.find((u) => u.id === selectedUserCouponId) || null,
    [userCoupons, selectedUserCouponId]
  )
  const couponDiscount = useMemo(() => {
    if (!selectedRow?.coupons || !authUid) return 0
    const c = selectedRow.coupons
    if (!isCouponApplicableForOrder(c, orderLines, afterGrade, authUid)) return 0
    return computeCouponDiscount(afterGrade, c, { maxPercent: maxCouponPct })
  }, [selectedRow, afterGrade, orderLines, authUid, maxCouponPct])

  const afterCoupon = Math.max(0, afterGrade - couponDiscount)
  const toastTBalance = points + Math.floor(balance / Math.max(1, toastRate))
  const LUMIERE_GRADES = ['LUMIÈRE', 'REINE', 'NOIR', 'CÉLESTE']
  const toastMaxUsageRate = LUMIERE_GRADES.includes(gradeName ?? '') ? 1.0 : 0.5
  const toastHalf = Math.min(Math.floor(toastTBalance * toastRate), Math.floor(afterCoupon * toastMaxUsageRate))
  const hasTimesaleOrGroupbuy = orderLines.some((l: any) => l.is_timesale === true || l.is_groupbuy === true)
  const toastUsed = (payWithToast && afterCoupon >= minToastOrderAmount && !hasTimesaleOrGroupbuy)
    ? Math.min(Math.floor(toastTBalance * toastMaxUsageRate), afterCoupon)
    : 0
  const goodsAfterToast = Math.max(0, afterCoupon - toastUsed)
  const remBalAfterToast = Math.max(0, balance)
  const oranCap = Math.min(remBalAfterToast, goodsAfterToast)
  const oranUsed = payWithOran ? Math.min(oranCap, oranDraftWon ?? oranCap) : 0
  const goodsAfterOran = Math.max(0, goodsAfterToast - oranUsed)
  const needCharge = Math.max(0, goodsAfterOran + shippingFee + extraShippingFee)
  const payAppAmount = Math.max(0, Math.floor(goodsAfterOran + shippingFee + extraShippingFee))

  useEffect(() => {
    if (!selectedUserCouponId) return
    const row = userCoupons.find((u) => u.id === selectedUserCouponId)
    if (!row?.coupons) {
      setSelectedUserCouponId(null)
      return
    }
    if (
      !authUid ||
      isCouponExpiredForUser({ status: 'unused', expired_at: row.expired_at }, row.coupons) ||
      !isCouponApplicableForOrder(row.coupons, orderLines, afterGrade, authUid) ||
      computeCouponDiscount(afterGrade, row.coupons, { maxPercent: maxCouponPct }) <= 0
    ) {
      setSelectedUserCouponId(null)
    }
  }, [afterGrade, userCoupons, selectedUserCouponId, orderLines, authUid, maxCouponPct])

  const applicableCheckoutCoupons = useMemo(() => {
    if (!authUid) return []
    const isTimesaleOrGroupbuy = orderLines.some((l: any) => l.is_timesale === true || l.is_groupbuy === true)
    return userCoupons.filter((u) => {
      if (!u.coupons || u.status !== 'unused') return false
      if (isTimesaleOrGroupbuy) return false
      if (isCouponExpiredForUser({ status: u.status, expired_at: u.expired_at }, u.coupons)) return false
      if (!isCouponApplicableForOrder(u.coupons, orderLines, afterGrade, authUid)) return false
      return computeCouponDiscount(afterGrade, u.coupons, { maxPercent: maxCouponPct }) > 0
    })
  }, [userCoupons, afterGrade, orderLines, authUid, maxCouponPct])

  const onPay = async (allowCharge = true) => {
    if (isPaying) return
    setIsPaying(true)
    if (!recipientName?.trim()) {
      setToast('받는 분 이름을 입력해주세요')
      setIsPaying(false)
      return
    }
    if (!recipientPhone?.trim()) {
      setToast('연락처를 입력해주세요')
      setIsPaying(false)
      return
    }
    if (!address?.trim()) {
      setToast('배송지 주소를 입력해주세요')
      setIsPaying(false)
      return
    }
    // address_detail 선택 입력 (필수 아님)
    if (!orderedProducts.length || !meId) {
      setIsPaying(false)
      return
    }
    if (subtotal < minOrderAmount) {
      setToast(`최소 주문금액은 ₩${minOrderAmount.toLocaleString()}입니다`)
      setIsPaying(false)
      return
    }
    if (needCharge > 0) {
      router.push(`/payment/payapp?product_id=${orderedProducts[0]?.id}&qty=1&amount=${payAppAmount}&shipping_fee=${shippingFee}&grade_discount=${gradeDiscountAmt}&subtotal=${subtotal}&recipient_name=${encodeURIComponent(recipientName || '')}&recipient_phone=${encodeURIComponent(recipientPhone || '')}&address=${encodeURIComponent(address || '')}&address_detail=${encodeURIComponent(addressDetail || '')}&coupon_discount=${couponDiscount}&user_coupon_id=${(selectedUserCouponId && !selectedUserCouponId.startsWith('virtual_')) ? selectedUserCouponId : ''}`)
      setIsPaying(false)
      return
    }
    router.push(`/payment/payapp?product_id=${orderedProducts[0]?.id}&qty=1&amount=${payAppAmount}&shipping_fee=${shippingFee}&grade_discount=${gradeDiscountAmt}&subtotal=${subtotal}&recipient_name=${encodeURIComponent(recipientName || '')}&recipient_phone=${encodeURIComponent(recipientPhone || '')}&address=${encodeURIComponent(address || '')}&address_detail=${encodeURIComponent(addressDetail || '')}&coupon_discount=${couponDiscount}&user_coupon_id=${(selectedUserCouponId && !selectedUserCouponId.startsWith('virtual_')) ? selectedUserCouponId : ''}`)
    setIsPaying(false)
  }

  const confirmPinAndPay = async () => {
    if (isPaying) return
    setIsPaying(true)
    if (!recipientName?.trim()) {
      setToast('받는 분 이름을 입력해주세요')
      setIsPaying(false)
      return
    }
    if (!recipientPhone?.trim()) {
      setToast('연락처를 입력해주세요')
      setIsPaying(false)
      return
    }
    if (!address?.trim()) {
      setToast('배송지 주소를 입력해주세요')
      setIsPaying(false)
      return
    }
    if (!meId || pinInput.length !== 6 || pinChecking) {
      setIsPaying(false)
      return
    }
    setPinChecking(true)
    const { data: me } = await supabase.from('users').select('payment_pin').eq('id', meId).maybeSingle()
    if (!me?.payment_pin || String(me.payment_pin) !== pinInput) {
      setPinChecking(false)
      setToast('결제 PIN이 올바르지 않습니다')
      setIsPaying(false)
      return
    }
    setPinOpen(false)
    setPinChecking(false)
    router.push(`/payment/payapp?product_id=${orderedProducts[0]?.id}&amount=${payAppAmount}&shipping_fee=${shippingFee}&grade_discount=${gradeDiscountAmt}&subtotal=${subtotal}&qty=1&recipient_name=${encodeURIComponent(recipientName || '')}&recipient_phone=${encodeURIComponent(recipientPhone || '')}&address=${encodeURIComponent(address || '')}&address_detail=${encodeURIComponent(addressDetail || '')}&coupon_discount=${couponDiscount}&user_coupon_id=${(selectedUserCouponId && !selectedUserCouponId.startsWith('virtual_')) ? selectedUserCouponId : ''}`)
    setIsPaying(false)
  }

  const onChargeKrw = async (krw: number) => {
    const params = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search.slice(1) : ''
    )
    params.set('charge_done', '1')
    const return_url = '/checkout?' + params.toString()
    const payRes = await fetch('/api/payments/payapp/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ kind: 'charge', amount: krw, return_url }),
    })
    const payJson = await payRes.json().catch(() => ({}))
    if (!payRes.ok || !payJson?.ok || !payJson?.pay_url) {
      setToast((payJson as { error?: string })?.error || '충전 결제 요청 실패')
      return
    }
    window.location.href = payJson.pay_url as string
  }

  const handleBankTransfer = async () => {
    if (!recipientName?.trim()) {
      setToast('받는 분 이름을 입력해주세요')
      return
    }
    if (!recipientPhone?.trim()) {
      setToast('연락처를 입력해주세요')
      return
    }
    if (!address?.trim()) {
      setToast('배송지 주소를 입력해주세요')
      return
    }
    if (!orderedProducts.length || !meId) return
    if (subtotal < minOrderAmount) {
      setToast(`최소 주문금액은 ₩${minOrderAmount.toLocaleString()}입니다`)
      return
    }
    const productId = orderedProducts[0]?.id
    const qty = qtyList[0] ?? 1
    const res = await fetch('/api/payment/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        product_id: productId,
        quantity: qty,
        prescription_owner_id: null,
        payment_method: 'bank_transfer',
        total_amount: subtotal,
        final_amount: payAppAmount,
        toast_used: toastUsed,
        referrer_user_id: refUserId || undefined,
        recipient_name: recipientName || null,
        recipient_phone: recipientPhone || null,
        address: [address].filter(Boolean).join(' ') || null,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json?.ok || !json?.orderId) {
      setToast((json as { error?: string })?.error || '무통장 주문 요청 실패')
      return
    }
    router.push(`/orders/complete?order_id=${encodeURIComponent(String(json.orderId))}`)
  }

  return (
    <CustomerDashboardShell>
      <DashboardHeader title="체크아웃" right={<CartHeaderButton />} />
      <CheckoutPageView
        toast={toast}
        loading={loading}
        orderedProducts={orderedProducts}
        qtyList={qtyList}
        giftTo={giftTo}
        recipientName={recipientName}
        setRecipientName={setRecipientName}
        recipientPhone={recipientPhone}
        setRecipientPhone={setRecipientPhone}
        address={address}
        setAddress={setAddress}
        addressDetail={addressDetail}
        setAddressDetail={setAddressDetail}
        meId={meId}
        savedAddresses={savedAddresses}
        setSavedAddresses={setSavedAddresses}
        addressSheetOpen={addressSheetOpen}
        setAddressSheetOpen={setAddressSheetOpen}
        subtotal={subtotal}
        afterGrade={afterGrade}
        isFounder={isFounderUser}
        founderDiscountAmt={founderDiscountAmt}
        gradeDiscount={gradeDiscount}
        gradeDiscountAmt={gradeDiscountAmt}
        gradeName={gradeName}
        couponDiscount={couponDiscount}
        applicableCheckoutCoupons={applicableCheckoutCoupons}
        selectedUserCouponId={selectedUserCouponId}
        setSelectedUserCouponId={setSelectedUserCouponId}
        maxCouponPct={maxCouponPct}
        payWithToast={payWithToast}
        setPayWithToast={setPayWithToast}
        toastDraftWon={toastDraftWon}
        setToastDraftWon={setToastDraftWon}
        afterCoupon={afterCoupon}
        payWithOran={payWithOran}
        setPayWithOran={setPayWithOran}
        oranDraftWon={oranDraftWon}
        setOranDraftWon={setOranDraftWon}
        oranUsed={oranUsed}
        toastUsed={toastUsed}
        points={points}
        balance={balance}
        toastRate={toastRate}
        needCharge={needCharge}
        paying={paying || isPaying}
        showChargeOption={showChargeOption}
        couponSheetOpen={couponSheetOpen}
        setCouponSheetOpen={setCouponSheetOpen}
        userCoupons={userCoupons}
        setUserCoupons={setUserCoupons}
        authUid={authUid}
        orderLines={orderLines}
        shippingFee={shippingFee}
        extraShippingFee={extraShippingFee}
        freeShippingThreshold={freeShippingThreshold}
        onPay={onPay}
        onPayBankTransfer={handleBankTransfer}
        groupbuyDiscount={groupbuyDiscount}
        timesaleDiscount={timesaleDiscount}
        hasTimesaleOrGroupbuy={hasTimesaleOrGroupbuy}
        // ===== [또또복권] 미달 안내 props 전달 =====
        generalShortage={generalShortage}
        rnobelShortage={rnbAmount > 0 ? rnobelShortage : undefined}
        generalProgress={generalProgress}
        rnobelProgress={rnbAmount > 0 ? rnobelProgress : undefined}
      />
      {pinOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 340, background: '#141210', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>결제 PIN 확인</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>6자리 결제 PIN을 입력해 주세요.</div>
            <input
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: '#0d0b09', color: '#fff', padding: '0 12px', marginBottom: 12, fontSize: 16, letterSpacing: 4 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setPinOpen(false)}
                style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,0.16)', background: 'transparent', color: 'rgba(255,255,255,0.72)', cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                onClick={confirmPinAndPay}
                disabled={pinInput.length !== 6 || pinChecking || settingsLoading || isPaying}
                style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: '#C9A96E', color: '#0d0b09', fontWeight: 700, cursor: 'pointer', opacity: pinInput.length !== 6 || pinChecking || settingsLoading || isPaying ? 0.6 : 1 }}
              >
                {pinChecking ? '확인 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {payModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'flex-end',zIndex:999}}>
          <div style={{width:'100%',background:'#171310',borderRadius:'20px 20px 0 0',padding:'24px 20px 40px'}}>
            <div style={{fontSize:16,fontWeight:700,color:'#e8e4dc',marginBottom:6}}>결제 방법 선택</div>
            <div style={{fontSize:13,color:'#888',marginBottom:20}}>토스트 잔액이 부족해요</div>
            <button onClick={() => { setPayModal(false); router.push('/wallet?return=' + encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')) }}
              style={{width:'100%',background:'#C9A96E',border:'none',borderRadius:12,padding:'14px 0',fontSize:15,fontWeight:800,color:'#000',marginBottom:10,cursor:'pointer',fontFamily:'inherit'}}>
              충전하고 결제하기<br/>
              <span style={{fontSize:11,fontWeight:400}}>토스트 충전 후 결제 · 구매금액의 5% 적립</span>
            </button>
            <button onClick={() => { setPayModal(false); setEarnToast(false); router.push(`/payment/payapp?product_id=${orderedProducts[0]?.id}&qty=1&amount=${payAppAmount}&shipping_fee=${shippingFee}&grade_discount=${gradeDiscountAmt}&subtotal=${subtotal}&recipient_name=${encodeURIComponent(recipientName || '')}&recipient_phone=${encodeURIComponent(recipientPhone || '')}&address=${encodeURIComponent(address || '')}&address_detail=${encodeURIComponent(addressDetail || '')}&coupon_discount=${couponDiscount}`) }}
              disabled={settingsLoading || isPaying}
              style={{width:'100%',background:'#1e1a14',border:'1px solid #2a2520',borderRadius:12,padding:'14px 0',fontSize:15,fontWeight:700,color:'#e8e4dc',cursor:'pointer',fontFamily:'inherit'}}>
              지금 바로 결제하기<br/>
              <span style={{fontSize:11,fontWeight:400,color:'#888'}}>토스트 없이 바로 결제</span>
            </button>
          </div>
        </div>
      )}
    </CustomerDashboardShell>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>불러오는 중...</div>}>
      <CheckoutPageInner />
    </Suspense>
  )
}
