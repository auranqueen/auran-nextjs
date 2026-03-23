const GOLD = '#C9A96E'
const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

export default function ImpactToast() {
  return (
    <div style={{ padding: '14px 16px 0' }}>
      <div
        style={{
          background: 'linear-gradient(135deg,rgba(76,173,126,0.14),rgba(201,169,110,0.08))',
          border: '1px solid rgba(76,173,126,0.28)',
          borderRadius: '16px',
          padding: '14px',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px', color: 'rgba(76,173,126,0.9)' }}>IMPACT TOAST WALLET</span>
          <span style={{ fontSize: '9px', color: TEXT_DIM }}>2026.03</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', padding: '10px' }}>
            <div style={{ fontSize: '9px', color: TEXT_MUTED, marginBottom: '5px' }}>현재 토스트</div>
            <div style={{ fontSize: '20px', color: '#4cad7e', fontWeight: 400, fontFamily: 'monospace' }}>1,240T</div>
            <div style={{ fontSize: '9px', color: 'rgba(76,173,126,0.72)', marginTop: '3px' }}>₩124,000</div>
          </div>
          <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '12px', padding: '10px' }}>
            <div style={{ fontSize: '9px', color: TEXT_MUTED, marginBottom: '5px' }}>이번달 절약</div>
            <div style={{ fontSize: '20px', color: GOLD, fontWeight: 400, fontFamily: 'monospace' }}>+18%</div>
            <div style={{ fontSize: '9px', color: 'rgba(201,169,110,0.72)', marginTop: '3px' }}>전월 대비</div>
          </div>
        </div>
      </div>

      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', color: TEXT_MUTED, fontFamily: 'monospace', letterSpacing: '1px' }}>TOAST FLOW</span>
          <span style={{ fontSize: '10px', color: GOLD }}>+320T</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {[
            { label: '충전', value: '+500T', color: '#4cad7e' },
            { label: '사용', value: '-180T', color: '#e07060' },
            { label: '리워드', value: '+42T', color: GOLD },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: CARD_BORDER, borderRadius: '10px', padding: '8px 6px' }}>
              <div style={{ fontSize: '9px', color: TEXT_DIM, marginBottom: '3px' }}>{item.label}</div>
              <div style={{ fontSize: '12px', color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: '14px', padding: '12px 14px' }}>
        <div style={{ fontSize: '10px', color: TEXT_MUTED, fontFamily: 'monospace', letterSpacing: '1px', marginBottom: '8px' }}>RECENT TOAST HISTORY</div>
        {[
          { icon: '🍞', title: '토스트 충전', date: '03.22 14:10', amount: '+300T', color: '#4cad7e' },
          { icon: '🛍', title: '상품 결제 사용', date: '03.21 19:40', amount: '-120T', color: '#e07060' },
          { icon: '🎁', title: '선물 리워드', date: '03.20 09:15', amount: '+20T', color: GOLD },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: i === 0 ? '0 0 8px' : '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '16px' }}>{row.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.72)' }}>{row.title}</div>
              <div style={{ fontSize: '9px', color: TEXT_DIM }}>{row.date}</div>
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: row.color }}>{row.amount}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <div onClick={() => {}} style={{ flex: 1, padding: '10px 0', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', background: CARD_BG, border: CARD_BORDER, color: TEXT_MUTED, fontSize: '11px' }}>내역보기</div>
        <div onClick={() => {}} style={{ flex: 1.4, padding: '10px 0', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', background: GOLD, color: BG, fontSize: '11px', fontWeight: 400 }}>토스트 굽기</div>
      </div>
    </div>
  )
}
