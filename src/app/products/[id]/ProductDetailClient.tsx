'use client'

import Link from 'next/link'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import ProductThumbImage from '@/components/ProductThumbImage'
import ProductActionBar from '@/components/ProductActionBar'

export default function ProductDetailClient({ product }: { product: any }) {
  const detailImgs = Array.isArray(product.detail_imgs) ? product.detail_imgs : []
  const rawPrice = product.retail_price
  const price = Number(rawPrice) || 0
  const isPriceUnset = rawPrice === null || rawPrice === undefined || price === 0

  const actionProduct = {
    id: String(product.id),
    name: String(product.name || '제품'),
    retail_price: price,
    thumb_img: String(product.thumb_img || ''),
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 200 }}>
      <DashboardHeader title={product.name || '제품'} right={<CustomerHeaderRight />} />
      <div style={{ padding: '0 18px 24px' }}>
        <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', aspectRatio: '1', maxHeight: 360, position: 'relative' }}>
          <ProductThumbImage key={String(product.id)} src={product.thumb_img} alt={product.name || ''} fill sizes="(max-width:480px) 100vw, 360px" priority />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{product.brands?.name || ''}</div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>{product.name}</h1>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 18,
            fontWeight: 800,
            color: isPriceUnset ? 'var(--text3)' : 'var(--gold)',
            marginBottom: 16,
          }}
        >
          {isPriceUnset ? '준비 중' : `₩${price.toLocaleString()}`}
        </div>
        {product.description ? (
          <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.description}</div>
        ) : null}
        {detailImgs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {detailImgs.map((url: string, i: number) => (
              <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${product.name} ${i + 1}`} style={{ width: '100%', verticalAlign: 'top', display: 'block' }} />
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link
            href="/products"
            style={{
              display: 'inline-block',
              padding: '12px 20px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            ← 제품 목록
          </Link>
        </div>
      </div>

      {!isPriceUnset ? <ProductActionBar product={actionProduct} /> : null}

      <DashboardBottomNav role="customer" />
    </div>
  )
}
