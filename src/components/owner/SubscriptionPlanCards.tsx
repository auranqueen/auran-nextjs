'use client'

type PlanRow = {
  id: string
  slug?: string | null
  code?: string | null
  name?: string | null
  billing_period?: string | null
  features?: string[] | null
  is_recommended?: boolean | null
}

function pricePeriodLabel(p: PlanRow): '/년' | '/월' {
  return String(p.billing_period || '').toLowerCase() === 'annual' ? '/년' : '/월'
}

/** 구독 플랜 카드 목록 (subscription/page 500줄 룰 분리) */
export default function SubscriptionPlanCards(props: {
  plans: PlanRow[]
  priceFor: (p: PlanRow) => number
  onSelect: (p: PlanRow) => void
}) {
  const { plans, priceFor, onSelect } = props
  if (plans.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', padding: '12px 0' }}>
        등록된 플랜이 없어요. 관리자에게 subscription_plans 등록을 요청해보세요.
      </div>
    )
  }
  return (
    <>
      {plans.map((p) => {
        const slug = String(p.slug || p.code || '').toLowerCase()
        const isPro = slug === 'pro' || p.is_recommended === true
        const price = priceFor(p)
        const feats = Array.isArray(p.features) ? p.features : []
        return (
          <div
            key={p.id}
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.03)',
              border: isPro ? '1px solid rgba(123,94,167,0.4)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: 20,
              marginBottom: 12,
            }}
          >
            {isPro ? (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 8,
                  background: 'rgba(123,94,167,0.35)',
                  color: '#f0e8ff',
                  fontWeight: 800,
                }}
              >
                추천
              </span>
            ) : null}
            <div style={{ fontSize: 16, fontWeight: 800 }}>{p.name || p.slug || '플랜'}</div>
            <div style={{ marginTop: 8, fontSize: 18, color: '#C9A96E', fontWeight: 800 }}>
              {price > 0 ? `${price.toLocaleString()}원${pricePeriodLabel(p)}` : '가격 문의'}
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {feats.length === 0 ? (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>혜택 정보가 없습니다</div>
              ) : (
                feats.map((f, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                    ✅ {f}
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect(p)}
              style={{
                marginTop: 14,
                width: '100%',
                border: 'none',
                borderRadius: 12,
                background: '#7B5EA7',
                color: '#fff',
                padding: '11px 0',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              선택하기
            </button>
          </div>
        )
      })}
    </>
  )
}
