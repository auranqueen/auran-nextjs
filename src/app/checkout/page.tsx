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
  const [paying, setPaying] = useState(false)
  const [toast, setToast] = useState('')

  const toastRate = getSettingNum('toast', 'exchange_rate', 100)
  const maxPointRate =
    getSettingNum('toast', 'point_max_usage_rate', 20) || getSettingNum('points', 'max_payment_ratio', 20)
  const productIds = useMemo(
    () =>
      String(search.get('products') || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    [search]
  )

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
      setLoading(false)
    }
    run()
  }, [supabase, router, productIds.join(',')])

  const subtotal = useMemo(() => products.reduce((s, p) => s + toNum(p.retail_price), 0), [products])
  const maxPointsUsable = useMemo(() => Math.min(points, Math.floor((subtotal * maxPointRate) / 100)), [points, subtotal, maxPointRate])
  const pointUsed = useMemo(() => (usePoints ? maxPointsUsable : 0), [usePoints, maxPointsUsable])
  const remaining = Math.max(0, subtotal - pointUsed)
  const toastUsed = Math.min(balance, remaining)
  const needCharge = Math.max(0, remaining - toastUsed)

  const onPay = async () => {
    if (!products.length || !meId) return
    if (needCharge > 0) {
      setToast('토스트가 부족해요 🍞')
      router.push('/wallet')
      return
    }
    setPaying(true)
    try {
      const payload = {
        items: products.map((p) => ({ product_id: p.id, quantity: 1 })),
        use_points: pointUsed,
      }
      const orderRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
      const orderJson = await orderRes.json().catch(() => ({}))
      if (!orderRes.ok || !orderJson?.ok) throw new Error(orderJson?.error || '주문 생성 실패')

      const payRes = await fetch('/api/payments/payapp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ kind: 'order', amount: orderJson.final_amount, target_id: orderJson.order_id }),
      })
      const payJson = await payRes.json().catch(() => ({}))
      if (!payRes.ok || !payJson?.ok || !payJson?.pay_url) throw new Error(payJson?.error || '결제 요청 실패')
      window.location.href = payJson.pay_url
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
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 800 }}>₩{toNum(p.retail_price).toLocaleString()}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#fff', fontSize: 13 }}><span>주문금액</span><span>₩{subtotal.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#4cad7e', fontSize: 13 }}><span>🍞 토스트 사용</span><span>-₩{toastUsed.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: '#c9a84c', fontSize: 13 }}>
                <span>✨ 포인트 사용</span>
                <span>-₩{pointUsed.toLocaleString()}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'var(--text3)' }}>
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                포인트 사용 (최대 {maxPointRate}%)
              </label>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: needCharge > 0 ? '#e57373' : '#fff', fontSize: 14, fontWeight: 900 }}>
                <span>추가 필요</span>
                <span>₩{needCharge.toLocaleString()}</span>
              </div>
              <button onClick={onPay} disabled={paying} style={{ marginTop: 10, width: '100%', height: 42, borderRadius: 10, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}>
                {paying ? '결제 준비 중...' : needCharge > 0 ? '토스트 충전 후 결제' : '결제하기'}
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
              {`🍞 ${(Math.floor(balance / Math.max(1, toastRate))).toLocaleString()}T 보유 (1T=${toastRate}원)`}
            </div>
          </>
        )}
      </div>
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
