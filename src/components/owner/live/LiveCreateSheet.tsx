'use client'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { BORDER, SUB, TEXT, toDateStr } from './liveUtils'

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

type Draft = { title: string; description: string; thumbnail_url?: string | null; thumb_file?: File | null }
type Schedule = { date: string; hour: string; minute: string }

interface Props {
  mode: 'create' | 'edit'
  isPC: boolean
  showForm: boolean
  onClose: () => void
  draft: Draft
  setDraft: Dispatch<SetStateAction<Draft>>
  schedule: Schedule
  setSchedule: Dispatch<SetStateAction<Schedule>>
  thumbPreview: string | null
  pickThumb: (e: ChangeEvent<HTMLInputElement>) => void
  saving: boolean
  submit: () => Promise<void>
}

export default function LiveCreateSheet({ mode, isPC, showForm, onClose, draft, setDraft, schedule, setSchedule, thumbPreview, pickThumb, saving, submit }: Props) {
  const editFile = mode === 'edit' ? draft.thumb_file ?? null : null
  const [editPreview, setEditPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!editFile) { setEditPreview(null); return }
    const url = URL.createObjectURL(editFile)
    setEditPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [editFile])
  const preview = mode === 'edit' ? editPreview ?? draft.thumbnail_url ?? null : thumbPreview
  const pickEditThumb = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setDraft((p) => ({ ...p, thumb_file: file }))
  }

  return (
    <>
      {isPC && showForm && (
        <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 49 }} />
      )}
      <div
        aria-hidden={!showForm}
        style={isPC ? {
          position: 'fixed', top: '50%', left: '50%', width: '480px', maxHeight: '90vh', zIndex: 50,
          background: '#fff', color: '#1a1a1a', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          transform: showForm ? 'translate(-50%, -50%)' : 'translate(-40%, -50%)',
          opacity: showForm ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s, visibility 0.28s',
          visibility: showForm ? 'visible' : 'hidden',
        } : {
          position: 'fixed', inset: 0, zIndex: 50, background: '#fff', color: '#1a1a1a',
          display: 'flex', flexDirection: 'column',
          transform: showForm ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), visibility 0.28s',
          visibility: showForm ? 'visible' : 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <button type="button" aria-label="뒤로가기" onClick={() => onClose()}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
          <div style={{ fontSize: 16, color: TEXT }}>{mode === 'edit' ? '방송 수정' : '방송 만들기'}</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>썸네일 (선택)</div>
          <label style={{ display: 'block', position: 'relative', width: '100%', maxWidth: 180, marginLeft: 'auto', marginRight: 'auto', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', border: '1.5px dashed #C9A96E', cursor: 'pointer', background: '#fbf8f2', marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={mode === 'edit' ? pickEditThumb : pickThumb} style={{ display: 'none' }} />
            {preview ? (
              <img src={preview} alt="방송 썸네일 미리보기" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 20 }}>📷</span>
                <span style={{ fontSize: 10, color: '#bbb' }}>1:1 정사각형 권장</span>
              </div>
            )}
          </label>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>방송 제목 *</div>
          <input
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="예: 신제품 출시 기념 라이브"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff' }}
          />
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>설명 (선택)</div>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            placeholder="방송 내용을 간단히 적어주세요"
            rows={2}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fff', resize: 'none' }}
          />
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>예정 일시</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input
              type="date"
              value={schedule.date}
              min={toDateStr(new Date())}
              onChange={(e) => setSchedule((p) => ({ ...p, date: e.target.value }))}
              style={{ flex: 2, minWidth: 0, padding: '10px 10px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT }}
            />
            <select value={schedule.hour} onChange={(e) => setSchedule((p) => ({ ...p, hour: e.target.value }))}
              style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT, appearance: 'none', WebkitAppearance: 'none' }}>
              {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
            </select>
            <select value={schedule.minute} onChange={(e) => setSchedule((p) => ({ ...p, minute: e.target.value }))}
              style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT, appearance: 'none', WebkitAppearance: 'none' }}>
              {(mode === 'edit' && !['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].includes(schedule.minute) ? [schedule.minute, '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'] : ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']).map((m) => <option key={m} value={m}>{m}분</option>)}
            </select>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            style={{ width: '100%', padding: 12, borderRadius: 9, border: 'none', background: saving ? '#ccc' : '#C9A96E', color: '#fff', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? (mode === 'edit' ? '저장 중…' : '만드는 중…') : mode === 'edit' ? '수정 저장' : '방송 만들기'}
          </button>
        </div>
      </div>
    </>
  )
}
