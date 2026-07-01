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
        aspectRatio: '21/9',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        boxSizing: 'border-box',
        background: PURPLE_LIGHT,
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.35, marginBottom: 4 }}>{name} 첫 방문이신가요?</div>
        <div style={{ fontSize: 11, color: TEXT_SUB, lineHeight: 1.4 }}>예약 시 첫 방문 할인이 자동 적용돼요</div>
      </div>
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          padding: '6px 12px',
          borderRadius: 20,
          background: 'rgba(123,94,167,0.35)',
          border: `0.5px solid ${PURPLE}`,
          color: GOLD,
          whiteSpace: 'nowrap',
        }}
      >
        첫 관리 10% 할인
      </span>
    </div>
  )
}
