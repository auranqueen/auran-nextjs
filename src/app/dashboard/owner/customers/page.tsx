'use client'

import { useRouter } from 'next/navigation'

const BG = '#ffffff'
const SURFACE = '#f9f8fc'
const BORDER = '#ede9f7'
const TEXT = '#1A1A2E'
const TEXT_SUB = '#888888'
const PURPLE = '#7B5EA7'

export default function OwnerCustomersComingSoonPage() {
  const router = useRouter()

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: `0.5px solid ${BORDER}` }}>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner')}
          style={{ border: 'none', background: 'transparent', fontSize: 14, color: PURPLE, cursor: 'pointer' }}
        >
          {'\u2190'}
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 500 }}>고객 관리</div>
        <div style={{ width: 28 }} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '64px 24px',
          minHeight: 'calc(100vh - 56px)',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>{'\uD83D\uDC65'}</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: TEXT, marginBottom: 10, lineHeight: 1.5 }}>
          {'\uD83D\uDEE0\uFE0F'} 고객 관리 기능은 준비중이에요
        </div>
        <div style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.7, maxWidth: 320, marginBottom: 24 }}>
          예약·수동등록 고객을 한 곳에서 관리할 수 있도록 곧 찾아올게요
        </div>
        <div
          style={{
            fontSize: 11,
            color: PURPLE,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 999,
            padding: '8px 14px',
          }}
        >
          완성되면 이 자리에서 바로 만나보실 수 있어요
        </div>
      </div>
    </div>
  )
}