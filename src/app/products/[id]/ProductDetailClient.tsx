'use client'

import Link from 'next/link'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import ProductThumbImage from '@/components/ProductThumbImage'
import ProductActionBar from '@/components/ProductActionBar'

function DetailContentBlock({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {lines.map((line, i) => {
        const img = line.match(/^\s*!\[\]\(([^)]+)\)\s*$/)
        if (img) {
          return (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img[1]} alt="" style={{ width: '100%', verticalAlign: 'top', display: 'block' }} />
            </div>
          )
        }
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />
        return (
          <p key={i} style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.75 }}>
            {line}
          </p>
        )
      })}
    </div>
  )
}

export default function ProductDetailClient({ product }: { product: any }) {
  const detailImgs =
    Array.isArray(product.detail_images) && product.detail_images.length > 0
      ? product.detail_images
      : Array.isArray(product.detail_imgs)
        ? product.detail_imgs
        : []
  const rawPrice = product.retail_price
  const price = Number(rawPrice) || 0
  const isPriceUnset = rawPrice === null || rawPrice === undefined || price === 0

  const actionProduct = {
    id: String(product.id),
    name: String(product.name || '제품'),
    retail_price: price,
    thumb_img: String(product.thumb_img || ''),
  }

  const earnPct = Math.max(0, Math.min(100, Math.floor(Number(product.earn_points ?? 0))))
  const expectedPurchasePts = Math.floor((price * earnPct) / 100)
  const sharePts = Math.max(0, Math.floor(Number(product.share_points ?? 0)))
  const textRev = Math.max(0, Math.floor(Number(product.review_points_text ?? 0)))
  const photoRev = Math.max(0, Math.floor(Number(product.review_points_photo ?? 0)))
  const videoRev = Math.max(0, Math.floor(Number(product.review_points_video ?? 0)))
  const showBenefit =
    !isPriceUnset &&
    (earnPct > 0 || sharePts > 0 || textRev > 0 || photoRev > 0 || videoRev > 0)

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

        {showBenefit ? (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              borderRadius: 14,
              border: '1px solid rgba(201,168,76,0.25)',
              background: 'rgba(201,168,76,0.06)',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--gold)', marginBottom: 10 }}>이 상품 구매 시 혜택</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 1.85 }}>
              {earnPct > 0 ? (
                <li>
                  💰 약 {expectedPurchasePts.toLocaleString()}P 적립 ({earnPct}%){' '}
                  <span style={{ color: 'var(--text3)', fontSize: 11 }}>배송 완료 시 지급</span>
                </li>
              ) : null}
              {textRev > 0 ? <li>✏️ 텍스트 리뷰 작성 시 +{textRev.toLocaleString()}P</li> : null}
              {photoRev > 0 ? <li>📷 포토 리뷰 작성 시 +{photoRev.toLocaleString()}P</li> : null}
              {videoRev > 0 ? <li>🎬 영상 리뷰 작성 시 +{videoRev.toLocaleString()}P</li> : null}
              {sharePts > 0 ? <li>🔗 공유 시 +{sharePts.toLocaleString()}P</li> : null}
            </ul>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
              리뷰 포인트는 게시 시 자동 지급됩니다. 공유 포인트는 정책에 따라 별도 지급될 수 있어요.
            </div>
          </div>
        ) : null}

        {product.description ? (
          <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.description}</div>
        ) : null}

        {product.detail_content ? (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>상세 정보</div>
            <DetailContentBlock text={String(product.detail_content)} />
          </div>
        ) : null}

        {!String(product.detail_content || '').trim() && detailImgs.length > 0 ? (
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
