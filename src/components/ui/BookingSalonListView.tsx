'use client'

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
    return <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
  }
  if (salons.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text3)' }}>표시할 살롱이 없습니다.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {salons.map(s => (
        <div
          key={s.id}
          style={{
            position: 'relative',
            padding: '16px 16px 16px 18px',
            borderRadius: 16,
            background: 'linear-gradient(90deg, rgba(201,168,76,0.12) 0%, rgba(255,255,255,0.03) 40%)',
            border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: 'linear-gradient(180deg, var(--gold), rgba(201,168,76,0.35))',
            }}
          />
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{s.name || '살롱'}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)', lineHeight: 1.65 }}>{s.address || '-'}</div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{s.phone || ''}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: s.status === 'active' ? '#4cad7e' : 'var(--gold)' }}>
              {s.status === 'active' ? '예약 가능' : '확인 중'}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
