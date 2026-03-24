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

const TEST_PRODUCT = {
  id: 'test-1',
  name: '테스트 결제 상품',
  retail_price: 100,
  thumb_img: '',
  brand_id: null as string | null,
  brands: { name: 'TEST' },
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
  const [payModal, setPayModal] = useState(false)
  const [earnToast, setEarnToast] = useState(true)
  const [pinOpen, setPinOpen] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pinChecking, setPinChecking] = useState(false)

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
    const one = (search.get('productId') || search.get('product_id') || '').trim()
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
        setLoading(false)
        return
      }
      const { data: me } = await supabase.from('users').select('id,name,phone,points,charge_balance').eq('auth_id', user.id).maybeSingle()
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
      const { rows: ucs, error: ucErr } = await fetchUserCouponsWithCoupons(supabase, user.id, { status: 'unused' })
      if (ucErr) console.warn('[checkout] user_coupons', ucErr.message)
      setUserCoupons((ucs || []) as UcRow[])
      if (productIds.length > 0) {
        const { data: rows } = await supabase
          .from('products')
          .select('id,name,thumb_img,retail_price,brand_id')
          .in('id', productIds)
          .eq('status', 'active')
          .gt('retail_price', 0)
        const fetched = rows || []
        const hasValidPrice = fetched.some((p: any) => toNum(p.retail_price) > 0)
        setProducts(hasValidPrice ? fetched : [TEST_PRODUCT])
      } else {
        setProducts([TEST_PRODUCT])
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

  const onPay = async (allowCharge = true) => {
    if (!orderedProducts.length || !meId) return
    if (subtotal < minOrderAmount) {
      setToast(`최소 주문금액은 ₩${minOrderAmount.toLocaleString()}입니다`)
      return
    }
    if (needCharge > 0) {
      setPayModal(true)
      return
    }
    router.push(`/payment/payapp?product_id=${orderedProducts[0]?.id}&qty=1`)
  }

  const confirmPinAndPay = async () => {
    if (!meId || pinInput.length !== 6 || pinChecking) return
    setPinChecking(true)
    const { data: me } = await supabase.from('users').select('payment_pin').eq('id', meId).maybeSingle()
    if (!me?.payment_pin || String(me.payment_pin) !== pinInput) {
      setPinChecking(false)
      setToast('결제 PIN이 올바르지 않습니다')
      return
    }
    setPinOpen(false)
    setPinChecking(false)
    router.push(`/payment/payapp?product_id=${orderedProducts[0]?.id}&amount=${subtotal}&qty=1`)
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
                disabled={pinInput.length !== 6 || pinChecking}
                style={{ flex: 1, height: 40, borderRadius: 10, border: 'none', background: '#C9A96E', color: '#0d0b09', fontWeight: 700, cursor: 'pointer', opacity: pinInput.length !== 6 || pinChecking ? 0.6 : 1 }}
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
            <button onClick={() => { setPayModal(false); setEarnToast(true); setChargeSheetOpen(true) }}
              style={{width:'100%',background:'#C9A96E',border:'none',borderRadius:12,padding:'14px 0',fontSize:15,fontWeight:800,color:'#000',marginBottom:10,cursor:'pointer',fontFamily:'inherit'}}>
              충전하고 결제하기<br/>
              <span style={{fontSize:11,fontWeight:400}}>토스트 충전 후 결제 · 구매금액의 5% 적립</span>
            </button>
            <button onClick={() => { setPayModal(false); setEarnToast(false); router.push(`/payment/payapp?product_id=${orderedProducts[0]?.id}&qty=1`) }}
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
