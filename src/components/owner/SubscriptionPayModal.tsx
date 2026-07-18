'use client'

type PayTarget = {
  name?: string | null
  slug?: string | null
  billing_period?: string | null
}

function pricePeriodLabel(p: PayTarget): '/년' | '/월' {
  return String(p.billing_period || '').toLowerCase() === 'annual' ? '/년' : '/월'
}

/** 구독 결제 모달 (subscription/page 500줄 룰 분리) */
export default function SubscriptionPayModal(props: {
  payTarget: PayTarget
  amount: number
  trialDays: string
  onClose: () => void
  onPay: () => void
}) {
  const { payTarget, amount, trialDays, onClose, onPay } = props
  const period = pricePeriodLabel(payTarget)
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#1a1228',
          border: '1px solid rgba(123,94,167,0.45)',
          borderRadius: 18,
          padding: 18,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>결제</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{payTarget.name || payTarget.slug}</div>
        <div style={{ fontSize: 18, color: '#C9A96E', marginTop: 6, fontWeight: 800 }}>
          {amount.toLocaleString()}원{period}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          첫 {trialDays}일 무료 후 {amount.toLocaleString()}원{period}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: '#fff',
              borderRadius: 12,
              padding: '11px 0',
              fontSize: 12,
            }}
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onPay}
            style={{
              flex: 2,
              border: 'none',
              borderRadius: 12,
              background: '#7B5EA7',
              color: '#fff',
              padding: '11px 0',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            카드 결제
          </button>
        </div>
      </div>
    </div>
  )
}
