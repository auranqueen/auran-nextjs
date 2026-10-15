'use client'
import { BORDER, GOLD, STATUS_MAP, SUB, TEXT, ddayLabel, formatSchedule, type BroadcastActions, type BroadcastRow } from './liveUtils'

const SMALL_BTN = { fontSize: 10, padding: '4px 8px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', color: GOLD, cursor: 'pointer' } as const
const DANGER_BTN = { ...SMALL_BTN, border: '1px solid #fca5a5', color: '#ef4444' } as const

export function BroadcastActionButtons({ b, actions }: { b: BroadcastRow; actions: BroadcastActions }) {
  const { keyLoading, deleteConfirm, deleting, onStreamKey, onEdit, onAskDelete, onDelete } = actions
  const isKeyLoading = keyLoading === b.id
  const editable = b.status === 'upcoming'
  if (deleteConfirm === b.id) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 10, color: TEXT, whiteSpace: 'nowrap' }}>정말 삭제할까요?</span>
        <button type="button" onClick={() => onAskDelete(null)} style={SMALL_BTN}>취소</button>
        <button type="button" disabled={deleting === b.id} onClick={() => onDelete(b.id)} style={DANGER_BTN}>{deleting === b.id ? '삭제 중…' : '확인삭제'}</button>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      <button type="button" disabled={isKeyLoading} onClick={() => onStreamKey(b.id)} style={{ ...SMALL_BTN, cursor: isKeyLoading ? 'wait' : 'pointer' }}>
        {isKeyLoading ? '조회 중…' : '📡 송출키'}
      </button>
      {editable && <button type="button" onClick={() => onEdit(b)} style={SMALL_BTN}>✏️ 수정</button>}
      {editable && <button type="button" onClick={() => onAskDelete(b.id)} style={DANGER_BTN}>🗑️ 삭제</button>}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '36px 0', fontSize: 13, color: SUB }}>{text}</div>
}

function UpcomingCard({ b, actions }: { b: BroadcastRow; actions: BroadcastActions }) {
  const st = STATUS_MAP[b.status] || STATUS_MAP['ended']
  const dday = ddayLabel(b)
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, border: `1px solid ${BORDER}`, borderRadius: 13, marginBottom: 10, background: '#fff' }}>
      <div style={{ width: 60, flexShrink: 0, aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #a78bfa, #f9a8d4)' }}>
        {b.thumbnail_url && (
          <img src={b.thumbnail_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3, flexWrap: 'nowrap' }}>
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 5, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
          {dday && <span style={{ fontSize: 10, color: GOLD, flexShrink: 0 }}>{dday}</span>}
          {b.scheduled_at && <span style={{ fontSize: 10, color: SUB, whiteSpace: 'nowrap' }}>{formatSchedule(b.scheduled_at)}</span>}
        </div>
        <div style={{ fontSize: 13, color: TEXT, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
        {b.description && (
          <div style={{ fontSize: 11, color: SUB, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.description}</div>
        )}
        <BroadcastActionButtons b={b} actions={actions} />
      </div>
    </div>
  )
}

function PastTile({ b }: { b: BroadcastRow }) {
  return (
    <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg, #a78bfa, #f9a8d4)' }}>
      {b.thumbnail_url && (
        <img src={b.thumbnail_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 8px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,0.65))', color: '#fff' }}>
        {b.scheduled_at && <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>{formatSchedule(b.scheduled_at)}</div>}
        <div style={{ fontSize: 12, marginBottom: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.title}</div>
        <div style={{ fontSize: 10 }}>👁️ {b.viewer_count ?? 0}명</div>
      </div>
    </div>
  )
}

interface Props {
  tab: 'upcoming' | 'past'
  onTab: (tab: 'upcoming' | 'past') => void
  upcoming: BroadcastRow[]
  past: BroadcastRow[]
  selectedDate: string | null
  onClearDate: () => void
  actions: BroadcastActions
}

export default function LiveBroadcastList({ tab, onTab, upcoming, past, selectedDate, onClearDate, actions }: Props) {
  const tabs = [
    { key: 'upcoming' as const, label: `예정 ${upcoming.length}` },
    { key: 'past' as const, label: `지난방송 ${past.length}` },
  ]
  const list = tab === 'upcoming' ? upcoming : past
  const emptyText = selectedDate ? '이 날은 방송이 없어요' : tab === 'upcoming' ? '다른 예정 방송이 없어요' : '지난 방송이 없어요'

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, marginBottom: 12 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTab(t.key)}
            style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.key ? GOLD : 'transparent'}`, marginBottom: -1, fontSize: 13, color: tab === t.key ? GOLD : SUB, cursor: 'pointer' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {selectedDate && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: SUB, marginBottom: 10 }}>
          <span>📅 {Number(selectedDate.slice(5, 7))}월 {Number(selectedDate.slice(8, 10))}일 방송만 보는 중</span>
          <button type="button" onClick={onClearDate} style={{ fontSize: 11, color: GOLD, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>전체 보기</button>
        </div>
      )}

      {list.length === 0 ? (
        <Empty text={emptyText} />
      ) : tab === 'upcoming' ? (
        list.map((b) => <UpcomingCard key={b.id} b={b} actions={actions} />)
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {list.map((b) => <PastTile key={b.id} b={b} />)}
        </div>
      )}
    </div>
  )
}
