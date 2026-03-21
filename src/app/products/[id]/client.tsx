'use client'

import { useState } from 'react'
import ProductActionBar from '@/components/ProductActionBar'

export default function ProductDetailClient({ product }: { product: any }) {
  const [qty, setQty] = useState(1)
  const unit = Math.max(0, Math.floor(Number(product.retail_price) || 0))
  const isPriceUnset = unit < 1

  return (
    <div style={{ paddingBottom: 100, maxWidth: 480, margin: '0 auto' }}>
      <div
        style={{
          background: '#1a1a1a',
          aspectRatio: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {product.thumb_img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumb_img}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <span style={{ fontSize: 60 }}>🧴</span>
        )}
      </div>

      <div style={{ padding: '20px 16px' }}>
        <p style={{ color: '#888', fontSize: 13 }}>{product.brands?.name}</p>
        <h1 style={{ color: '#fff', fontSize: 20, margin: '4px 0 12px' }}>{product.name}</h1>
        <p style={{ color: '#C9A96E', fontSize: 22, fontWeight: 700 }}>
          {isPriceUnset ? '준비 중' : `₩${unit.toLocaleString()}`}
        </p>

        {product.description ? (
          <p style={{ color: '#aaa', fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>{product.description}</p>
        ) : null}

        {!isPriceUnset ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 24,
              padding: '16px',
              background: '#1a1a1a',
              borderRadius: 12,
            }}
          >
            <span style={{ color: '#fff' }}>수량</span>
            <button
              type="button"
              onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#333',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              -
            </button>
            <span style={{ color: '#fff', minWidth: 24, textAlign: 'center' }}>{qty}</span>
            <button
              type="button"
              onClick={() => setQty(q => Math.min(99, q + 1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#333',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              +
            </button>
          </div>
        ) : null}
      </div>

      {!isPriceUnset ? (
        <ProductActionBar
          product={{
            id: String(product.id),
            name: String(product.name || '제품'),
            retail_price: unit,
            thumb_img: String(product.thumb_img || ''),
          }}
          quantity={qty}
        />
      ) : null}
    </div>
  )
}
