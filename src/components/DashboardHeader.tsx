'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardHeader({
  title,
  right,
  onBack,
}: {
  title: string
  right?: React.ReactNode
  onBack?: () => void
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
        padding: 'calc(env(safe-area-inset-top, 0px) + 0.875rem) 1rem 0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Link href="/" style={{
          fontFamily: "'Noto Serif KR', serif",
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#7B5EA7',
          textDecoration: 'none',
          letterSpacing: '0.1em',
          flexShrink: 0,
        }}>
          AURAN
        </Link>
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => (onBack ? onBack() : router.back())}
          style={{
            width: '2.125rem',
            height: '2.125rem',
            borderRadius: '0.625rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)',
            color: 'var(--text2)',
            fontSize: '1.125rem',
            cursor: 'pointer',
          }}
        >
          ‹
        </button>
        <div
          style={{
            fontFamily: "'Noto Serif KR', serif",
            fontSize: '1rem',
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

