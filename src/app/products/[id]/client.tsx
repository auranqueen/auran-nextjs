'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import ProductThumbImage from '@/components/ProductThumbImage'
import ProductActionBar from '@/components/ProductActionBar'

function brandNameOf(product: any) {
  const b = product?.brands
  if (Array.isArray(b)) return b[0]?.name || ''
  return b?.name || ''
}

function thumbSlides(product: any): string[] {
  const fromArr = Array.isArray(product.thumb_images)
    ? product.thumb_images.filter((u: unknown) => typeof u === 'string' && String(u).trim())
    : []
  if (fromArr.length > 0) return fromArr as string[]
  if (product.thumb_img && String(product.thumb_img).trim()) return [String(product.thumb_img)]
  return []
}

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

export default function ProductDetailClient({ product }: { product: any }) {
  const [slide, setSlide] = useState(0)
  const [quantity, setQuantity] = useState(1)

  const slides = useMemo(() => thumbSlides(product), [product])
  const currentSrc = slides[slide] || slides[0] || ''

  const rawPrice = product.retail_price
  const unit = Number(rawPrice) || 0
  const isPriceUnset = rawPrice === null || rawPrice === undefined || unit === 0

  const pct = earnPercentOf(product)
  const lineTotal = unit * quantity
  const expectedPurchasePts = Math.floor((lineTotal * pct) / 100)

  const actionProduct = {
    id: String(product.id),
    name: String(product.name || '제품'),
    retail_price: unit,
    thumb_img: String(currentSrc || product.thumb_img || ''),
  }

  const brand = brandNameOf(product)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 200 }}>
      <DashboardHeader title={product.name || '제품'} right={<CustomerHeaderRight />} />
      <div style={{ padding: '0 18px 24px' }}>
        <div
          style={{
            marginBottom: 16,
            borderRadius: 16,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.2)',
            aspectRatio: '1',
            maxHeight: 360,
            position: 'relative',
          }}
        >
          {currentSrc ? (
            <ProductThumbImage
              key={`${product.id}-${slide}`}
              src={currentSrc}
              alt={product.name || ''}
              fill
              sizes="(max-width:480px) 100vw, 360px"
              priority
            />
          ) : (
            <div style={{ width: '100%', height: '100%', minHeight: 200, background: 'rgba(0,0,0,0.35)' }} />
          )}
          {slides.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="이전 이미지"
                onClick={() => setSlide(s => (s - 1 + slides.length) % slides.length)}
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(0,0,0,0.45)',
                  color: '#fff',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="다음 이미지"
                onClick={() => setSlide(s => (s + 1) % slides.length)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(0,0,0,0.45)',
                  color: '#fff',
                  fontSize: 18,
                  cursor: 'pointer',
                }}
              >
                ›
              </button>
              <div
                style={{
                  position: 'absolute',
                  bottom: 10,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`슬라이드 ${i + 1}`}
                    onClick={() => setSlide(i)}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      border: 'none',
                      padding: 0,
                      background: i === slide ? 'var(--gold, #c9a84c)' : 'rgba(255,255,255,0.35)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{brand}</div>
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
          {isPriceUnset ? '준비 중' : `₩${unit.toLocaleString()}`}
        </div>

        {!isPriceUnset && (
          <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>수량</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setQuantity(v => Math.max(1, v - 1))}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                }}
              >
                -
              </button>
              <div style={{ minWidth: 24, textAlign: 'center', fontSize: 14, color: '#fff', fontWeight: 800 }}>{quantity}</div>
              <button
                type="button"
                onClick={() => setQuantity(v => Math.min(99, v + 1))}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                }}
              >
                +
              </button>
            </div>
          </div>
        )}

        {!isPriceUnset && pct > 0 ? (
          <div
            style={{
              marginBottom: 18,
              padding: 14,
              borderRadius: 14,
              border: '1px solid rgba(201,168,76,0.25)',
              background: 'rgba(201,168,76,0.06)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>
              이 상품 구매 시 약{' '}
              <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{expectedPurchasePts.toLocaleString()}P</span> 적립
              {quantity > 1 ? <span style={{ color: 'var(--text3)', fontSize: 12 }}> (수량 {quantity} · 합계 ₩{lineTotal.toLocaleString()} 기준)</span> : null}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>배송 완료 시 지급 · 적립율 {pct}%</div>
          </div>
        ) : null}

        {product.description ? (
          <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.description}</div>
        ) : null}

        {product.detail_content ? (
          <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{String(product.detail_content)}</div>
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
