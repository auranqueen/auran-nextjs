'use client'

import { useCart } from '@/context/CartContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ProductActionBar({
  product,
}: {
  product: { id: string; name: string; retail_price: number; thumb_img: string }
}) {
  const { addToCart } = useCart()
  const router = useRouter()
  const [showGift, setShowGift] = useState(false)

  const handleCart = () => {
    addToCart({
      product_id: product.id,
      name: product.name,
      price: product.retail_price,
      thumb_img: product.thumb_img,
      quantity: 1,
    })
    alert('🛒 장바구니에 담겼어요!')
  }

  const handleBuy = () => {
    router.push(`/checkout?product_id=${product.id}`)
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          background: '#0a0a0a',
          borderTop: '1px solid #222',
          zIndex: 100,
        }}
      >
        <button
          onClick={handleCart}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 12,
            background: '#1a1a1a',
            color: '#fff',
            fontSize: 15,
            border: '1px solid #333',
            cursor: 'pointer',
          }}
        >
          🛒 장바구니
        </button>

        <button
          onClick={() => setShowGift(true)}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 12,
            background: '#2a1a2a',
            color: '#fff',
            fontSize: 15,
            border: '1px solid #444',
            cursor: 'pointer',
          }}
        >
          🎁 선물하기
        </button>

        <button
          onClick={handleBuy}
          style={{
            flex: 1,
            padding: '14px 0',
            borderRadius: 12,
            background: '#C9A96E',
            color: '#000',
            fontSize: 15,
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          구매하기
        </button>
      </div>

      {showGift && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: '#1a1a1a',
              borderRadius: 16,
              padding: 24,
              width: 320,
            }}
          >
            <h3 style={{ color: '#fff', marginBottom: 16 }}>🎁 선물할 회원 검색</h3>
            <p style={{ color: '#888', fontSize: 14 }}>준비 중입니다</p>
            <button
              onClick={() => setShowGift(false)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: 12,
                background: '#333',
                color: '#fff',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  )
}
