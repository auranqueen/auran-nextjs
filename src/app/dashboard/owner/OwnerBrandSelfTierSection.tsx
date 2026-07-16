'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { canUpgradeToTier, computeTierUpgradeCharge } from '@/lib/brandTierGrade'

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

type ModalTarget = {
  brand: SelfTierBrand
  pkg: SelfTierPackage
}

export function OwnerBrandSelfTierSection({
  brands,
  sectionTitle = '브랜드 등급',
  sectionSubtitle = '브랜드 직거래 · 셀프 결제',
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState<'form' | 'success'>('form')
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [successGrade, setSuccessGrade] = useState('')

  const closeModal = () => {
    setModalOpen(false)
    setModalStep('form')
    setModalTarget(null)
    setSuccessGrade('')
  }

  const openDemoModal = (brand: SelfTierBrand, pkg: SelfTierPackage) => {
    setModalTarget({ brand, pkg })
    setModalStep('form')
    setSuccessGrade('')
    setModalOpen(true)
  }

  const purchaseReal = async (brand: SelfTierBrand, tierPackageId: string) => {
    setBusy(tierPackageId)
    try {
      const res = await fetch(brand.createApiPath, {
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

  const submitDemoPayment = async () => {
    if (!modalTarget) return
    const { brand, pkg } = modalTarget
    setBusy(pkg.id)
    try {
      const res = await fetch(brand.createApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ tier_package_id: pkg.id }),
      })
      const json = await res.json().catch(() => ({}))

      if (json?.ok && json?.demo) {
        setSuccessGrade(String(json.grade || pkg.tier_name))
        setModalStep('success')
        return
      }

      setToast(
        json?.error === 'grade_downgrade_or_same_not_allowed'
          ? '이미 보유한 등급 이상만 구매할 수 있어요'
          : '결제 요청에 실패했어요',
      )
      closeModal()
    } finally {
      setBusy(null)
    }
  }

  const confirmDemoSuccess = () => {
    closeModal()
    router.refresh()
  }

  const handlePackageAction = (brand: SelfTierBrand, pkg: SelfTierPackage) => {
    if (!brand.payappActive) {
      openDemoModal(brand, pkg)
      return
    }
    void purchaseReal(brand, pkg.id)
  }

  if (!brands.length) return null

  const modalPrice = modalTarget
    ? computeTierUpgradeCharge(
        modalTarget.brand.ownedPrice,
        Math.trunc(Number(modalTarget.pkg.price)),
      ) ?? Math.trunc(Number(modalTarget.pkg.price))
    : 0
  const modalListPrice = modalTarget ? Math.trunc(Number(modalTarget.pkg.price)) : 0
  const modalIsUpgrade =
    modalTarget != null &&
    modalTarget.brand.ownedPrice != null &&
    modalPrice < modalListPrice

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
                    const chargeAmount =
                      computeTierUpgradeCharge(b.ownedPrice, packagePrice) ?? packagePrice
                    const isUpgrade =
                      b.ownedPrice != null && chargeAmount < packagePrice
                    const btnLabel = !b.payappActive
                      ? '체험하기(데모)'
                      : busy === p.id
                        ? '처리 중…'
                        : '구매'

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
                          {isUpgrade ? (
                            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                              정가 {packagePrice.toLocaleString()}원 →{' '}
                              <span style={{ color: ACCENT_COLOR, fontWeight: 600 }}>
                                차액 {chargeAmount.toLocaleString()}원
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
                              {packagePrice.toLocaleString()}원
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={busy === p.id}
                          onClick={() => handlePackageAction(b, p)}
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: b.payappActive ? PURPLE : 'rgba(123,94,167,0.35)',
                            color: '#fff',
                            cursor: busy === p.id ? 'wait' : 'pointer',
                            flexShrink: 0,
                            opacity: busy === p.id ? 0.7 : 1,
                          }}
                        >
                          {btnLabel}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {toast ? (
          <div style={{ fontSize: 11, color: '#bf5f90', marginTop: 8 }}>{toast}</div>
        ) : null}
      </div>

      {modalOpen && modalTarget ? (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && modalStep === 'form' && !busy) closeModal()
          }}
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
            className="owner-v3-card"
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%',
              maxWidth: 360,
              background: 'var(--bg3)',
              border: '1px solid rgba(123,94,167,0.35)',
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 12px 40px rgba(123,94,167,0.25)',
            }}
          >
            {modalStep === 'form' ? (
              <>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>데모 결제</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: ACCENT_COLOR, marginBottom: 4 }}>
                  {modalTarget.pkg.tier_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
                  {modalTarget.brand.brandName} · 체험용 결제창 (실제 과금 없음)
                </div>

                <div
                  style={{
                    padding: '14px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(123,94,167,0.25)',
                    background: 'rgba(123,94,167,0.08)',
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                    {modalIsUpgrade ? '차액 결제 금액' : '결제 금액'}
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    ₩{modalPrice.toLocaleString()}
                  </div>
                  {modalIsUpgrade ? (
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>
                      정가 ₩{modalListPrice.toLocaleString()} − 보유 등급 정가
                    </div>
                  ) : null}
                </div>

                <label style={{ display: 'block', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>카드번호</div>
                  <input
                    type="text"
                    readOnly
                    placeholder="1234 5678 9012 3456"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid rgba(123,94,167,0.3)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text)',
                      fontSize: 13,
                      outline: 'none',
                      cursor: 'default',
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                    장식용 입력칸이에요. 실제 검증·저장 없음
                  </div>
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={closeModal}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text3)',
                      fontSize: 12,
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void submitDemoPayment()}
                    style={{
                      flex: 2,
                      padding: '10px',
                      borderRadius: 8,
                      border: 'none',
                      background: PURPLE,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: busy ? 'wait' : 'pointer',
                      opacity: busy ? 0.7 : 1,
                    }}
                  >
                    {busy ? '처리 중…' : '결제하기'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: ACCENT_COLOR, marginBottom: 6 }}>
                    체험 완료
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                    <span style={{ color: ACCENT_COLOR, fontWeight: 600 }}>{successGrade}</span> 등급이
                    활성화됐어요
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                    데모 모드 결제예요. 실제 과금은 없어요.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={confirmDemoSuccess}
                  style={{
                    width: '100%',
                    marginTop: 16,
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
                  확인
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
