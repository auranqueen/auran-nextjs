'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProductActionBar from '@/components/ui/ProductActionBar'

const GOLD = '#C9A96E'
const BG = '#0D0B09'

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
  const router = useRouter()
  const [qty, setQty] = useState(1)
  const [detailTab, setDetailTab] = useState<'detail' | 'review'>('detail')
  const unit = Math.max(0, Math.floor(Number(product.retail_price) || 0))
  const isPriceUnset = unit < 1
  const pct = earnPercentOf(product)
  const lineTotal = unit * qty
  const expectedPurchasePts = useMemo(() => Math.floor((lineTotal * pct) / 100), [lineTotal, pct])

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
        {/* 상단 네비 */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            background: 'rgba(13,11,9,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 10,
              letterSpacing: 4,
              fontWeight: 400,
              color: GOLD,
            }}
          >
            PRODUCT
          </span>
          <button
            type="button"
            onClick={() => router.push('/products')}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
            }}
            aria-label="목록"
          >
            ☰
          </button>
        </header>

        {/* 히어로 이미지 */}
        <div style={{ padding: '12px 16px 0' }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 16,
              overflow: 'hidden',
              background: '#141210',
              aspectRatio: '1',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {product.thumb_img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumb_img}
                alt={product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 56,
                }}
              >
                🧴
              </div>
            )}
          </div>
        </div>

        {/* AI 추천 카드 */}
        <div style={{ padding: '14px 16px 0' }}>
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'rgba(201,169,110,0.08)',
              border: '1px solid rgba(201,169,110,0.2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden>
              🔬
            </span>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.9)', lineHeight: 1.55 }}>
              <span style={{ color: GOLD, fontWeight: 400 }}>내 피부 타입</span>에 높은 매칭 ·{' '}
              <span style={{ color: 'rgba(255,255,255,0.65)' }}>AI 분석 기반 추천</span>
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 16px 0' }}>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 300, margin: '0 0 6px' }}>
            {product.brands?.name}
          </p>
          <h1 style={{ color: '#fff', fontSize: 21, fontWeight: 400, margin: '0 0 14px', lineHeight: 1.35 }}>
            {product.name}
          </h1>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <p style={{ color: GOLD, fontSize: 24, fontWeight: 600, margin: 0 }}>
              {isPriceUnset ? '준비 중' : `₩${unit.toLocaleString()}`}
            </p>
            {!isPriceUnset && product.retail_price_compare ? (
              <span
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.35)',
                  textDecoration: 'line-through',
                  fontWeight: 300,
                }}
              >
                ₩{Number(product.retail_price_compare).toLocaleString()}
              </span>
            ) : null}
          </div>

          {/* Social proof */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 16,
            }}
          >
            {['👥 일촌 12명 사용중', '🔄 재구매율 84%', '🚚 오늘 주문 내일 도착'].map((t, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '7px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 300,
                  color: 'rgba(255,255,255,0.78)',
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {product.description ? (
            <p
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 13,
                marginTop: 18,
                lineHeight: 1.65,
                fontWeight: 300,
              }}
            >
              {product.description}
            </p>
          ) : null}

          {!isPriceUnset && pct > 0 ? (
            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 14,
                border: '1px solid rgba(201,168,76,0.28)',
                background: 'linear-gradient(135deg, rgba(201,169,110,0.1) 0%, rgba(201,169,110,0.03) 100%)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.92)', lineHeight: 1.55 }}>
                이 상품 구매 시 약{' '}
                <span style={{ color: GOLD, fontWeight: 600 }}>{expectedPurchasePts.toLocaleString()}P</span> 적립
                {qty > 1 ? (
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 300 }}>
                    {' '}
                    (수량 {qty} · 합계 ₩{lineTotal.toLocaleString()} 기준)
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>
                배송 완료 시 지급 · 적립율 {pct}%
              </div>
            </div>
          ) : null}

          {!isPriceUnset ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                marginTop: 22,
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 400 }}>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.35)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  −
                </button>
                <span style={{ color: '#fff', minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: 400 }}>
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(q => Math.min(99, q + 1))}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(0,0,0,0.35)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    fontSize: 20,
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ) : null}

          {/* 탭 */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setDetailTab('detail')}
                style={{
                  flex: 1,
                  padding: '11px 12px',
                  borderRadius: 12,
                  border: detailTab === 'detail' ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.08)',
                  background: detailTab === 'detail' ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: detailTab === 'detail' ? 500 : 300,
                  color: detailTab === 'detail' ? GOLD : 'rgba(255,255,255,0.45)',
                }}
              >
                상품 상세
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('review')}
                style={{
                  flex: 1,
                  padding: '11px 12px',
                  borderRadius: 12,
                  border: detailTab === 'review' ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.08)',
                  background: detailTab === 'review' ? 'rgba(201,169,110,0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: detailTab === 'review' ? 500 : 300,
                  color: detailTab === 'review' ? GOLD : 'rgba(255,255,255,0.45)',
                }}
              >
                리뷰
              </button>
            </div>
            <div style={{ marginTop: 16, minHeight: 48 }}>
              {detailTab === 'detail' ? (
                product.detail_html ? (
                  <div
                    className="product-detail-html"
                    style={{
                      fontSize: 13,
                      fontWeight: 300,
                      color: 'rgba(255,255,255,0.82)',
                      lineHeight: 1.65,
                    }}
                    dangerouslySetInnerHTML={{ __html: String(product.detail_html) }}
                  />
                ) : (
                  <div
                    style={{
                      padding: 28,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: 12,
                      fontWeight: 300,
                      color: 'rgba(255,255,255,0.35)',
                      textAlign: 'center',
                    }}
                  >
                    상품 상세 정보가 준비 중입니다.
                  </div>
                )
              ) : (
                <div style={{ padding: '4px 0 12px' }}>
                  {/* TODO: reviews 테이블 연동 예정 */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.85)' }}>
                      평균 <span style={{ color: GOLD, fontWeight: 500 }}>⭐ 4.9</span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 10px' }}>·</span>
                      리뷰 <span style={{ color: GOLD, fontWeight: 500 }}>127</span>개
                    </p>
                    <p style={{ margin: '10px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 300 }}>
                      실제 리뷰는 곧 연동됩니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {!isPriceUnset ? (
          <>
            <div style={{ padding: '8px 16px 0' }}>
              {/* TODO: 같은 브랜드 상품 조회 예정 */}
              <p
                style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  color: GOLD,
                  margin: '0 0 12px',
                  fontWeight: 500,
                }}
              >
                PERFECT TOGETHER
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  overflowX: 'auto',
                  paddingBottom: 6,
                  marginBottom: 4,
                }}
              >
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      flex: '0 0 88px',
                      height: 88,
                      borderRadius: 12,
                      border: '1px dashed rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  />
                ))}
              </div>
            </div>
            <ProductActionBar
              product={{
                id: String(product.id),
                name: String(product.name || '제품'),
                retail_price: unit,
                thumb_img: String(product.thumb_img || ''),
              }}
              quantity={qty}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
