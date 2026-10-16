'use client'

import { useRouter } from 'next/navigation'
import type { LiveWatchProduct } from './LiveWatchProductBar'

const PURPLE = '#7B5EA7'
const TEXT = '#1a1a1a'

const won = (n: number | null) => (n == null ? '' : `${n.toLocaleString('ko-KR')}원`)

export default function LiveWatchProductDetail({
  product,
  salonId,
  onBack,
}: {
  product: LiveWatchProduct
  salonId: string | null
  onBack: () => void
}) {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', color: TEXT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <button
          type="button"
          aria-label="제품 목록으로"
          onClick={onBack}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: TEXT, padding: 0, lineHeight: 1 }}
        >
          ←
        </button>
        <div style={{ fontSize: 13, color: TEXT }}>제품 목록</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', background: '#f5f5f5', marginBottom: 14 }}>
          {product.thumb_img ? (
            <img src={product.thumb_img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
        </div>
        <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.4, marginBottom: 8 }}>{product.name}</div>
        <div style={{ fontSize: 13, color: PURPLE, marginBottom: 16 }}>{won(product.consumer_price)}</div>
        {salonId ? (
          <button
            type="button"
            onClick={() => router.push(`/salons/${salonId}/products/${product.id}`)}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 10,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            제품 상세 보기
          </button>
        ) : null}
      </div>
    </div>
  )
}