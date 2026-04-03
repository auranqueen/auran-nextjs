'use client'

import { CALENDAR_SHEET_CONDITION_LABELS } from '@/lib/calendarConstants'

type Props = {
  open: boolean
  onClose: () => void
  iso: string
  conditionPick: string[]
  onConditionPick: (v: string[]) => void
  note: string
  onNote: (v: string) => void
  onSavePeriodStart: () => Promise<void>
  onSavePeriodEnd: () => Promise<void>
  onSave: () => Promise<void>
}

export default function CalendarSheet({
  open,
  onClose,
  iso,
  conditionPick,
  onConditionPick,
  note,
  onNote,
  onSavePeriodStart,
  onSavePeriodEnd,
  onSave,
}: Props) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 170 }} />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          maxWidth: 390,
          margin: '0 auto',
          zIndex: 171,
          background: '#141018',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTop: '1px solid rgba(123,94,167,0.35)',
          padding: '16px',
          maxHeight: '78vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#fff' }}>{iso}</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {CALENDAR_SHEET_CONDITION_LABELS.map(label => (
            <button
              key={label}
              type="button"
              onClick={() =>
                onConditionPick(conditionPick.includes(label) ? conditionPick.filter(x => x !== label) : [...conditionPick, label])
              }
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                background: conditionPick.includes(label) ? '#7B5EA7' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: 11,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            onClick={onSavePeriodStart}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              border: '1px solid rgba(224,120,152,0.4)',
              background: 'rgba(224,120,152,0.15)',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            💜 생리 시작
          </button>
          <button
            type="button"
            onClick={onSavePeriodEnd}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 10,
              border: '1px solid rgba(123,94,167,0.4)',
              background: 'rgba(123,94,167,0.15)',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            생리 끝
          </button>
        </div>

        <input
          value={note}
          onChange={e => onNote(e.target.value)}
          placeholder="오늘 피부 한마디..."
          maxLength={200}
          style={{
            width: '100%',
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontSize: 12,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        <button
          type="button"
          onClick={onSave}
          style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#7B5EA7', color: '#fff', fontSize: 13, cursor: 'pointer' }}
        >
          저장
        </button>
      </div>
    </>
  )
}
