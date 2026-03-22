'use client'

import { useRouter } from 'next/navigation'
import ProductThumbnail from '@/components/ui/ProductThumbnail'

const GOLD = '#c9a84c'

export type SkinAnalysisResultProduct = {
  id: string
  name: string
  thumb_img?: string | null
  retail_price?: number | null
  description?: string | null
  brands?: { name?: string | null } | null
  matchRate?: number
}

export type SkinAnalysisStepSection = {
  stepTitle: string
  products: SkinAnalysisResultProduct[]
}

function toComma(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString()
}

type Props = {
  skinType: string
  products: SkinAnalysisResultProduct[]
  selectedIds: string[]
  cartedIds: string[]
  visibleIds: string[]
  searchText: string
  onSearchTextChange: (v: string) => void
  searchResults: SkinAnalysisResultProduct[]
  stepSections: SkinAnalysisStepSection[]
  selectedTotal: number
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onAddToCart: () => void
  onCheckout: () => void
  onBrowseProducts: () => void
}

export default function SkinAnalysisResultView({
  skinType,
  products,
  selectedIds,
  cartedIds,
  visibleIds,
  searchText,
  onSearchTextChange,
  searchResults,
  stepSections,
  selectedTotal,
  onToggleSelect,
  onToggleSelectAll,
  onAddToCart,
  onCheckout,
  onBrowseProducts,
}: Props) {
  const router = useRouter()
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length

  return (
    <>
      <div style={{ padding: '8px 0 100px' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--text3)', marginBottom: 10, fontWeight: 600 }}>
          ANALYSIS REPORT
        </p>

        <div
          style={{
            borderRadius: 20,
            padding: '22px 20px',
            marginBottom: 22,
            background: 'linear-gradient(145deg, rgba(201,168,76,0.22) 0%, rgba(30,26,20,0.95) 45%, rgba(14,12,10,0.98) 100%)',
            border: '1px solid rgba(201,168,76,0.35)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>당신의 피부 타입</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{skinType}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: GOLD,
                background: 'rgba(0,0,0,0.25)',
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid rgba(201,168,76,0.4)',
              }}
            >
              AI 매칭 완료
            </span>
          </div>
        </div>

        {products.length > 0 && (
          <>
            <section style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: 0 }}>맞춤 추천 TOP 5</h3>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>체크 후 담기</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {products.slice(0, 5).map(p => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: 16,
                      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => onToggleSelect(p.id)} />
                    <div
                      onClick={() => router.push(`/products/${p.id}`)}
                      style={{ display: 'flex', gap: 12, alignItems: 'center', flex: 1, cursor: 'pointer', minWidth: 0 }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 56,
                          height: 56,
                          borderRadius: 12,
                          overflow: 'hidden',
                          background: 'rgba(255,255,255,0.06)',
                          flexShrink: 0,
                        }}
                      >
                        <ProductThumbnail src={p.thumb_img} alt={p.name || ''} fill objectFit="cover" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
                        <div
                          style={{
                            fontSize: 14,
                            color: '#fff',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {p.name}
                        </div>
                        <div style={{ fontSize: 12, color: GOLD, marginTop: 4, fontWeight: 700 }}>
                          맞춤도 {Number(p.matchRate || 0)}%
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleSelect(p.id)}
                      style={{
                        border: `1px solid ${selectedIds.includes(p.id) ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.12)'}`,
                        background: selectedIds.includes(p.id) ? 'rgba(201,168,76,0.2)' : 'rgba(0,0,0,0.2)',
                        color: GOLD,
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {cartedIds.includes(p.id) ? '담김' : '담기'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: '0 0 10px' }}>제품 검색</h3>
              <input
                value={searchText}
                onChange={e => onSearchTextChange(e.target.value)}
                placeholder={`${skinType} 맞춤 제품 검색`}
                style={{
                  width: '100%',
                  height: 46,
                  borderRadius: 14,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  padding: '0 16px',
                  outline: 'none',
                  fontSize: 14,
                }}
              />
              {searchText.trim() ? (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.map(p => (
                    <div
                      key={`search-${p.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 14,
                        background: 'var(--bg3)',
                        padding: 10,
                      }}
                    >
                      <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => onToggleSelect(p.id)} />
                      <div onClick={() => router.push(`/products/${p.id}`)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </div>
                        <div style={{ color: 'var(--text3)', fontSize: 11 }}>{p.brands?.name || ''}</div>
                      </div>
                      <div style={{ color: GOLD, fontSize: 12, fontWeight: 800 }}>₩{toComma(p.retail_price)}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: '0 0 14px' }}>단계별 케어 라인업</h3>
              {stepSections.map((sec, idx) => (
                <div
                  key={sec.stepTitle}
                  style={{
                    marginBottom: 16,
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderLeft: `4px solid ${GOLD}`,
                      background: 'rgba(201,168,76,0.06)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 800, color: GOLD, fontFamily: 'monospace' }}>
                      STEP {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{sec.stepTitle}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '12px 12px 14px', scrollbarWidth: 'none' }}>
                    {sec.products.map(p => (
                      <div
                        key={`${sec.stepTitle}-${p.id}`}
                        style={{
                          width: 168,
                          flexShrink: 0,
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 14,
                          overflow: 'hidden',
                          background: 'var(--bg3)',
                        }}
                      >
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.04)' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => onToggleSelect(p.id)}
                            style={{ position: 'absolute', top: 10, left: 10, zIndex: 1 }}
                          />
                          <ProductThumbnail src={p.thumb_img} alt={p.name || ''} fill objectFit="cover" />
                        </div>
                        <div style={{ padding: 10 }}>
                          <div style={{ fontSize: 10, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
                          <div
                            style={{
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 700,
                              lineHeight: 1.35,
                              minHeight: 34,
                              display: '-webkit-box',
                              WebkitLineClamp: 2 as unknown as number,
                              WebkitBoxOrient: 'vertical' as unknown as 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {p.name}
                          </div>
                          <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontWeight: 700 }}>₩{toComma(p.retail_price)}</div>
                          <button
                            type="button"
                            onClick={() => onToggleSelect(p.id)}
                            style={{
                              marginTop: 8,
                              width: '100%',
                              borderRadius: 10,
                              border: '1px solid rgba(201,168,76,0.35)',
                              background: selectedIds.includes(p.id) ? 'rgba(201,168,76,0.2)' : 'transparent',
                              color: GOLD,
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '7px 0',
                              cursor: 'pointer',
                            }}
                          >
                            {cartedIds.includes(p.id) ? '담김' : '담기'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        <button
          type="button"
          onClick={onBrowseProducts}
          style={{
            width: '100%',
            padding: 16,
            background: `linear-gradient(90deg, ${GOLD}, #e8c88a)`,
            border: 'none',
            borderRadius: 14,
            color: '#0a0a0a',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(201,168,76,0.25)',
          }}
        >
          전체 제품 보러 가기 →
        </button>
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 66,
          width: '100%',
          maxWidth: 480,
          padding: '12px 14px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(10,12,15,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 45,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', fontSize: 12, marginBottom: 10 }}>
          <button
            type="button"
            onClick={onToggleSelectAll}
            style={{ border: 'none', background: 'transparent', color: allSelected ? GOLD : '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>
            선택 {selectedIds.length}개 · ₩{toComma(selectedTotal)}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            type="button"
            disabled={!selectedIds.length}
            onClick={onAddToCart}
            style={{
              height: 44,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: selectedIds.length ? 'rgba(201,168,76,0.15)' : 'var(--bg3)',
              color: selectedIds.length ? GOLD : 'var(--text3)',
              fontWeight: 800,
              cursor: selectedIds.length ? 'pointer' : 'not-allowed',
            }}
          >
            장바구니
          </button>
          <button
            type="button"
            disabled={!selectedIds.length}
            onClick={onCheckout}
            style={{
              height: 44,
              borderRadius: 12,
              border: 'none',
              background: selectedIds.length ? GOLD : 'var(--bg3)',
              color: selectedIds.length ? '#0a0a0a' : 'var(--text3)',
              fontWeight: 900,
              cursor: selectedIds.length ? 'pointer' : 'not-allowed',
            }}
          >
            선택 결제
          </button>
        </div>
      </div>
    </>
  )
}
