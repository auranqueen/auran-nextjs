'use client'

import { useMemo, useState } from 'react'
import ProductActionBar from '@/components/ProductActionBar'

const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

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
  const [qty, setQty] = useState(1)
  const [activeTab, setActiveTab] = useState<'detail' | 'review'>('detail')
  const [liked, setLiked] = useState(false)

  const unit = Math.max(0, Math.floor(Number(product.retail_price) || 0))
  const isPriceUnset = unit < 1
  const pct = earnPercentOf(product)
  const lineTotal = unit * qty
  const expectedPurchasePts = useMemo(() => Math.floor((lineTotal * pct) / 100), [lineTotal, pct])

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: '480px', margin: '0 auto', fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 300, color: '#fff', paddingBottom: 120 }}>

      {/* 상품 이미지 */}
      <div style={{ position: 'relative', aspectRatio: '1', background: 'linear-gradient(135deg,#1a1510,#2a2015)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {product.thumb_img ? (
          <img src={product.thumb_img} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <span style={{ fontSize: 80 }}>🧴</span>
        )}
        {/* 찜 버튼 */}
        <button
          onClick={() => setLiked(!liked)}
          style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: CARD_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer' }}>
          {liked ? '❤️' : '🤍'}
        </button>
        {/* 재고 뱃지 */}
        {product.stock && Number(product.stock) < 20 && (
          <div style={{ position: 'absolute', top: 14, left: 14, background: 'rgba(220,60,40,0.85)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#fff' }}>
            잔여 {product.stock}개
          </div>
        )}
        {/* 이미지 인디케이터 */}
        <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
          <div style={{ width: 16, height: 4, borderRadius: 2, background: GOLD }} />
          <div style={{ width: 5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ width: 5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>

        {/* 브랜드명 */}
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(201,169,110,0.7)', letterSpacing: '1px', marginBottom: 4 }}>
          {product.brands?.name}
        </div>

        {/* 상품명 */}
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 400, margin: '4px 0 10px', lineHeight: 1.4 }}>{product.name}</h1>

        {/* AI 추천 한줄 */}
        <div style={{ padding: '8px 12px', background: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🔬</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            <em style={{ color: GOLD, fontStyle: 'normal' }}>내 피부 타입</em>에 높은 매칭 · AI 분석 기반 추천
          </span>
        </div>

        {/* 사회적 증거 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ padding: '4px 10px', background: CARD_BG, border: CARD_BORDER, borderRadius: 20, fontSize: 10, color: TEXT_MUTED }}>👥 일촌 12명 사용중</div>
          <div style={{ padding: '4px 10px', background: CARD_BG, border: CARD_BORDER, borderRadius: 20, fontSize: 10, color: TEXT_MUTED }}>🔄 재구매율 84%</div>
          <div style={{ padding: '4px 10px', background: 'rgba(74,200,120,0.08)', border: '1px solid rgba(74,200,120,0.2)', borderRadius: 20, fontSize: 10, color: 'rgba(100,220,140,0.8)' }}>🚚 오늘 주문 내일 도착</div>
        </div>

        {/* 가격 */}
        <p style={{ color: GOLD, fontSize: 24, fontWeight: 400, marginBottom: 8 }}>
          {isPriceUnset ? '준비 중' : `₩${unit.toLocaleString()}`}
        </p>

        {/* 설명 */}
        {product.description && (
          <p style={{ color: TEXT_MUTED, fontSize: 13, marginBottom: 14, lineHeight: 1.7 }}>{product.description}</p>
        )}

        {/* 포인트 적립 */}
        {!isPriceUnset && pct > 0 && (
          <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, border: '1px solid rgba(201,169,110,0.25)', background: 'rgba(201,169,110,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5 }}>
              이 상품 구매 시 약{' '}
              <span style={{ color: GOLD }}>{expectedPurchasePts.toLocaleString()}P</span> 적립
              {qty > 1 && <span style={{ color: TEXT_MUTED, fontSize: 12 }}> (수량 {qty} · 합계 ₩{lineTotal.toLocaleString()} 기준)</span>}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: TEXT_DIM }}>배송 완료 시 지급 · 적립율 {pct}%</div>
          </div>
        )}

        {/* 수량 */}
        {!isPriceUnset && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, padding: 16, background: 'rgba(255,255,255,0.03)', border: CARD_BORDER, borderRadius: 12 }}>
            <span style={{ color: TEXT_MUTED, fontSize: 13 }}>수량</span>
            <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))}
              style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#fff', border: CARD_BORDER, cursor: 'pointer', fontSize: 18 }}>−</button>
            <span style={{ color: '#fff', minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: 400 }}>{qty}</span>
            <button type="button" onClick={() => setQty(q => Math.min(99, q + 1))}
              style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#fff', border: CARD_BORDER, cursor: 'pointer', fontSize: 18 }}>+</button>
            <span style={{ marginLeft: 'auto', fontSize: 16, fontWeight: 400, color: '#fff' }}>
              ₩{lineTotal.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', margin: '0 16px' }}>
        {(['detail', 'review'] as const).map((tab) => (
          <div key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: activeTab === tab ? 400 : 300, color: activeTab === tab ? GOLD : TEXT_MUTED, borderBottom: activeTab === tab ? `2px solid ${GOLD}` : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
            {tab === 'detail' ? '상품 상세' : '리뷰 127'}
          </div>
        ))}
      </div>

      {/* 상세 탭 */}
      {activeTab === 'detail' && (
        <div style={{ padding: 16 }}>
          {product.detail_html ? (
            <div dangerouslySetInnerHTML={{ __html: product.detail_html }} />
          ) : product.detail_content ? (
            <div dangerouslySetInnerHTML={{ __html: product.detail_content }} />
          ) : (
            <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: 200, background: 'linear-gradient(160deg,#1a1510,#2a2015)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 40 }}>🧴</span>
                <span style={{ fontSize: 10, color: TEXT_DIM, fontFamily: 'monospace' }}>브랜드 상세 이미지 등록 예정</span>
              </div>
            </div>
          )}

          {/* 상품 스펙 */}
          <div style={{ padding: 12, background: CARD_BG, border: CARD_BORDER, borderRadius: 12, marginTop: 12 }}>
            {[
              { label: '원산지', value: product.origin || '프랑스' },
              { label: '브랜드', value: product.brands?.name || '-' },
              { label: '유통기한', value: '제조일로부터 36개월' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: 11, color: TEXT_DIM }}>{item.label}</span>
                <span style={{ fontSize: 11, color: TEXT_MUTED }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* PERFECT TOGETHER */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_DIM, marginBottom: 10 }}>PERFECT TOGETHER</div>
            {/* TODO: 같은 브랜드 연관 상품 조회 예정 */}
            <div style={{ fontSize: 11, color: TEXT_DIM, textAlign: 'center', padding: '20px 0' }}>연관 상품 준비 중</div>
          </div>
        </div>
      )}

      {/* 리뷰 탭 */}
      {activeTab === 'review' && (
        <div style={{ padding: 16 }}>
          {/* 별점 요약 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 14, background: CARD_BG, border: CARD_BORDER, borderRadius: 14, marginBottom: 12 }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 36, fontWeight: 400, lineHeight: 1 }}>{product.avg_rating?.toFixed(1) || '4.9'}</div>
              <div style={{ fontSize: 14, margin: '4px 0 2px' }}>⭐⭐⭐⭐⭐</div>
              <div style={{ fontSize: 10, color: TEXT_DIM }}>{product.review_count || 127}개</div>
            </div>
            <div style={{ flex: 1 }}>
              {[5, 4, 3, 2, 1].map((star, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: TEXT_DIM, width: 8 }}>{star}</span>
                  <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: i === 0 ? '88%' : i === 1 ? '10%' : '2%', background: GOLD, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TODO: reviews 테이블 연동 예정 */}
          {[
            { avatar: '🌸', name: '소미님', skin: '건성·민감성', stars: 5, text: '환절기마다 당겼는데 이거 쓰고 달라졌어요. 3번째 재구매 💧', date: '03.01' },
            { avatar: '🌺', name: '지연님', skin: '복합성·30대', stars: 5, text: '발림성 진짜 최고예요. 끈적임 없이 쏙 흡수돼요 😍', date: '02.20' },
            { avatar: '💜', name: '수아님', skin: '건성·40대', stars: 5, text: 'AI 피부분석 후 추천받았는데 딱 맞아요.', date: '02.15' },
          ].map((review, i) => (
            <div key={i} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#ffd6e8,#e8d6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{review.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 400 }}>{review.name}</div>
                  <div style={{ fontSize: 9, color: TEXT_DIM }}>{review.skin}</div>
                </div>
                <span style={{ fontSize: 9, color: TEXT_DIM, fontFamily: 'monospace' }}>{review.date}</span>
              </div>
              <div style={{ fontSize: 11, marginBottom: 5 }}>{'⭐'.repeat(review.stars)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{review.text}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', background: 'rgba(255,255,255,0.04)', border: CARD_BORDER, borderRadius: 6, fontSize: 10, color: TEXT_MUTED, cursor: 'pointer' }}>
                  👍 도움돼요 24
                </div>
                <span style={{ fontSize: 9, color: 'rgba(201,169,110,0.6)' }}>+5P 적립</span>
              </div>
            </div>
          ))}

          {/* 리뷰 작성 유도 */}
          <div style={{ padding: '12px 14px', background: 'rgba(201,169,110,0.05)', border: '1px solid rgba(201,169,110,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.6 }}>
              구매하셨나요? 리뷰 작성 시<br />
              <em style={{ color: GOLD, fontStyle: 'normal' }}>+50P 즉시 적립</em>
            </div>
            <div style={{ padding: '8px 14px', background: GOLD, borderRadius: 8, fontSize: 11, color: BG, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>✍️ 리뷰 작성</div>
          </div>
        </div>
      )}

      {/* 기존 ProductActionBar 유지 */}
      {!isPriceUnset && (
        <ProductActionBar
          product={{
            id: String(product.id),
            name: String(product.name || '제품'),
            retail_price: unit,
            thumb_img: String(product.thumb_img || ''),
          }}
          quantity={qty}
        />
      )}

    </div>
  )
}
