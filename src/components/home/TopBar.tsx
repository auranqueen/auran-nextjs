'use client'

export default function TopBar() {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      background: 'rgba(13,11,9,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
    }}>
      <span style={{
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: '22px',
        fontWeight: 400,
        color: '#C9A96E',
        letterSpacing: '6px',
      }}>
        AURAN
      </span>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          cursor: 'pointer',
        }}>🔍</button>
        <button style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '15px',
          cursor: 'pointer',
        }}>🔔</button>
      </div>
    </header>
  )
}
