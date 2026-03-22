'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductActionBar from '@/components/ui/ProductActionBar'
import ProductDetailPageView from '@/components/views/ProductDetailPageView'

function earnPercentOf(product: any): number {
  const n = product.earn_points_percent
  if (n != null && n !== '') {
    const v = Number(n)
    if (Number.isFinite(v)) return Math.min(100, Math.max(0, v))
  }
  const e = product.earn_points
  if (e != null && e !== '') {
    const v = Number(e)
    if (Number.isFinite(v)) return Math.min(100, Math.max(0, Math.floor(v)))
  }
  return 0
}

export default function ProductDetailUI({ product }: { product: any }) {
  const router = useRouter()
  const [qty, setQty] = useState(1)
  const [detailTab, setDetailTab] = useState<'detail' | 'review'>('detail')
  const unit = Math.max(0, Math.floor(Number(product.retail_price) || 0))
  const isPriceUnset = unit < 1
  const pct = earnPercentOf(product)
  const lineTotal = unit * qty
  const expectedPurchasePts = useMemo(() => Math.floor((lineTotal * pct) / 100), [lineTotal, pct])

  return (
    <ProductDetailPageView
      product={product}
      onBack={() => router.back()}
      onOpenList={() => router.push('/products')}
      qty={qty}
      onDecQty={() => setQty(q => Math.max(1, q - 1))}
      onIncQty={() => setQty(q => Math.min(99, q + 1))}
      detailTab={detailTab}
      onTab={setDetailTab}
      isPriceUnset={isPriceUnset}
      unit={unit}
      expectedPurchasePts={expectedPurchasePts}
      pct={pct}
      lineTotal={lineTotal}
      actionSlot={
        !isPriceUnset ? (
          <ProductActionBar
            product={{
              id: String(product.id),
              name: String(product.name || '제품'),
              retail_price: unit,
              thumb_img: String(product.thumb_img || ''),
            }}
            quantity={qty}
          />
        ) : null
      }
    />
  )
}
