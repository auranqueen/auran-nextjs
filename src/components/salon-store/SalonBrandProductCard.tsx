'use client'

import type { SalonBrandProductItem } from '@/types/salonBrandProducts'

const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const GOLD = '#C9A96E'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'

type Props = {
  item: SalonBrandProductItem
  salonId: string
  onSelect?: () => void
}

export default function SalonBrandProductCard({ item, onSelect }: Props) {
  const price = item.consumer_price
  const showPrice = typeof price === 'number' && price > 0

  return (
    <div
      onClick={onSelect}
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        minWidth: 0,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 8,
          flexShrink: 0,
          background: item.thumb_img
            ? `url(${item.thumb_img}) center/cover no-repeat`
            : PURPLE_LIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          overflow: 'hidden',
        }}
      >
        {!item.thumb_img ? '🧴' : null}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {item.brand_name ? (
          <div
            style={{
              fontSize: 10,
              color: TEXT_SUB,
              marginBottom: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.brand_name}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.35,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word',
          }}
        >
          {item.name || '제품'}
        </div>
        {showPrice ? (
          <div style={{ fontSize: 13, color: GOLD, marginTop: 4 }}>
            {price.toLocaleString()}원
          </div>
        ) : null}
      </div>
    </div>
  )
}
