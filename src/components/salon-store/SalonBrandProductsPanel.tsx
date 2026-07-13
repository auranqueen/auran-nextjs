'use client'

import SalonBrandProductCard from '@/components/salon-store/SalonBrandProductCard'
import type { SalonBrandProductItem } from '@/types/salonBrandProducts'

const TEXT_SUB = 'rgba(255,255,255,0.55)'

type Props = {
  loading: boolean
  products: SalonBrandProductItem[]
}

export default function SalonBrandProductsPanel({ loading, products }: Props) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 32 }}>
        제품을 불러오는 중이에요…
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 32 }}>
        아직 등록된 제품이 없어요
      </div>
    )
  }

  return (
    <div>
      {products.map((item) => (
        <SalonBrandProductCard key={item.id} item={item} />
      ))}
    </div>
  )
}
