'use client'

import { useState } from 'react'
import { canUpgradeToTier } from '@/lib/brandTierGrade'

const ACCENT_COLOR = '#C084FC'

const COMMISSION_INTRO_COPY =
  '보유하신 등급으로 원장님을 추천하시면, 해당 등급에 정해진 커미션율만큼 리워드가 쌓여요 💜 한 번 소개하고 끝이 아니에요 — 추천하신 원장님이 꾸준히 활동하실수록, 지속적으로 커미션이 이어질 수 있어요. 잘 이끌어주실수록 오래오래 함께 받으실 수 있어요!'

export type TierBadgeBrand = {
  brandId: string
  brandName: string
  packages: Array<{
    id: string
    tier_name: string
    price: number
    commission_rate: number
    product_scope?: string | null
  }>
  ownedGrade: string | null
  ownedPrice: number | null
  ownedCommissionRate: number | null
  paymentStatus: string | null
}

type Props = {
  brands: TierBadgeBrand[]
}

function formatCommissionRate(rate: number): string {
  const n = Number(rate)
  if (!Number.isFinite(n) || n <= 0) return ''
  return Number.isInteger(n) ? `${n}` : n.toFixed(1).replace(/\.0$/, '')
}

export function OwnerBadgeTierSection({ brands }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [introOpen, setIntroOpen] = useState<Record<string, boolean>>({})

  const purchase = async (tierPackageId: string) => {
    setBusy(tierPackageId)
    try {
      const res = await fetch('/api/payments/brand-tier/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ tier_package_id: tierPackageId }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok && json?.pay_url) {
        window.location.href = json.pay_url as string
        return
      }
      setToast(
        json?.error === 'grade_downgrade_or_same_not_allowed'
          ? '이미 보유한 등급 이상만 구매할 수 있어요'
          : '결제 요청에 실패했어요',
      )
    } finally {
      setBusy(null)
    }
  }

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
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🏅 브랜드 파트너 등급</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12 }}>오렌지사 트랙B · tier_contract 브랜드</div>

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
            </div>

            {b.ownedGrade && (
              <div style={{ fontSize: 11, marginBottom: 8, color: ACCENT_COLOR }}>
                보유: {b.ownedGrade}
                {b.paymentStatus === 'paid' ? ' · 결제완료' : b.paymentStatus === 'pending' ? ' · 결제대기' : ''}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIntroOpen((prev) => ({ ...prev, [b.brandId]: !prev[b.brandId] }))}
              style={{
                width: '100%',
                textAlign: 'left',
                marginBottom: 10,
                padding: '8px 10px',
                borderRadius: 10,
                border: '1px solid rgba(123,94,167,0.35)',
                background: 'rgba(123,94,167,0.08)',
                color: ACCENT_COLOR,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              💜 추천 커미션 안내 {introOpen[b.brandId] ? '접기 ▲' : '펼치기 ▼'}
            </button>
            {introOpen[b.brandId] && (
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: 'var(--text3)',
                  marginBottom: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(191,95,144,0.06)',
                  border: '1px solid rgba(191,95,144,0.15)',
                }}
              >
                {COMMISSION_INTRO_COPY}
                {b.ownedGrade && b.ownedCommissionRate != null ? (
                  <>
                    {' '}
                    현재 {b.ownedGrade} 등급 보유 중이시라, 지금 원장님을 추천하시면 커미션{' '}
                    {formatCommissionRate(b.ownedCommissionRate)}%가 적용돼요!
                  </>
                ) : null}
              </div>
            )}

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
                  const rateLabel = formatCommissionRate(p.commission_rate)

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: ACCENT_COLOR }}>{p.tier_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {packagePrice.toLocaleString()}원
                          </span>
                        </div>
                        {rateLabel ? (
                          <div style={{ fontSize: 10, color: '#bf5f90', marginTop: 4 }}>
                            커미션 {rateLabel}%
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => void purchase(p.id)}
                        style={{
                          fontSize: 11,
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#7B5EA7',
                          color: '#fff',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {busy === p.id ? '처리 중…' : '구매'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {toast && <div style={{ fontSize: 11, color: '#bf5f90', marginTop: 8 }}>{toast}</div>}
    </div>
  )
}
