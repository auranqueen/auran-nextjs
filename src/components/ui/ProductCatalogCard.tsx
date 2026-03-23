'use client'

import Link from 'next/link'
import ProductThumbImage from '@/components/ProductThumbImage'
import { productDisplayImageUrl } from '@/lib/productImage'
import { useCart } from '@/context/CartContext'
import { useEffect, useState } from 'react'

export default function ProductCatalogCard({ p }: { p: any }) {
  const [toast, setToast] = useState('')
  const { addItem } = useCart()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const onCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const price = Number(p.retail_price) || 0
    if (price < 1) {
      setToast('가격이 설정된 상품만 담을 수 있어요')
      return
    }
    const { wasNewLine } = addItem({
      product_id: String(p.id),
      name: String(p.name || '제품'),
      price,
      thumb_img: productDisplayImageUrl(p) ?? p.thumb_img ?? null,
      brand_name: p.brands?.name || '',
      quantity: 1,
    })
    setToast(wasNewLine ? '🛒 장바구니에 담겼어요!' : '수량이 +1 되었습니다')
  }

  const pid = String(p.id)
  const listImageUrl = productDisplayImageUrl(p)

  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: 18,
        padding: '14px 14px 14px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      {toast ? (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: -6,
            zIndex: 2,
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(201,168,76,0.35)',
            background: 'rgba(201,168,76,0.14)',
            color: 'var(--gold)',
            fontSize: 11,
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          {toast}
        </div>
      ) : null}
      <Link
        href={`/products/${pid}`}
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          gap: 12,
          flex: 1,
          minWidth: 0,
          cursor: 'pointer',
        }}
      >
        <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          {listImageUrl ? (
            <ProductThumbImage src={listImageUrl} alt={p.name || ''} fill sizes="72px" />
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{p.name}</div>
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
              <div style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }} />
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : ''}</div>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: (p.retail_price || 0) === 0 ? 'var(--text3)' : 'var(--gold)' }}>
              {(p.retail_price || 0) === 0 ? '가격 설정 필요' : `₩${Number(p.retail_price).toLocaleString()}`}
            </div>
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onCart}
        aria-label="장바구니에 담기"
        style={{
          alignSelf: 'center',
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 12,
          border: '1px solid rgba(201,168,76,0.35)',
          background: 'rgba(201,168,76,0.1)',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        🛒
      </button>
    </div>
  )
}
