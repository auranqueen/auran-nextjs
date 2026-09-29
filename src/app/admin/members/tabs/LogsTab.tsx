'use client'

export function LogsTab({ logs }: { logs: any[] }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 900, color: '#fff' }}>로그인 로그 (최대 30)</div>
      {logs.length === 0 ? (
        <div style={{ padding: 12, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>로그가 없습니다.</div>
      ) : (
        logs.map(l => (
          <div key={l.id} style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.email}</div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'JetBrains Mono', monospace" }}>
              <span>{l.ip_address}</span>
              <span>{l.created_at ? new Date(l.created_at).toLocaleString('ko-KR') : ''}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
