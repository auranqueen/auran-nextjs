'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function PayAppInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const productId = params.get('product_id')
    const qty = params.get('qty') || '1'
    const amount = params.get('amount')

    if (!productId && !amount) {
      router.push('/home')
      return
    }

    const doPayment = async () => {
      const res = await fetch('/api/payments/payapp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          kind: 'order',
          amount: Number(amount) || 0,
          target_id: productId,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok && json?.pay_url) {
        window.location.href = json.pay_url
      } else {
        alert('결제 요청 실패: ' + (json?.error || '알 수 없는 오류'))
        router.push('/home')
      }
    }

    doPayment()
  }, [])

  return (
    <div style={{
      background: '#0d0b09', color: '#e8e4dc',
      minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16,
      fontFamily: '"Apple SD Gothic Neo", sans-serif'
    }}>
      <div style={{ fontSize: 32 }}>🔄</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>결제창으로 이동 중...</div>
      <div style={{ fontSize: 13, color: '#888' }}>잠시만 기다려주세요</div>
    </div>
  )
}

export default function PayAppPage() {
  return (
    <Suspense fallback={
      <div style={{
        background: '#0d0b09', color: '#e8e4dc',
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <div>로딩 중...</div>
      </div>
    }>
      <PayAppInner />
    </Suspense>
  )
}