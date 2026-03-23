'use client'

type Entry = {
  id: string
  date: string
  note: string
}

type Props = {
  date: string
  setDate: (v: string) => void
  note: string
  setNote: (v: string) => void
  entries: Entry[]
  onAdd: () => void
  onRemove: (id: string) => void
}

export default function DiaryPageView({ date, setDate, note, setNote, entries, onAdd, onRemove }: Props) {
  return (
    <div style={{ padding: '18px 18px 0' }}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10 }}>오늘의 기록</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={date}
            onChange={e => setDate(e.target.value)}
            type="date"
            style={{
              flex: 1,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 12,
              padding: '10px 12px',
              color: '#fff',
              fontSize: 12,
            }}
          />
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="피부 상태/사용한 제품/루틴을 간단히 기록하세요"
          rows={4}
          style={{
            width: '100%',
            resize: 'none',
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 12,
            padding: '10px 12px',
            color: '#fff',
            fontSize: 12,
            lineHeight: 1.6,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onAdd}
          style={{
            marginTop: 10,
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(201,168,76,0.14)',
            border: '1px solid rgba(201,168,76,0.30)',
            color: 'var(--gold)',
            fontSize: 13,
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          기록 추가
        </button>
        <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          이 버전은 로컬 저장(브라우저)에만 저장됩니다. 추후 계정 기반 동기화로 업그레이드됩니다.
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>내 기록</div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>아직 기록이 없습니다.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {entries.map(e => (
            <div key={e.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{e.date}</div>
                <button type="button" onClick={() => onRemove(e.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12, cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{e.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
