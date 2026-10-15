'use client'
import { BORDER, GOLD, STATUS_MAP, SUB, TEXT, ddayLabel, formatSchedule, type BroadcastActions, type BroadcastRow } from './liveUtils'
import { BroadcastActionButtons } from './LiveBroadcastList'

const KEY_TEXT = { fontSize: 12, fontFamily: 'monospace', background: '#f5f5f5', padding: '5px 8px', borderRadius: 6, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
const COPY_BTN = { fontSize: 11, padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', flexShrink: 0 } as const

export function StreamKeyCard({ streamKey, onCopy, onClose }: { streamKey: { rtmp_url: string; rtmp_key: string }; onCopy: (text: string) => void; onClose: () => void }) {
  return (
    <div style={{ marginBottom: 16, background: '#fff9f0', border: '1px solid #f5d8a0', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: '#a06010', marginBottom: 8 }}>📡 송출 정보 (비공개)</div>
      <div style={{ fontSize: 11, color: SUB, marginBottom: 3 }}>RTMP URL</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={KEY_TEXT}>{streamKey.rtmp_url}</span>
        <button type="button" onClick={() => onCopy(streamKey.rtmp_url)} style={COPY_BTN}>복사</button>
      </div>
      <div style={{ fontSize: 11, color: SUB, marginBottom: 3 }}>스트림 키</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={KEY_TEXT}>{streamKey.rtmp_key}</span>
        <button type="button" onClick={() => onCopy(streamKey.rtmp_key)} style={COPY_BTN}>복사</button>
      </div>
      <div style={{ fontSize: 10, color: '#c08040', marginTop: 8 }}>⚠️ 스트림 키는 타인에게 공유하지 마세요</div>
      <button type="button" onClick={onClose} style={{ marginTop: 8, fontSize: 11, color: SUB, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>닫기</button>
    </div>
  )
}

interface Props {
  broadcast: BroadcastRow | null
  actions: BroadcastActions
  onCreate: () => void
}

export default function LiveHeroCard({ broadcast: b, actions, onCreate }: Props) {
  if (!b) {
    return (
      <div style={{ border: `1.5px dashed ${GOLD}`, borderRadius: 14, background: '#fbf8f2', padding: '22px 16px', textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 28, marginBottom: 6 }}>📺</div>
        <div style={{ fontSize: 13, color: TEXT, marginBottom: 4 }}>예정된 방송이 없어요</div>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 12 }}>달력에서 날짜를 눌러도 방송을 잡을 수 있어요</div>
        <button
          type="button"
          onClick={onCreate}
          style={{ fontSize: 13, padding: '9px 18px', borderRadius: 20, border: 'none', background: GOLD, color: '#fff', cursor: 'pointer' }}
        >
          + 첫 방송 만들기
        </button>
      </div>
    )
  }

  const st = STATUS_MAP[b.status] || STATUS_MAP['ended']
  const dday = ddayLabel(b)
  const isLive = b.status === 'live'

  return (
    <div style={{ display: 'flex', gap: 12, border: `1px solid ${GOLD}`, borderRadius: 14, background: '#fffaf2', padding: 12, marginBottom: 16 }}>
      <div style={{ width: 84, flexShrink: 0, aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #a78bfa, #f9a8d4)' }}>
        {b.thumbnail_url && (
          <img src={b.thumbnail_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {dday && (
          <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 10, padding: '2px 7px', borderRadius: 6, background: isLive ? '#ef4444' : GOLD, color: '#fff' }}>
            {dday}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: GOLD }}>{isLive ? '지금 방송 중' : '다음 방송'}</span>
          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 5, background: st.bg, color: st.color }}>{st.label}</span>
        </div>
        <div style={{ fontSize: 15, color: TEXT, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{b.title}</div>
        {b.scheduled_at && <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>🗓 {formatSchedule(b.scheduled_at)}</div>}
        {b.description && (
          <div style={{ fontSize: 11, color: SUB, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.description}</div>
        )}
        <div style={{ marginTop: 'auto' }}>
          <BroadcastActionButtons b={b} actions={actions} />
        </div>
      </div>
    </div>
  )
}
