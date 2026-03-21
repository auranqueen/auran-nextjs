'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'
import {
  computeCouponDiscount,
  isCouponApplicableForOrder,
  isCouponExpiredForUser,
  type OrderLineForCoupon,
} from '@/lib/coupon/computeDiscount'

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type UcRow = {
  id: string
  status: string
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

  const toastRate = getSettingNum('toast', 'exchange_rate', 100)
  const maxCouponPct = getSettingNum('coupon', 'max_percent_discount', 70)
  const checkoutToastFirst = getSettingNum('checkout', 'toast_first_priority', 1) === 1
  const maxPointRate = getSettingNum('checkout', 'point_max_ratio', 20) || getSettingNum('toast', 'point_max_usage_rate', 20)
  const showChargeOption = getSettingNum('checkout', 'show_charge_option', 1) === 1
  const minOrderAmount = getSettingNum('checkout', 'min_order_amount', 0)
  const productIds = useMemo(
    () =>
      String(search.get('products') || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    [search]
  )
  const giftTo = search.get('gift_to') || ''
  const giftMessage = search.get('gift_message') || search.get('message') || ''

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
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) {
        router.replace('/login?redirect=/checkout')
        return
      }
      const { data: me } = await supabase.from('users').select('id,points,charge_balance').eq('auth_id', user.id).maybeSingle()
      if (!me?.id) {
        router.replace('/login?redirect=/checkout')
        return
      }
      setAuthUid(user.id)
      setMeId(me.id)
      setPoints(toNum(me.points))
      setBalance(toNum(me.charge_balance))
      const { data: ucs } = await supabase
        .from('user_coupons')
        .select('id,status,coupons(*)')
        .eq('user_id', user.id)
        .eq('status', 'unused')
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
  const toastUsed = checkoutToastFirst ? Math.min(balance, remaining) : 0
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
      isCouponExpiredForUser({ status: 'unused' }, row.coupons) ||
      !isCouponApplicableForOrder(row.coupons, orderLines, subtotal, authUid) ||
      computeCouponDiscount(subtotal, row.coupons, { maxPercent: maxCouponPct }) <= 0
    ) {
      setSelectedUserCouponId(null)
    }
  }, [subtotal, userCoupons, selectedUserCouponId, orderLines, authUid, maxCouponPct])

  const usableCouponCount = useMemo(() => {
    if (!authUid) return 0
    return userCoupons.filter((u) => {
      if (!u.coupons) return false
      if (isCouponExpiredForUser({ status: u.status }, u.coupons)) return false
      if (!isCouponApplicableForOrder(u.coupons, orderLines, subtotal, authUid)) return false
      return computeCouponDiscount(subtotal, u.coupons, { maxPercent: maxCouponPct }) > 0
    }).length
  }, [userCoupons, subtotal, orderLines, authUid, maxCouponPct])

  const onPay = async (allowCharge = true) => {
    if (!orderedProducts.length || !meId) return
    if (subtotal < minOrderAmount) {
      setToast(`최소 주문금액은 ₩${minOrderAmount.toLocaleString()}입니다`)
      return
    }
    if (needCharge > 0) {
      if (!allowCharge) {
        setToast('토스트가 부족해요. 충전 후 구매 가능해요 🍞')
        router.push('/dashboard/customer')
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="체크아웃" right={<CustomerHeaderRight />} />
      <div style={{ padding: 16 }}>
        {toast && <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12 }}>{toast}</div>}
        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {orderedProducts.map((p, idx) => {
                const lineQty = qtyList[idx] ?? qtyList[0] ?? 1
                return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{p.name} · {lineQty}개</div>
                  <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 800 }}>₩{(toNum(p.retail_price) * lineQty).toLocaleString()}</div>
                </div>
              )})}
            </div>
            {!!giftTo && <div style={{ marginBottom: 10, fontSize: 12, color: '#bcd6ff' }}>🎁 선물 주문 · 받는 분 ID: {giftTo}</div>}

            <button
              type="button"
              onClick={() => setCouponSheetOpen(true)}
              style={{
                width: '100%',
                marginBottom: 10,
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(201,168,76,0.35)',
                background: 'rgba(201,168,76,0.08)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>🎫 쿠폰 {selectedRow?.coupons?.name ? `· ${selectedRow.coupons.name}` : ''}</span>
              <span style={{ color: 'var(--gold)' }}>사용가능 {usableCouponCount}장 ›</span>
            </button>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff', fontSize: 13 }}><span>주문금액</span><span>₩{subtotal.toLocaleString()}</span></div>
              {couponDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#7eb8ff', fontSize: 13 }}>
                  <span>🎫 쿠폰 할인</span>
                  <span>-₩{couponDiscount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#4cad7e', fontSize: 13 }}><span>🍞 토스트 사용</span><span>-₩{toastUsed.toLocaleString()}</span></div>
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>보유: {Math.floor(balance / Math.max(1, toastRate)).toLocaleString()}T (₩{balance.toLocaleString()})</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#c9a84c', fontSize: 13 }}>
                <span>✨ 포인트 사용</span>
                <span>-₩{pointUsed.toLocaleString()}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                포인트 사용 (최대 {maxPointRate}%)
              </label>
              {usePoints && (
                <input
                  type="number"
                  min={0}
                  max={maxPointsUsable}
                  value={pointInput}
                  onChange={(e) => setPointInput(Math.max(0, Math.min(maxPointsUsable, Number(e.target.value || 0))))}
                  style={{ width: '100%', marginBottom: 8, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#fff' }}
                />
              )}
              <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>보유: {points.toLocaleString()}P · 최대 ₩{maxPointsUsable.toLocaleString()}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', color: needCharge > 0 ? '#e57373' : '#fff', fontSize: 14, fontWeight: 900 }}>
                <span>최종 결제금액</span>
                <span>₩{needCharge.toLocaleString()}</span>
              </div>
              {showChargeOption && needCharge > 0 && (
                <button onClick={() => setChargeSheetOpen(true)} style={{ marginTop: 10, width: '100%', height: 42, borderRadius: 10, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}>
                  ⚡ 토스트 충전 후 결제
                </button>
              )}
              {needCharge > 0 && (
                <button onClick={() => onPay(false)} style={{ marginTop: 8, width: '100%', height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: 'var(--text3)', fontWeight: 800 }}>
                  토스트 충전 안함 · 부분결제 불가
                </button>
              )}
              <button onClick={() => onPay(true)} disabled={paying || needCharge > 0} style={{ marginTop: 10, width: '100%', height: 42, borderRadius: 10, border: 'none', background: needCharge > 0 ? '#55606f' : '#c9a84c', color: needCharge > 0 ? '#c8d0db' : '#111', fontWeight: 900 }}>
                {paying ? '결제 준비 중...' : `결제하기 · ₩${needCharge.toLocaleString()}`}
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
              {`🍞 ${(Math.floor(balance / Math.max(1, toastRate))).toLocaleString()}T 보유 (1T=${toastRate}원)`}
            </div>
          </>
        )}
      </div>
      {chargeSheetOpen && (
        <div onClick={() => setChargeSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 130 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, marginBottom: 8 }}>토스트 충전 선택</div>
            {[{ t: 100, p: 10000 }, { t: 300, p: 30000, popular: true }, { t: 500, p: 50000 }, { t: 1000, p: 100000, bonus: 50 }].map((pkg) => (
              <button
                key={pkg.t}
                type="button"
                onClick={async () => {
                  const payRes = await fetch('/api/payments/payapp/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({ kind: 'charge', amount: pkg.p }),
                  })
                  const payJson = await payRes.json().catch(() => ({}))
                  if (!payRes.ok || !payJson?.ok || !payJson?.pay_url) {
                    setToast(payJson?.error || '충전 결제 요청 실패')
                    return
                  }
                  window.location.href = payJson.pay_url
                }}
                style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800, marginTop: 8, textAlign: 'left', padding: '0 12px' }}
              >
                🍞 {pkg.t.toLocaleString()}T  ₩{pkg.p.toLocaleString()} {pkg.popular ? '[인기 🔥]' : ''} {pkg.bonus ? `(+${pkg.bonus}T 보너스)` : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      {couponSheetOpen && (
        <div onClick={() => setCouponSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 131 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 0,
              width: '100%',
              maxWidth: 480,
              maxHeight: '72vh',
              overflow: 'auto',
              background: '#11161b',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderTop: '1px solid var(--border)',
              padding: 14,
            }}
          >
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 900, marginBottom: 10 }}>쿠폰 선택</div>
            <button
              type="button"
              onClick={() => { setSelectedUserCouponId(null); setCouponSheetOpen(false) }}
              style={{ width: '100%', padding: 10, marginBottom: 8, borderRadius: 10, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', fontSize: 12 }}
            >
              쿠폰 적용 안 함
            </button>
            {userCoupons.map((uc) => {
              const c = uc.coupons
              if (!c) return null
              const expired = isCouponExpiredForUser({ status: uc.status }, c)
              const applicable =
                !!authUid && !expired && isCouponApplicableForOrder(c, orderLines, subtotal, authUid)
              const disc = applicable ? computeCouponDiscount(subtotal, c, { maxPercent: maxCouponPct }) : 0
              const ok = applicable && disc > 0
              const sel = selectedUserCouponId === uc.id
              const minO = Math.max(0, Number(c.min_order ?? 0))
              const subFail = !expired && subtotal < minO
              const dt = (c.discount_type || (c.type === 'rate' ? 'rate' : 'amount')) as string
              const dv =
                c.discount_value != null
                  ? Number(c.discount_value)
                  : dt === 'rate'
                    ? Number(c.discount_rate || 0)
                    : Number(c.discount_amount || 0)
              const discLabel =
                dt === 'rate' ? `${dv}% 할인` : `₩${dv.toLocaleString()} 할인`
              return (
                <button
                  key={uc.id}
                  type="button"
                  disabled={!ok}
                  onClick={() => {
                    if (!ok) return
                    setSelectedUserCouponId(uc.id)
                    setCouponSheetOpen(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 12,
                    marginBottom: 8,
                    borderRadius: 12,
                    border: sel ? '1px solid rgba(201,168,76,0.6)' : '1px solid var(--border)',
                    background: ok ? 'rgba(201,168,76,0.08)' : 'rgba(0,0,0,0.2)',
                    color: ok ? '#fff' : 'rgba(255,255,255,0.35)',
                    cursor: ok ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: ok ? 'var(--gold)' : 'inherit' }}>{discLabel}</div>
                  {!ok && (
                    <div style={{ fontSize: 11, marginTop: 6, color: '#888' }}>
                      {expired ? '기간 만료' : subFail ? `최소 주문 ₩${minO.toLocaleString()} 미충족` : '이 상품에 적용 불가'}
                    </div>
                  )}
                </button>
              )
            })}
            {userCoupons.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>사용 가능한 쿠폰이 없어요. 나 → 쿠폰함을 확인해 주세요.</div>}
          </div>
        </div>
      )}
      <DashboardBottomNav role="customer" />
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>불러오는 중...</div>}>
      <CheckoutPageInner />
    </Suspense>
  )
}
