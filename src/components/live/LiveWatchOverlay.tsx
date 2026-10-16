'use client'

const LIVE_RED = '#e5484d'
type Status = string

type Props = {
  status: Status
  title: string
  ownerLabel: string
  viewerCount: number | null | undefined
  muted: boolean
  onToggleMute: () => void
  onClose: () => void
  showMute: boolean
}

function MuteIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        <path d="m23 9-6 6" />
        <path d="m17 9 6 6" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function statusBadge(status: Status): { label: string; bg: string; color: string } | null {
  if (status === 'live') return { label: 'LIVE', bg: LIVE_RED, color: '#fff' }
  if (status === 'upcoming') return { label: '예정', bg: 'rgba(255,255,255,0.2)', color: '#fff' }
  if (status === 'ended') return { label: '종료', bg: 'rgba(255,255,255,0.2)', color: '#fff' }
  return null
}

export default function LiveWatchOverlay({
  status, title, ownerLabel, viewerCount, muted, onToggleMute, onClose, showMute,
}: Props) {
  const badge = statusBadge(status)
  const showViewers = typeof viewerCount === 'number' && viewerCount > 0

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 28%, transparent 48%)',
      }}
    >
      <div
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
          paddingLeft: 12,
          paddingRight: 12,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge && (
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          )}
          {showViewers && (
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.45)', color: '#fff' }}>
              {viewerCount.toLocaleString('ko-KR')}명 시청
            </span>
          )}
          <div style={{ flex: 1 }} />
          {showMute && (
            <button
              type="button"
              aria-label={muted ? '소리 켜기' : '음소거'}
              onClick={onToggleMute}
              style={{
                width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer',
                background: 'rgba(0,0,0,0.45)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              <MuteIcon muted={muted} />
            </button>
          )}
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 16, border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 18, lineHeight: 1, padding: 0,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ marginTop: 10, paddingRight: 8 }}>
          <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.35 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{ownerLabel || '원장님'}</div>
        </div>
      </div>
    </div>
  )
}