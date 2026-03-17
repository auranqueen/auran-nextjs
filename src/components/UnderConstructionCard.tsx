'use client'

export default function UnderConstructionCard({
  title = '🚧 준비 중입니다',
  desc = '빠르게 준비해서 업데이트하겠습니다.',
}: {
  title?: string
  desc?: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        padding: '16px 16px',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{desc}</div>
    </div>
  )
}

