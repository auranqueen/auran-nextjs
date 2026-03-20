'use client'

import { useEffect, useMemo, useState } from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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
  const [qty, setQty] = useState(1)

  const toastRate = getSettingNum('toast', 'exchange_rate', 100)
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
  const giftMessage = search.get('message') || ''

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
      setMeId(me.id)
      setPoints(toNum(me.points))
      setBalance(toNum(me.charge_balance))
      if (productIds.length > 0) {
        const { data: rows } = await supabase
          .from('products')
          .select('id,name,thumb_img,retail_price,brands(name)')
          .in('id', productIds)
          .eq('status', 'active')
          .gt('retail_price', 0)
        setProducts(rows || [])
      }
      const q = Number(search.get('qty') || '1')
      setQty(Math.max(1, Math.min(99, Number.isFinite(q) ? q : 1)))
      setLoading(false)
    }
    run()
  }, [supabase, router, productIds.join(','), search])

  const subtotal = useMemo(() => products.reduce((s, p) => s + toNum(p.retail_price) * qty, 0), [products, qty])
  const maxPointsUsable = useMemo(() => Math.min(points, Math.floor((subtotal * maxPointRate) / 100)), [points, subtotal, maxPointRate])
  const pointUsed = useMemo(() => {
    if (!usePoints) return 0
    const input = Math.max(0, Math.floor(pointInput || 0))
    return Math.min(maxPointsUsable, input)
  }, [usePoints, pointInput, maxPointsUsable])
  const remaining = Math.max(0, subtotal - pointUsed)
  const toastUsed = checkoutToastFirst ? Math.min(balance, remaining) : 0
  const needCharge = Math.max(0, remaining - toastUsed)

  useEffect(() => {
    setPointInput(maxPointsUsable)
  }, [maxPointsUsable])

  const onPay = async (allowCharge = true) => {
    if (!products.length || !meId) return
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
      const payload = {
        items: products.map((p) => ({ product_id: p.id, quantity: qty })),
        use_points: pointUsed,
        use_charge: toastUsed,
        gift_to: giftTo || null,
        gift_message: giftMessage || null,
      }
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
      <DashboardHeader title="체크아웃" right={<NoticeBell />} />
      <div style={{ padding: 16 }}>
        {toast && <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12 }}>{toast}</div>}
        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {products.map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{p.name} · {qty}개</div>
                  <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 800 }}>₩{(toNum(p.retail_price) * qty).toLocaleString()}</div>
                </div>
              ))}
            </div>
            {!!giftTo && <div style={{ marginBottom: 10, fontSize: 12, color: '#bcd6ff' }}>🎁 선물 주문 · 받는 분 ID: {giftTo}</div>}

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff', fontSize: 13 }}><span>주문금액</span><span>₩{subtotal.toLocaleString()}</span></div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', color: needCharge > 0 ? '#e57373' : '#fff', fontSize: 14, fontWeight: 900 }}>
                <span>추가 필요</span>
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
                {paying ? '결제 준비 중...' : `결제하기 · 최종 ₩${needCharge.toLocaleString()}`}
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
