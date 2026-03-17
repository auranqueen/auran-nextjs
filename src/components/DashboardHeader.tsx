'use client'

import { useRouter } from 'next/navigation'

export default function DashboardHeader({
  title,
  right,
}: {
  title: string
  right?: React.ReactNode
}) {
  const router = useRouter()

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'linear-gradient(160deg,#0a0c0f,#111318)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => router.back()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ‹
        </button>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
      </div>

      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : <div />}
    </div>
  )
}

