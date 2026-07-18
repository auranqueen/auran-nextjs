'use client'

import { useOwnerStorePeriod } from '@/hooks/useOwnerStorePeriod'

/** 구독 페이지 trial/active 문장형 D-day 배너 (500줄 룰 분리) */
export default function SubscriptionPeriodBanner({ hasActiveSub }: { hasActiveSub: boolean }) {
  const { phase, daysLeft, ready } = useOwnerStorePeriod()
  if (!ready) return null

  if (hasActiveSub && phase === 'active') {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(76,173,126,0.12)',
          border: '1px solid rgba(76,173,126,0.35)',
          fontSize: 12,
          color: 'rgba(143,212,168,0.95)',
          lineHeight: 1.5,
        }}
      >
        이용기간이 시작됐어요 (D-{daysLeft})
      </div>
    )
  }

  if (!hasActiveSub && phase === 'trial') {
    return (
      <div
        style={{
          marginBottom: 12,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(123,94,167,0.12)',
          border: '1px solid rgba(123,94,167,0.35)',
          fontSize: 12,
          color: 'rgba(196,167,231,0.95)',
          lineHeight: 1.5,
        }}
      >
        현재 90일 무료 이용중이십니다 (D-{daysLeft})
      </div>
    )
  }

  return null
}
