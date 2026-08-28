'use client'

const PURPLE = '#7B5EA7'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.65)'

type Props = {
  linkType: 'booking' | 'brand_product'
  serviceName?: string | null
  salonId?: string | null
  onClose: () => void
  onPickDate: () => void
}

export default function ScenePaymentCompleteModal({
  linkType,
  serviceName,
  onClose,
  onPickDate,
}: Props) {
  const isBooking = linkType === 'booking'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 130,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 340,
          background: '#1a1228',
          border: '1px solid rgba(123,94,167,0.45)',
          borderRadius: 16,
          padding: 24,
        }}
      >
        {isBooking ? (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 10, lineHeight: 1.45 }}>
              {serviceName || '시술'}, 곧 만나실 시간이에요 ✨
            </div>
            <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 20, lineHeight: 1.5 }}>
              결제가 완료됐어요. 원하시는 날짜를 선택해 주세요.
            </div>
            <button
              type="button"
              onClick={onPickDate}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 12,
                background: PURPLE,
                color: TEXT,
                padding: '13px 0',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              바로 날짜 선택하기
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                color: TEXT,
                borderRadius: 12,
                padding: '11px 0',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              다음에 하기
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT, marginBottom: 20 }}>
              결제가 완료됐어요
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 12,
                background: PURPLE,
                color: TEXT,
                padding: '13px 0',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              확인
            </button>
          </>
        )}
      </div>
    </div>
  )
}