'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardHeader from '@/components/DashboardHeader'
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
  const search = useSearchParams()
  const supabase = createClient()
  const { getSettingNum } = useAdminSettings()
  const [loading, setLoading] = useState(true)
  const [meId, setMeId] = useState('')
  const [balance, setBalance] = useState(0)
  const [points, setPoints] = useState(0)
  const [products, setProducts] = useState<any[]>([])
  const [usePoints, setUsePoints] = useState(true)
  const [pointInput, setPointInput] = useState(0)
  const [paying, setPaying] = useState(false)
  const [toast, setToast] = useState('')
  const [chargeSheetOpen, setChargeSheetOpen] = useState(false)
  const [couponSheetOpen, setCouponSheetOpen] = useState(false)
  const [userCoupons, setUserCoupons] = useState<UcRow[]>([])
  const [selectedUserCouponId, setSelectedUserCouponId] = useState<string | null>(null)
  const [authUid, setAuthUid] = useState<string | null>(null)
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [address, setAddress] = useState('')
  const [payWithToast, setPayWithToast] = useState(true)

  const toastRate = getSettingNum('toast', 'exchange_rate', 100)
  const maxCouponPct = getSettingNum('coupon', 'max_percent_discount', 70)
  const maxPointRate = getSettingNum('checkout', 'point_max_ratio', 20) || getSettingNum('toast', 'point_max_usage_rate', 20)
  const showChargeOption = getSettingNum('checkout', 'show_charge_option', 1) === 1
  const minOrderAmount = getSettingNum('checkout', 'min_order_amount', 0)
  const productIds = useMemo(() => {
    const fromProducts = String(search.get('products') || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
    if (fromProducts.length > 0) return fromProducts
    const one = search.get('product_id')?.trim()
    return one ? [one] : []
  }, [search])
  const giftTo = search.get('gift_to') || ''
  const giftMessage = search.get('gift_message') || search.get('message') || ''
  const shareJournalId = search.get('share_journal_id') || ''

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
    const run = async () => {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      let user = sessionData.session?.user ?? null
      if (!user) {
        const { data: auth } = await supabase.auth.getUser()
        user = auth?.user ?? null
      }
      if (!user) {
        router.replace('/login?redirect=/checkout')
        return
      }
      const { data: me } = await supabase.from('users').select('id,name,phone,points,charge_balance').eq('auth_id', user.id).maybeSingle()
      if (!me?.id) {
        router.replace('/login?redirect=/checkout')
        return
      }
      setAuthUid(user.id)
      setMeId(me.id)
      setRecipientName(String((me as any).name || ''))
      setRecipientPhone(String((me as any).phone || ''))
      setPoints(toNum(me.points))
      setBalance(toNum(me.charge_balance))
      const { rows: ucs, error: ucErr } = await fetchUserCouponsWithCoupons(supabase, user.id, { status: 'unused' })
      if (ucErr) console.warn('[checkout] user_coupons', ucErr.message)
      setUserCoupons((ucs || []) as UcRow[])
      if (productIds.length > 0) {
        const { data: rows } = await supabase
          .from('products')
          .select('id,name,thumb_img,retail_price,brand_id,brands(name)')
          .in('id', productIds)
          .eq('status', 'active')
          .gt('retail_price', 0)
        setProducts(rows || [])
      }
      setLoading(false)
    }
    run()
  }, [supabase, router, productIds.join(','), search])

  const subtotal = useMemo(
    () =>
      orderedProducts.reduce((s, p, i) => {
        const q = qtyList[i] ?? qtyList[0] ?? 1
        return s + toNum(p.retail_price) * q
      }, 0),
    [orderedProducts, qtyList]
  )

  const orderLines: OrderLineForCoupon[] = useMemo(
    () =>
      orderedProducts.map((p, i) => {
        const q = qtyList[i] ?? qtyList[0] ?? 1
        return {
          product_id: p.id,
          brand_id: p.brand_id ?? null,
          subtotal: toNum(p.retail_price) * q,
        }
      }),
    [orderedProducts, qtyList]
  )

  const selectedRow = useMemo(
    () => userCoupons.find((u) => u.id === selectedUserCouponId) || null,
    [userCoupons, selectedUserCouponId]
  )
  const couponDiscount = useMemo(() => {
    if (!selectedRow?.coupons || !authUid) return 0
    const c = selectedRow.coupons
    if (!isCouponApplicableForOrder(c, orderLines, subtotal, authUid)) return 0
    return computeCouponDiscount(subtotal, c, { maxPercent: maxCouponPct })
  }, [selectedRow, subtotal, orderLines, authUid, maxCouponPct])

  const afterCoupon = Math.max(0, subtotal - couponDiscount)
  const maxPointsUsable = useMemo(() => Math.min(points, Math.floor((subtotal * maxPointRate) / 100)), [points, subtotal, maxPointRate])
  const pointUsed = useMemo(() => {
    if (!usePoints) return 0
    const input = Math.max(0, Math.floor(pointInput || 0))
    return Math.min(maxPointsUsable, input, afterCoupon)
  }, [usePoints, pointInput, maxPointsUsable, afterCoupon])
  const remaining = Math.max(0, afterCoupon - pointUsed)
  const toastUsed = payWithToast ? Math.min(balance, remaining) : 0
  const needCharge = Math.max(0, remaining - toastUsed)

  useEffect(() => {
    setPointInput(maxPointsUsable)
  }, [maxPointsUsable])

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
      !isCouponApplicableForOrder(row.coupons, orderLines, subtotal, authUid) ||
      computeCouponDiscount(subtotal, row.coupons, { maxPercent: maxCouponPct }) <= 0
    ) {
      setSelectedUserCouponId(null)
    }
  }, [subtotal, userCoupons, selectedUserCouponId, orderLines, authUid, maxCouponPct])

  const applicableCheckoutCoupons = useMemo(() => {
    if (!authUid) return []
    return userCoupons.filter((u) => {
      if (!u.coupons || u.status !== 'unused') return false
      if (isCouponExpiredForUser({ status: u.status, expired_at: u.expired_at }, u.coupons)) return false
      if (!isCouponApplicableForOrder(u.coupons, orderLines, subtotal, authUid)) return false
      return computeCouponDiscount(subtotal, u.coupons, { maxPercent: maxCouponPct }) > 0
    })
  }, [userCoupons, subtotal, orderLines, authUid, maxCouponPct])

  const usableCouponCount = applicableCheckoutCoupons.length

  const onPay = async (allowCharge = true) => {
    if (!orderedProducts.length || !meId) return
    if (subtotal < minOrderAmount) {
      setToast(`최소 주문금액은 ₩${minOrderAmount.toLocaleString()}입니다`)
      return
    }
    if (needCharge > 0) {
      if (!allowCharge) {
        setToast('토스트가 부족해요. 충전 후 구매 가능해요 🍞')
        router.push('/home')
        return
      }
      setChargeSheetOpen(true)
      return
    }
    setPaying(true)
    try {
      const payload: Record<string, unknown> = {
        items: orderedProducts.map((p, i) => ({ product_id: p.id, quantity: qtyList[i] ?? qtyList[0] ?? 1 })),
        use_points: pointUsed,
        use_charge: toastUsed,
        gift_to: giftTo || null,
        gift_message: giftMessage || null,
        recipient_name: recipientName.trim() || null,
        recipient_phone: recipientPhone.trim() || null,
        address: address.trim() || null,
        share_journal_id: shareJournalId || null,
      }
      if (selectedUserCouponId && couponDiscount > 0) payload.user_coupon_id = selectedUserCouponId
      const orderRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const orderJson = await orderRes.json().catch(() => ({}))
      if (!orderRes.ok || !orderJson?.ok) throw new Error(orderJson?.error || '주문 생성 실패')

      if (Number(orderJson.final_amount || 0) > 0) {
        const payRes = await fetch('/api/payments/payapp/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ kind: 'order', amount: orderJson.final_amount, target_id: orderJson.order_id }),
        })
        const payJson = await payRes.json().catch(() => ({}))
        if (!payRes.ok || !payJson?.ok || !payJson?.pay_url) throw new Error(payJson?.error || '결제 요청 실패')
        window.location.href = payJson.pay_url
      } else {
        router.push('/orders?payment=done')
      }
    } catch (e: any) {
      setToast(e?.message || '결제 진행 중 오류가 발생했어요')
    } finally {
      setPaying(false)
    }
  }

  const onChargeKrw = async (krw: number) => {
    const payRes = await fetch('/api/payments/payapp/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ kind: 'charge', amount: krw }),
    })
    const payJson = await payRes.json().catch(() => ({}))
    if (!payRes.ok || !payJson?.ok || !payJson?.pay_url) {
      setToast((payJson as { error?: string })?.error || '충전 결제 요청 실패')
      return
    }
    window.location.href = payJson.pay_url as string
  }

  return (
    <CustomerDashboardShell>
      <DashboardHeader title="체크아웃" right={<CustomerHeaderRight />} />
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
        subtotal={subtotal}
        couponDiscount={couponDiscount}
        applicableCheckoutCoupons={applicableCheckoutCoupons}
        selectedUserCouponId={selectedUserCouponId}
        setSelectedUserCouponId={setSelectedUserCouponId}
        maxCouponPct={maxCouponPct}
        payWithToast={payWithToast}
        setPayWithToast={setPayWithToast}
        toastUsed={toastUsed}
        pointUsed={pointUsed}
        points={points}
        balance={balance}
        toastRate={toastRate}
        usePoints={usePoints}
        setUsePoints={setUsePoints}
        pointInput={pointInput}
        setPointInput={setPointInput}
        maxPointsUsable={maxPointsUsable}
        maxPointRate={maxPointRate}
        needCharge={needCharge}
        paying={paying}
        showChargeOption={showChargeOption}
        chargeSheetOpen={chargeSheetOpen}
        setChargeSheetOpen={setChargeSheetOpen}
        couponSheetOpen={couponSheetOpen}
        setCouponSheetOpen={setCouponSheetOpen}
        userCoupons={userCoupons}
        authUid={authUid}
        orderLines={orderLines}
        onPay={onPay}
        onChargeKrw={onChargeKrw}
      />
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
