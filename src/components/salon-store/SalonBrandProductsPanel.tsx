'use client'

import SalonBrandProductCard from '@/components/salon-store/SalonBrandProductCard'
import type { SalonBrandProductItem } from '@/types/salonBrandProducts'
import { useRouter } from 'next/navigation'

const TEXT_SUB = 'rgba(255,255,255,0.55)'

type Props = {
  loading: boolean
  products: SalonBrandProductItem[]
  salonId: string
}

export default function SalonBrandProductsPanel({ loading, products, salonId }: Props) {
  const router = useRouter()

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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 10,
        }}
      >
        {products.map((item) => (
          <SalonBrandProductCard
            key={item.id}
            item={item}
            salonId={salonId}
            onSelect={() => router.push(`/salons/${salonId}/products/${item.id}`)}
          />
        ))}
      </div>
      <button
        onClick={() => router.push(`/salons/${salonId}/products`)}
        style={{
          width: '100%',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent',
          color: '#7B5EA7',
          borderRadius: 12,
          padding: 11,
          fontSize: 13,
          marginTop: 8,
        }}
      >
        전체보기
      </button>
    </div>
  )
}
