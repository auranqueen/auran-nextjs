'use client'

import { GOLD, PURPLE, SUB, TEXT, type ClosePreviewGroup } from './BrandLogisticsDailyClose.helpers'

type Props = {
  totalCount: number
  groups: ClosePreviewGroup[]
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function LogisticsCloseConfirmPopup({ totalCount, groups, busy, onCancel, onConfirm }: Props) {
  return (
    <div
      id="logistics-close-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === 'logistics-close-overlay' && !busy) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#1a1520',
          borderRadius: 16,
          padding: 20,
          width: '100%',
          maxWidth: 440,
          maxHeight: '85vh',
          overflowY: 'auto',
          border: '0.5px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 6 }}>오늘 마감할까요?</div>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 14, lineHeight: 1.5 }}>
          아래 {totalCount}건이 오늘 발송분으로 마감돼요
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {groups.map((g) => (
            <div
              key={g.salonName}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '0.5px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 2 }}>{g.salonName}</div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {g.extraCount > 0 ? `${g.firstProductName} 외 ${g.extraCount}건` : g.firstProductName}
                </div>
              </div>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  background: PURPLE,
                  borderRadius: 999,
                  padding: '3px 8px',
                }}
              >
                {g.badgeCount}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: GOLD, marginBottom: 14 }}>총 발송건 {totalCount}건</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '0.5px solid rgba(255,255,255,0.12)',
              background: 'transparent',
              color: TEXT,
              fontSize: 13,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? '마감 처리 중…' : '마감 확정'}
          </button>
        </div>
      </div>
    </div>
  )
}
