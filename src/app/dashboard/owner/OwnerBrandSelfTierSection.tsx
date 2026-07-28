'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { canUpgradeToTier } from '@/lib/brandTierGrade'
const ACCENT_COLOR = '#C084FC'
const PURPLE = '#7B5EA7'
export type SelfTierPackage = {
  id: string
  tier_name: string
  price: number
  product_scope?: string | null
}
export type SelfTierBrand = {
  brandId: string
  brandName: string
  createApiPath: string
  payappActive: boolean
  packages: SelfTierPackage[]
  ownedGrade: string | null
  ownedPrice: number | null
  paymentStatus: string | null
}
type Props = {
  brands: SelfTierBrand[]
  sectionTitle?: string
  sectionSubtitle?: string
}
type KitItem = { id: string; item_name: string; item_type: string; qty: number }
type InfoModalTarget = { pkg: SelfTierPackage } | null
export function OwnerBrandSelfTierSection({
  brands,
  sectionTitle = '브랜드 등급',
  sectionSubtitle = '브랜드 직거래 · 셀프 결제',
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [infoModal, setInfoModal] = useState<InfoModalTarget>(null)
  const [kitItems, setKitItems] = useState<KitItem[]>([])
  const [kitLoading, setKitLoading] = useState(false)
  if (!brands.length) return null
  const openInfo = async (pkg: SelfTierPackage) => {
    setInfoModal({ pkg })
    setKitItems([])
    setKitLoading(true)
    try {
      const { data } = await supabase
        .from('brand_tier_kit_items')
        .select('id, item_name, item_type, qty')
        .eq('tier_package_id', pkg.id)
        .eq('is_active', true)
      setKitItems((data || []) as KitItem[])
    } finally {
      setKitLoading(false)
    }
  }
  const closeInfo = () => {
    setInfoModal(null)
    setKitItems([])
  }
  const goToCart = () => {
    if (!infoModal) return
    router.push(`/dashboard/owner/brand-orders/tier-cart?tier_package_id=${infoModal.pkg.id}`)
  }
  return (
    <>
      <div
        className="owner-v3-card"
        style={{
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🏅 {sectionTitle}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12 }}>{sectionSubtitle}</div>
        {brands.map((b) => {
          const upgradablePackages = b.packages.filter((p) =>
            canUpgradeToTier(b.ownedPrice, Math.trunc(Number(p.price))),
          )
          const atMaxTier =
            b.paymentStatus === 'paid' &&
            b.ownedPrice != null &&
            upgradablePackages.length === 0
          return (
            <div key={b.brandId} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT_COLOR, marginBottom: 8 }}>
                {b.brandName}
                {!b.payappActive ? (
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 8 }}>데모 모드</span>
                ) : null}
              </div>
              {b.ownedGrade ? (
                <div style={{ fontSize: 11, marginBottom: 8, color: ACCENT_COLOR }}>
                  보유: {b.ownedGrade}
                  {b.paymentStatus === 'paid'
                    ? ' · 결제완료'
                    : b.paymentStatus === 'pending'
                      ? ' · 결제대기'
                      : ''}
                </div>
              ) : null}
              {atMaxTier ? (
                <div
                  style={{
                    fontSize: 12,
                    color: ACCENT_COLOR,
                    padding: '12px 10px',
                    borderRadius: 10,
                    border: '1px solid rgba(123,94,167,0.35)',
                    background: 'rgba(123,94,167,0.1)',
                    textAlign: 'center',
                  }}
                >
                  최고 등급 보유중이에요 🏆
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {upgradablePackages.map((p) => {
                    const packagePrice = Math.trunc(Number(p.price))
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 12, color: ACCENT_COLOR }}>{p.tier_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                            {packagePrice.toLocaleString()}원 이상
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void openInfo(p)}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: PURPLE,
                            color: '#fff',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          자세히
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {infoModal && (
        <div
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closeInfo() }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'var(--bg3)',
              border: '1px solid rgba(123,94,167,0.35)',
              borderRadius: 14,
              padding: 20,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT_COLOR, marginBottom: 4 }}>
              {infoModal.pkg.tier_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
              카탈로그에서 자유롭게 제품을 담아 결제하시면 돼요
            </div>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(123,94,167,0.25)',
                background: 'rgba(123,94,167,0.08)',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>필요 결제금액</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {Math.trunc(Number(infoModal.pkg.price)).toLocaleString()}원 이상
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
              이 등급 구매시 함께 지급되는 구성품
            </div>
            {kitLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>불러오는 중…</div>
            ) : kitItems.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>지정된 구성품이 없어요</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                {kitItems.map((k) => (
                  <div
                    key={k.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 20,
                        background: 'rgba(123,94,167,0.2)',
                        color: ACCENT_COLOR,
                      }}
                    >
                      {k.item_type}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{k.item_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>수량 {k.qty}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={closeInfo}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text3)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={goToCart}
                style={{
                  flex: 2,
                  padding: '10px',
                  borderRadius: 8,
                  border: 'none',
                  background: PURPLE,
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                담으러 가기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
