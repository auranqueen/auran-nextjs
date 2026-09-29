'use client'

export function PointsTab({ points }: { points: any[] }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 900, color: '#fff' }}>포인트 내역 (최대 30)</div>
      {points.length === 0 ? (
        <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>포인트 내역이 없습니다.</div>
      ) : (
        points.map(p => (
          <div key={p.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{p.description || p.type}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 900, color: p.amount >= 0 ? '#4cad7e' : '#d94f4f' }}>
                {p.amount >= 0 ? '+' : ''}
                {p.amount}
              </div>
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>{p.created_at ? new Date(p.created_at).toLocaleString('ko-KR') : ''}</span>
              <span>balance {p.balance}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
