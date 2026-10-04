'use client'

import { Suspense } from 'react'
import CheckoutFlow from '@/components/checkout/CheckoutFlow'

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>불러오는 중...</div>}>
      <CheckoutFlow />
    </Suspense>
  )
}
