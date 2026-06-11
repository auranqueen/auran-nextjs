'use client'

import Link from 'next/link'

const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

export type SalonRow = {
  id: string
  name?: string | null
  address?: string | null
  area?: string | null
  phone?: string | null
  status?: string | null
  avg_rating?: number | null
  review_count?: number | null
  avatar_url?: string | null
}

type Props = {
  loading: boolean
  salons: SalonRow[]
  searchQuery: string
  onSearch: (q: string) => void
}

export default function BookingSalonListView({ loading, salons, searchQuery, onSearch }: Props) {
  if (loading) {
    return <div style={{ fontSize: 12, color: TEXT_MUTED }}>불러오는 중...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          🔍
        </span>
        <input
          type="text"
          placeholder="살롱 이름, 지역으로 검색"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          style={{
            background: '#181520',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: '10px 14px 10px 36px',
            color: 'rgba(255,255,255,0.85)',
            fontSize: 13,
            width: '100%',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {salons.length === 0 ? (
        searchQuery.trim() ? (
          <div style={{ fontSize: 12, color: TEXT_MUTED, textAlign: 'center', padding: '24px 0' }}>
            &apos;{searchQuery}&apos;에 해당하는 살롱이 없어요
          </div>
        ) : (
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>표시할 살롱이 없습니다.</div>
        )
      ) : (
        salons.map(s => {
          const rating = Number(s.avg_rating) || 0
          const reviews = s.review_count ?? 0
          const initial = (s.name || 'S').charAt(0).toUpperCase()

          return (
            <Link
              key={s.id}
              href={`/booking/${s.id}`}
              style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  background: CARD_BG,
                  border: CARD_BORDER,
                  borderRadius: 16,
                  padding: '13px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {s.avatar_url ? (
                  <img
                    src={s.avatar_url}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#7B5EA7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {initial}
                  </div>
                )}
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)' }}>{s.name || '살롱'}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
                {s.area ? (
                  <span
                    style={{
                      background: 'rgba(123,94,167,0.2)',
                      color: '#7B5EA7',
                      fontSize: 10,
                      borderRadius: 6,
                      padding: '2px 8px',
                      flexShrink: 0,
                    }}
                  >
                    {s.area}
                  </span>
                ) : null}
                <span style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.5 }}>{s.address || '—'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                  ⭐ {rating.toFixed(1)} · 리뷰 {reviews}개
                </div>
                <button
                  type="button"
                  style={{
                    background: '#7B5EA7',
                    color: '#fff',
                    fontSize: 11,
                    borderRadius: 14,
                    padding: '6px 14px',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  예약하기
                </button>
              </div>
              </div>
            </Link>
          )
        })
      )}
    </div>
  )
}
