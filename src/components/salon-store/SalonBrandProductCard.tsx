'use client'

import type { SalonBrandProductItem } from '@/types/salonBrandProducts'

const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD = '#C9A96E'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'

type Props = {
  item: SalonBrandProductItem
}

export default function SalonBrandProductCard({ item }: Props) {
  const price = item.consumer_price
  const showPrice = typeof price === 'number' && price > 0

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 10,
          flexShrink: 0,
          background: item.thumb_img
            ? `url(${item.thumb_img}) center/cover no-repeat`
            : PURPLE_LIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          overflow: 'hidden',
        }}
      >
        {!item.thumb_img ? '🧴' : null}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {item.brand_name ? (
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>{item.brand_name}</div>
        ) : null}
        <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>{item.name || '제품'}</div>
        {showPrice ? (
          <div style={{ fontSize: 16, color: GOLD, marginTop: 8 }}>
            {price.toLocaleString()}원
          </div>
        ) : null}
      </div>
    </div>
  )
}
