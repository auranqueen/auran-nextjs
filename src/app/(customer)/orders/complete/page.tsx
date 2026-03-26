'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const PURPLE = '#9B8AFB'

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isNaN(n) ? fallback : n
  }
  return fallback
}

function OrderCompleteContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [orderMissing, setOrderMissing] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [orderNo, setOrderNo] = useState<string>('')
  const [productLabel, setProductLabel] = useState<string>('')
  const [productQty, setProductQty] = useState<number>(1)
  const [payAmount, setPayAmount] = useState<number>(0)
  const [toastAmount, setToastAmount] = useState<number | null>(null)
  const [purchaseRate, setPurchaseRate] = useState<number>(3)

  useEffect(() => {
    if (!orderId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const loggedIn = !!user

      const { data: order } = await supabase
        .from('orders')
        .select('id, order_no, items, total_amount, final_amount')
        .eq('id', orderId)
        .maybeSingle()

      if (!order) {
        if (!cancelled) {
          setOrderMissing(true)
          setLoading(false)
        }
        return
      }

      let items: any[] = []
      try {
        items = (order as { items?: string })?.items ? JSON.parse((order as { items?: string }).items as string) : []
      } catch {
        items = []
      }
      const productName = items[0]?.product_name || '상품'
      const qty = Number(items[0]?.quantity || 1)

      let tx: { amount?: number } | null = null
      let bs: { setting_value?: unknown } | null = null
      if (loggedIn) {
        const txRes = await supabase
          .from('toast_transactions')
          .select('amount')
          .eq('reference_id', orderId)
          .eq('transaction_type', 'purchase')
          .maybeSingle()
        tx = txRes.data as { amount?: number } | null
        const bsRes = await supabase
          .from('benefit_settings')
          .select('setting_value')
          .eq('setting_key', 'purchase_point_rate')
          .maybeSingle()
        bs = bsRes.data as { setting_value?: unknown } | null
      }

      if (!cancelled) {
        setIsLoggedIn(loggedIn)
        setOrderNo(String((order as { order_no?: string; id?: string }).order_no || (order as { id?: string }).id || ''))
        setProductLabel(productName)
        setProductQty(Number.isNaN(qty) ? 1 : qty)
        setPayAmount(num((order as { final_amount?: number }).final_amount, 0))
        setToastAmount(tx ? num(tx.amount, 0) : null)
        setPurchaseRate(num(bs?.setting_value, 3))
        setOrderMissing(false)
        setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [orderId, supabase])

  if (!orderId) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24, fontFamily: 'sans-serif' }}>
        <p style={{ color: 'rgba(255,255,255,0.55)' }}>order_id 가 없습니다.</p>
      </div>
    )
  }

  if (orderMissing) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24, fontFamily: 'sans-serif' }}>
        <p style={{ color: GOLD }}>주문 정보를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        padding: '28px 20px 48px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <style>{`
        @keyframes orderCompletePulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.08); opacity: 0.65; }
        }
        @keyframes orderCompletePop {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: '50%',
            border: `2px solid ${PURPLE}`,
            animation: 'orderCompletePulse 2s ease-in-out infinite',
          }}
        />
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: `linear-gradient(145deg, ${GOLD}33, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            animation: 'orderCompletePop 0.6s ease-out forwards',
            position: 'relative',
            zIndex: 1,
          }}
        >
          ✓
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: GOLD, marginBottom: 8 }}>ORDER COMPLETE</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>결제가 완료됐어요</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', padding: 40 }}>불러오는 중…</div>
      ) : (
        <>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 18,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>주문 정보</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>주문번호</span>{' '}
              <span style={{ color: GOLD, fontWeight: 700 }}>{orderNo || '—'}</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>상품</span> {productLabel}
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>수량</span> {productQty}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              결제금액 {payAmount.toLocaleString()}원
            </div>
          </div>

          <div
            style={{
              background: `linear-gradient(135deg, ${PURPLE}18, rgba(201,169,110,0.08))`,
              border: `1px solid ${PURPLE}44`,
              borderRadius: 16,
              padding: 18,
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 11, color: PURPLE, marginBottom: 10, letterSpacing: '0.08em' }}>토스트 적립</div>
            {!isLoggedIn ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>로그인 후 확인 가능</div>
            ) : toastAmount != null && toastAmount > 0 ? (
              <>
                <div style={{ fontSize: 17, fontWeight: 800, color: GOLD, marginBottom: 8 }}>
                  🎉 {toastAmount.toLocaleString()}T 토스트 적립됐어요!
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                  구매금액의 {purchaseRate}% 적립
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                적립 내역을 확인하는 중이거나 아직 반영 전일 수 있어요.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!isLoggedIn ? (
              <>
                <Link
                  href="/login"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px 20px',
                    borderRadius: 12,
                    background: GOLD,
                    border: 'none',
                    color: '#0D0B09',
                    fontSize: 14,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  로그인하기
                </Link>
                <Link
                  href="/"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px 20px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  홈으로
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/dashboard/customer/orders"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px 20px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  주문내역 보기
                </Link>
                <Link
                  href="/dashboard/customer/products"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px 20px',
                    borderRadius: 12,
                    background: GOLD,
                    border: 'none',
                    color: '#0D0B09',
                    fontSize: 14,
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  쇼핑 계속하기
                </Link>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function OrderCompletePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: BG,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'sans-serif',
          }}
        >
          로딩중...
        </div>
      }
    >
      <OrderCompleteContent />
    </Suspense>
  )
}
