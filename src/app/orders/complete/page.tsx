import { Suspense } from 'react'
import OrderCompleteClient from './client'

export default function OrderCompletePage() {
  return (
    <Suspense fallback={<div style={{background:'#0D0B09',minHeight:'100vh'}}/>}>
      <OrderCompleteClient />
    </Suspense>
  )
}

