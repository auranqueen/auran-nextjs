'use client'

export type BrandChatChannel = {
  id: string
  owner_id: string
  owner_name: string
  salon_name: string
  grade: string | null
  is_arete: boolean
  last_message: string | null
  last_message_at: string | null
  unread_by_brand: number
  reward_points?: number
  arete_points?: number
  profile_id?: string | null
}

type Props = {
  channels: BrandChatChannel[]
  selectedId: string | null
  onSelect: (id: string) => void
  showAll: boolean
  onToggleShowAll: () => void
}

const TEXT = 'rgba(255,255,255,0.7)'
const SUB = 'rgba(255,255,255,0.35)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간`
  return `${Math.floor(h / 24)}일`
}

export default function BrandChatChannelList({
  channels, selectedId, onSelect, showAll, onToggleShowAll,
}: Props) {
  const visible = showAll ? channels : channels.slice(0, 5)
  const hasMore = channels.length > 5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ fontSize: 11, color: SUB, padding: '8px 10px 6px', letterSpacing: '0.04em' }}>
        💬 1:1 상담 · {channels.length}명
      </div>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {channels.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: SUB }}>대화 채널이 없어요</div>
        ) : visible.map((ch) => {
          const active = ch.id === selectedId
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onSelect(ch.id)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 12px', border: 'none', cursor: 'pointer',
                background: active ? 'rgba(123,94,167,0.18)' : 'transparent',
                borderLeft: active ? `2px solid ${PURPLE}` : '2px solid transparent',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: 'rgba(123,94,167,0.25)', color: '#c4a7e7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
              }}>
                {(ch.owner_name || '?').slice(0, 1)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, color: TEXT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.owner_name}
                  </span>
                  {ch.unread_by_brand > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, background: '#e85555', color: '#fff',
                      borderRadius: 999, padding: '1px 6px', flexShrink: 0,
                    }}>{ch.unread_by_brand > 99 ? '99+' : ch.unread_by_brand}</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: SUB, flexShrink: 0 }}>{timeAgo(ch.last_message_at)}</span>
                </div>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.salon_name}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                  {ch.grade && (
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, border: `0.5px solid ${GOLD}`, color: GOLD }}>{ch.grade}</span>
                  )}
                  {ch.is_arete && (
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'rgba(123,94,167,0.25)', color: '#c4a7e7' }}>아레테</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: TEXT, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.last_message || '아직 메시지가 없어요'}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={onToggleShowAll}
          style={{
            margin: 8, padding: '8px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: SUB, fontSize: 11, cursor: 'pointer',
          }}
        >
          {showAll ? '접기' : `더보기 (+${channels.length - 5})`}
        </button>
      )}
    </div>
  )
}
