'use client'

const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

type Props = {
  salonName?: string | null
}

export function EmptyBannerHook({ salonName }: Props) {
  const name = salonName?.trim() || '이곳'
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 12px',
        textAlign: 'center',
        background: PURPLE_LIGHT,
        gap: 8,
      }}
    >
      <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.4 }}>{name} 첫 방문이신가요?</div>
      <span
        style={{
          display: 'inline-block',
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 20,
          background: 'rgba(123,94,167,0.35)',
          border: `0.5px solid ${PURPLE}`,
          color: GOLD,
        }}
      >
        첫 관리 10% 할인
      </span>
      <div style={{ fontSize: 10, color: TEXT_SUB, lineHeight: 1.4 }}>예약 시 첫 방문 할인이 자동 적용돼요</div>
    </div>
  )
}
