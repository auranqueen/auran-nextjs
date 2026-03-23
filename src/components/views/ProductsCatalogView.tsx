'use client'

import type { ReactNode } from 'react'

const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'

type BrandChip = { id: string; name: string; count: number }

type Props = {
  header: ReactNode
  bottomNav: ReactNode
  specialIdsActive: boolean
  skinParam: string
  concernParam: string
  brands: BrandChip[]
  brandFilter: string
  onBrandFilter: (id: string) => void
  productTotal: number
  selectedBrand: any | null
  error: string | null
  loading: boolean
  empty: boolean
  list: ReactNode
}

export default function ProductsCatalogView({
  header,
  bottomNav,
  specialIdsActive,
  skinParam,
  concernParam,
  brands,
  brandFilter,
  onBrandFilter,
  productTotal,
  selectedBrand,
  error,
  loading,
  empty,
  list,
}: Props) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[390px] bg-[#0D0B09] pb-24">
      {header}
      <div style={{ padding: '16px 16px 0' }}>
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 16,
            background: CARD_BG,
            border: `1px solid ${GOLD}38`,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              letterSpacing: '1.5px',
              color: 'rgba(255,255,255,0.25)',
              fontWeight: 400,
            }}
          >
            SHOP
          </div>
          <div style={{ marginTop: 6, fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>클리닉 맞춤 제품</div>
        </div>

        {specialIdsActive && (
          <div
            style={{
              marginBottom: 10,
              borderRadius: 14,
              border: '1px solid rgba(201,168,76,0.35)',
              background: 'linear-gradient(90deg, rgba(201,168,76,0.14), rgba(201,168,76,0.06))',
              padding: '10px 12px',
              color: GOLD,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            오늘의 특가 전체 상품
          </div>
        )}
        {!!skinParam && (
          <div
            style={{
              marginBottom: 10,
              borderRadius: 14,
              border: '1px solid rgba(74,141,192,0.35)',
              background: 'rgba(74,141,192,0.1)',
              padding: '10px 12px',
              color: '#8bb9dc',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            피부타입 · {skinParam}
          </div>
        )}
        {!!concernParam && (
          <div
            style={{
              marginBottom: 10,
              borderRadius: 14,
              border: '1px solid rgba(201,168,76,0.3)',
              background: 'rgba(201,168,76,0.08)',
              padding: '10px 12px',
              color: GOLD,
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            피부고민 · {concernParam}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 14,
            marginBottom: 4,
            WebkitOverflowScrolling: 'touch' as const,
            scrollbarWidth: 'none' as const,
          }}
        >
          <button
            type="button"
            onClick={() => onBrandFilter('all')}
            style={{
              border:
                brandFilter === 'all' ? '1px solid rgba(201,169,110,0.4)' : CARD_BORDER,
              background: brandFilter === 'all' ? 'rgba(201,169,110,0.14)' : CARD_BG,
              color: brandFilter === 'all' ? GOLD : TEXT_MUTED,
              borderRadius: 999,
              padding: '9px 14px',
              fontSize: 12,
              fontWeight: brandFilter === 'all' ? 600 : 400,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            전체 ({productTotal})
          </button>
          {brands.map(b => (
            <button
              type="button"
              key={b.id}
              onClick={() => onBrandFilter(b.id)}
              style={{
                border:
                  brandFilter === b.id ? '1px solid rgba(201,169,110,0.4)' : CARD_BORDER,
                background: brandFilter === b.id ? 'rgba(201,169,110,0.14)' : CARD_BG,
                color: brandFilter === b.id ? GOLD : TEXT_MUTED,
                borderRadius: 999,
                padding: '9px 14px',
                fontSize: 12,
                fontWeight: brandFilter === b.id ? 600 : 400,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {b.name} ({b.count})
            </button>
          ))}
        </div>

        {selectedBrand && (
          <div
            style={{
              marginBottom: 14,
              background: CARD_BG,
              border: `1px solid ${GOLD}38`,
              borderRadius: 16,
              padding: '16px 16px',
            }}
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {selectedBrand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBrand.logo_url} alt={selectedBrand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: 18 }}>🏷️</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{selectedBrand.name}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text3)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {selectedBrand.origin || ''} {selectedBrand.description ? `· ${selectedBrand.description}` : ''}
                </div>
              </div>
            </div>

            {(selectedBrand.story_title || selectedBrand.story_body || selectedBrand.story_image_url) && (
              <div
                style={{
                  marginTop: 14,
                  background: 'rgba(0,0,0,0.22)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                {selectedBrand.story_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBrand.story_image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                ) : null}
                <div style={{ padding: '12px 12px' }}>
                  {selectedBrand.story_title ? <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{selectedBrand.story_title}</div> : null}
                  {selectedBrand.story_body ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {selectedBrand.story_body}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {selectedBrand.promo_enabled && (selectedBrand.promo_title || selectedBrand.promo_body || selectedBrand.promo_image_url) && (
              <a
                href={selectedBrand.promo_link_url || '#'}
                onClick={e => {
                  if (!selectedBrand.promo_link_url) e.preventDefault()
                }}
                style={{
                  display: 'block',
                  marginTop: 14,
                  textDecoration: 'none',
                  background: 'linear-gradient(90deg, rgba(201,168,76,0.14), rgba(201,168,76,0.06))',
                  border: '1px solid rgba(201,168,76,0.3)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                {selectedBrand.promo_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBrand.promo_image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                ) : null}
                <div style={{ padding: '12px 12px' }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: '0.18em',
                      color: 'rgba(201,168,76,0.9)',
                      marginBottom: 6,
                    }}
                  >
                    PROMOTION
                  </div>
                  {selectedBrand.promo_title ? <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{selectedBrand.promo_title}</div> : null}
                  {selectedBrand.promo_body ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {selectedBrand.promo_body}
                    </div>
                  ) : null}
                  {selectedBrand.promo_link_url ? <div style={{ marginTop: 8, fontSize: 11, color: GOLD, fontWeight: 900 }}>자세히 보기 →</div> : null}
                </div>
              </a>
            )}
          </div>
        )}

        {error ? (
          <div
            style={{
              padding: 16,
              background: 'rgba(217,79,79,0.12)',
              border: '1px solid rgba(217,79,79,0.3)',
              borderRadius: 16,
              fontSize: 13,
              color: '#e08080',
            }}
          >
            {error}
          </div>
        ) : loading ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>불러오는 중...</div>
        ) : empty ? (
          <div
            style={{
              padding: 22,
              textAlign: 'center',
              color: 'var(--text3)',
              fontSize: 13,
              lineHeight: 1.65,
              borderRadius: 16,
              border: '1px dashed rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            표시할 제품이 없습니다.
            <br />
            <span style={{ fontSize: 12 }}>승인된 제품이 없거나, 브랜드 필터에 맞는 제품이 없을 수 있습니다.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{list}</div>
        )}
      </div>
      {bottomNav}
    </div>
  )
}
