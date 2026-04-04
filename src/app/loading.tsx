export default function Loading() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#1a0a2e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <svg width="340" height="400" viewBox="0 0 680 400" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="60" r="1.2" fill="#e8d5ff" opacity="0.5"/>
        <circle cx="150" cy="30" r="0.8" fill="#e8d5ff" opacity="0.4"/>
        <circle cx="220" cy="80" r="1" fill="#e8d5ff" opacity="0.6"/>
        <circle cx="310" cy="20" r="1.2" fill="#e8d5ff" opacity="0.3"/>
        <circle cx="400" cy="50" r="0.9" fill="#e8d5ff" opacity="0.5"/>
        <circle cx="490" cy="25" r="1.1" fill="#e8d5ff" opacity="0.4"/>
        <circle cx="570" cy="70" r="0.8" fill="#e8d5ff" opacity="0.6"/>
        <circle cx="630" cy="40" r="1" fill="#e8d5ff" opacity="0.3"/>
        <circle cx="50" cy="120" r="0.9" fill="#e8d5ff" opacity="0.4"/>
        <circle cx="600" cy="110" r="1" fill="#e8d5ff" opacity="0.5"/>
        <circle cx="30" cy="300" r="1" fill="#e8d5ff" opacity="0.3"/>
        <circle cx="560" cy="320" r="1.1" fill="#e8d5ff" opacity="0.3"/>
        <circle cx="640" cy="360" r="0.9" fill="#e8d5ff" opacity="0.5"/>
        <ellipse cx="340" cy="200" rx="160" ry="160" fill="#3d1478" opacity="0.25"/>
        <ellipse cx="340" cy="200" rx="110" ry="110" fill="#5a2bad" opacity="0.2"/>
        <ellipse cx="340" cy="200" rx="70" ry="70" fill="#7b45d4" opacity="0.15"/>
        <text x="340" y="175" textAnchor="middle" fontFamily="Georgia, serif" fontSize="36" fontWeight="300" letterSpacing="12" fill="#e8d5ff" opacity="0.95">AURAN</text>
        <text x="340" y="200" textAnchor="middle" fontFamily="Georgia, serif" fontSize="11" fontWeight="300" letterSpacing="6" fill="#c4a0f0" opacity="0.7">BEAUTY FOUNDATION</text>
        <g transform="translate(340, 240)">
          <polygon points="0,-11 2.6,-3.6 10.5,-3.6 4.2,1.4 6.5,8.9 0,4.4 -6.5,8.9 -4.2,1.4 -10.5,-3.6 -2.6,-3.6" fill="#f5d76e" opacity="0.95"/>
        </g>
        <rect x="290" y="295" width="100" height="2" rx="1" fill="#3d1478" opacity="0.8"/>
      </svg>
    </div>
  )
}
