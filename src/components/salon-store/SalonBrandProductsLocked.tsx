'use client'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const BORDER = 'rgba(255,255,255,0.08)'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'

export default function SalonBrandProductsLocked() {
  return (
    <div
      style={{
        background: PURPLE_LIGHT,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          margin: '0 auto 16px',
          borderRadius: '50%',
          background: BG,
          border: `1px solid ${BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        🔒
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.5, marginBottom: 8 }}>
        원장님 구독 후 이용 가능한 메뉴예요
      </div>
      <div style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.6 }}>
        브랜드 제품 진열은 원장님 스토어 구독이 시작되면 이곳에서 확인하실 수 있어요.
      </div>
      <div
        style={{
          marginTop: 16,
          display: 'inline-block',
          fontSize: 11,
          color: PURPLE,
          padding: '6px 12px',
          borderRadius: 20,
          border: `1px solid rgba(123,94,167,0.35)`,
          background: 'rgba(123,94,167,0.08)',
        }}
      >
        준비 중
      </div>
    </div>
  )
}
