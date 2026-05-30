const pulse: Record<string, string | number> = {
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  animation: 'adminSkPulse 1.4s ease-in-out infinite',
}

function Sk({ style }: { style?: Record<string, string | number> }) {
  return <div style={{ ...pulse, ...style }} />
}

export default function AdminLoading() {
  return (
    <div style={{ background: 'var(--bg)' }}>
      <style>{`@keyframes adminSkPulse{0%,100%{opacity:.4}50%{opacity:.7}}`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Sk style={{ width: 180, height: 10, marginBottom: 8 }} />
          <Sk style={{ width: 220, height: 36, borderRadius: 9 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Sk style={{ width: 72, height: 52, borderRadius: 9 }} />
          <Sk style={{ width: 72, height: 52, borderRadius: 9 }} />
          <Sk style={{ width: 72, height: 52, borderRadius: 9 }} />
        </div>
      </div>

      <div className="sg sg-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="sc" style={{ pointerEvents: 'none' }}>
            <Sk style={{ width: 64, height: 10, marginBottom: 12, borderRadius: 4 }} />
            <Sk style={{ width: 100, height: 28, marginBottom: 8, borderRadius: 6 }} />
            <Sk style={{ width: 88, height: 8, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      <div className="split s32">
        <div className="card">
          <div className="card-hdr">
            <div style={{ flex: 1 }}>
              <Sk style={{ width: 140, height: 14, marginBottom: 6 }} />
              <Sk style={{ width: 100, height: 10 }} />
            </div>
            <Sk style={{ width: 72, height: 28, borderRadius: 7 }} />
          </div>
          <div style={{ padding: '12px 18px 18px' }}>
            {[0, 1, 2, 4].map(i => (
              <Sk key={i} style={{ width: '100%', height: 12, marginBottom: 10, borderRadius: 4 }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="card">
              <div className="card-hdr">
                <Sk style={{ width: 120, height: 14 }} />
                <Sk style={{ width: 56, height: 28, borderRadius: 7 }} />
              </div>
              <div style={{ padding: '12px 18px 18px' }}>
                {[0, 1, 2].map(j => (
                  <Sk key={j} style={{ width: '100%', height: 12, marginBottom: 10, borderRadius: 4 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
