'use client'
import { useRouter } from 'next/navigation'
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
export function OwnerBrandSelfTierSection({
  brands,
  sectionTitle = '브랜드 등급',
  sectionSubtitle = '브랜드 직거래 · 셀프 결제',
}: Props) {
  const router = useRouter()
  if (!brands.length) return null
  return (
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
                        onClick={() => router.push(`/dashboard/owner/brand-orders/tier-cart?tier_package_id=${p.id}`)}
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
                        담으러 가기
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
  )
}
