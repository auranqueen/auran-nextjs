'use client'

const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

export type SalonRow = {
  id: string
  name?: string | null
  address?: string | null
  phone?: string | null
  status?: string | null
}

type Props = {
  loading: boolean
  salons: SalonRow[]
}

export default function BookingSalonListView({ loading, salons }: Props) {
  if (loading) {
    return <div style={{ fontSize: 12, color: TEXT_MUTED }}>불러오는 중...</div>
  }
  if (salons.length === 0) {
    return <div style={{ fontSize: 12, color: TEXT_MUTED }}>표시할 살롱이 없습니다.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {salons.map(s => {
        const open = s.status === 'active'
        return (
          <div
            key={s.id}
            style={{
              background: CARD_BG,
              border: CARD_BORDER,
              borderRadius: 16,
              padding: '13px 14px',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: 12,
                background: 'linear-gradient(135deg,#1a1520,#2a1a30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              💆
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 400, marginBottom: 2, color: 'rgba(255,255,255,0.85)' }}>{s.name || '살롱'}</div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, marginBottom: 4, lineHeight: 1.5 }}>
                {s.address || '—'}
              </div>
              {s.phone ? (
                <div style={{ fontSize: 9, color: TEXT_DIM, fontFamily: 'monospace' }}>{s.phone}</div>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 9,
                  padding: '3px 8px',
                  borderRadius: 10,
                  background: open ? 'rgba(74,200,120,0.15)' : 'rgba(200,80,80,0.1)',
                  color: open ? '#3ab870' : '#c05050',
                }}
              >
                {open ? '예약 가능' : '확인 중'}
              </div>
              <div style={{ fontSize: 9, color: TEXT_DIM }}>{open ? '영업중' : '상태 확인'}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
