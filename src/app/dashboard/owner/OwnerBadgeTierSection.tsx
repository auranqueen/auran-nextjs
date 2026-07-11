'use client'

import { useState } from 'react'
import { canUpgradeToTier } from '@/lib/brandTierGrade'

const TIER_COLORS: Record<string, string> = {
  '메디슈티컬': '#E53935',
  '프리미엄전문점': '#C9A96E',
  '전문점': '#9C7FD4',
  '취급점': '#64B5F6',
}

export type TierBadgeBrand = {
  brandId: string
  brandName: string
  packages: Array<{ id: string; tier_name: string; price: number; product_scope?: string | null }>
  ownedGrade: string | null
  paymentStatus: string | null
}

type Props = {
  brands: TierBadgeBrand[]
}

export function OwnerBadgeTierSection({ brands }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')

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
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🏅 브랜드 전문점 등급</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 12 }}>오렌지사 트랙B · tier_contract 브랜드</div>
      {brands.map((b) => (
        <div key={b.brandId} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#C084FC', marginBottom: 8 }}>{b.brandName}</div>
          {b.ownedGrade && (
            <div style={{ fontSize: 11, marginBottom: 8, color: TIER_COLORS[b.ownedGrade] || '#fff' }}>
              보유: {b.ownedGrade}
              {b.paymentStatus === 'paid' ? ' · 결제완료' : b.paymentStatus === 'pending' ? ' · 결제대기' : ''}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {b.packages.map((p) => {
              const allowed = canUpgradeToTier(b.ownedGrade, p.tier_name)
              const isOwned = b.ownedGrade === p.tier_name && b.paymentStatus === 'paid'
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
                    opacity: allowed ? 1 : 0.45,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 12, color: TIER_COLORS[p.tier_name] }}>{p.tier_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                      {Number(p.price).toLocaleString()}원
                    </span>
                  </div>
                  {isOwned ? (
                    <span style={{ fontSize: 10, color: '#4cad7e' }}>보유 중</span>
                  ) : allowed ? (
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
                      }}
                    >
                      {busy === p.id ? '처리 중…' : '구매'}
                    </button>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>구매 불가</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {toast && <div style={{ fontSize: 11, color: '#bf5f90', marginTop: 8 }}>{toast}</div>}
    </div>
  )
}
