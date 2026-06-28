'use client'
const BG = '#0f0d14'
const ACC = '#7B5EA7'
const GOLD = '#C9A96E'
interface Props {
  displayName: string
  logoUrlStr: string
  initialLetter: string
  approvedStr: string
  originShow: string
  mgrShow: string
  settleShow: string
  onDismiss: () => void
}
export default function BrandWelcomePopup({
  displayName, logoUrlStr, initialLetter, approvedStr,
  originShow, mgrShow, settleShow, onDismiss
}: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, minHeight: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }}>
      <div style={{ width: '100%', maxWidth: 400, background: BG, border: '1px solid rgba(201,169,110,0.3)', borderRadius: 20, overflow: 'hidden' }}>
        <div style={{ height: 3, background: GOLD }} />
        <div style={{ padding: '20px 18px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ fontSize: 18, color: GOLD, animation: 'branddash_sparkle 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }}>✦</span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12, animation: 'branddash_float 2.5s ease-in-out infinite' }}>
            {logoUrlStr ? (
              <img src={logoUrlStr} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 12 }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(123,94,167,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#e4daf5' }}>{initialLetter}</div>
            )}
            <span style={{ fontSize: 16, color: '#f0eaf8' }}>{displayName}</span>
          </div>
          <div style={{ textAlign: 'center', fontSize: 17, color: ACC, marginBottom: 10 }}>{displayName} Brand Hub 콘솔입니다</div>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${GOLD}`, color: GOLD }}>승인일 {approvedStr}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>브랜드명</div>
              {displayName}
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>원산지</div>
              {originShow}
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>담당자</div>
              {mgrShow}
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>정산주기</div>
              {settleShow}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 14 }}>AURAN과 함께하는 {displayName}를 환영합니다 💜</div>
          <ol style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', paddingLeft: 18, marginBottom: 16, lineHeight: 1.6 }}>
            <li>브랜드 정보 최종 확인</li>
            <li>제품 등록 → 납품가 입력 후 승인 요청</li>
            <li>어드민 제품 승인 → 고객에게 노출</li>
          </ol>
          <button type="button" onClick={onDismiss}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${ACC}`, background: 'rgba(123,94,167,0.25)', color: '#f0e8ff', fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
            대시보드 바로 가기
          </button>
          <button type="button" onClick={onDismiss}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer' }}>
            닫기
          </button>
        </div>
        <div style={{ height: 3, background: GOLD }} />
      </div>
    </div>
  )
}
