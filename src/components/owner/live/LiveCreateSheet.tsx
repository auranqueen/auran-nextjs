'use client'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { compressImage } from '@/lib/imageUpload'
import { BORDER, SUB, TEXT, toDateStr } from './liveUtils'
import LiveProductPicker, { type LivePickerProduct } from './LiveProductPicker'

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MAX_THUMB_BYTES = 20 * 1024 * 1024
const FOOTER_PAD = 72

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
  broadcastId?: number | null
  showToast?: (text: string) => void
  createProducts?: LivePickerProduct[]
  onCreateProductsChange?: (items: LivePickerProduct[]) => void
}

async function prepareLiveThumb(file: File): Promise<File> {
  if (file.size > MAX_THUMB_BYTES) throw new Error('too_large')
  const out = await compressImage(file, 'live_thumb')
  const mime = (out.type || '').toLowerCase()
  const name = (out.name || '').toLowerCase()
  if (mime.includes('heic') || mime.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')) {
    throw new Error('unsupported')
  }
  return out
}

export default function LiveCreateSheet({
  mode, isPC, showForm, onClose, draft, setDraft, schedule, setSchedule,
  thumbPreview, pickThumb, saving, submit, broadcastId, showToast,
  createProducts, onCreateProductsChange,
}: Props) {
  const editFile = mode === 'edit' ? draft.thumb_file ?? null : null
  const [editPreview, setEditPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!editFile) { setEditPreview(null); return }
    const url = URL.createObjectURL(editFile)
    setEditPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [editFile])
  const preview = mode === 'edit' ? editPreview ?? draft.thumbnail_url ?? null : thumbPreview

  const pickEditThumb = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const compressed = await prepareLiveThumb(file)
      setDraft((p) => ({ ...p, thumb_file: compressed }))
    } catch (err) {
      setDraft((p) => ({ ...p, thumb_file: null }))
      const msg = err instanceof Error && err.message === 'too_large'
        ? '사진은 20MB 이하로 선택해 주세요'
        : '이 사진은 사용할 수 없어요. 다른 사진을 선택해 주세요'
      showToast?.(msg)
    }
  }

  const panelBase = {
    position: 'fixed' as const, zIndex: 50, background: '#fff', color: '#1a1a1a',
    display: 'flex' as const, flexDirection: 'column' as const,
    visibility: showForm ? 'visible' as const : 'hidden' as const,
  }

  return (
    <>
      {isPC && showForm && (
        <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 49 }} />
      )}
      <div
        aria-hidden={!showForm}
        style={isPC ? {
          ...panelBase, top: '50%', left: '50%', width: '480px', maxHeight: '90vh',
          borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden',
          transform: showForm ? 'translate(-50%, -50%)' : 'translate(-40%, -50%)',
          opacity: showForm ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s, visibility 0.28s',
        } : {
          ...panelBase, inset: 0, height: '100dvh', maxHeight: '100dvh',
          transform: showForm ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1), visibility 0.28s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top, 0px)) 16px 14px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
          <button type="button" aria-label="뒤로가기" onClick={() => onClose()}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: TEXT, padding: 0 }}>←</button>
          <div style={{ fontSize: 16, color: TEXT }}>{mode === 'edit' ? '방송 수정' : '방송 만들기'}</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, paddingBottom: FOOTER_PAD }}>
          <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>썸네일 (선택)</div>
          <label style={{ display: 'block', position: 'relative', width: '100%', maxWidth: 180, marginLeft: 'auto', marginRight: 'auto', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', border: '1.5px dashed #C9A96E', cursor: 'pointer', background: '#fbf8f2', marginBottom: 10 }}>
            <input type="file" accept="image/*" onChange={(e) => { if (mode === 'edit') void pickEditThumb(e); else pickThumb(e) }} style={{ display: 'none' }} />
            {preview ? (
              <img src={preview} alt="방송 썸네일 미리보기" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="6" width="18" height="14" rx="2" stroke="#C9A96E" strokeWidth="1.5" />
                  <path d="M8 6l1.5-2h5L16 6" stroke="#C9A96E" strokeWidth="1.5" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.5" stroke="#C9A96E" strokeWidth="1.5" />
                </svg>
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
          <div style={{ marginBottom: 14 }}>
            <input
              type="date"
              value={schedule.date}
              min={toDateStr(new Date())}
              onChange={(e) => setSchedule((p) => ({ ...p, date: e.target.value }))}
              style={{ width: '100%', minWidth: 0, padding: '10px 8px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT, marginBottom: 6 }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={schedule.hour} onChange={(e) => setSchedule((p) => ({ ...p, hour: e.target.value }))}
                style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT, appearance: 'none', WebkitAppearance: 'none' }}>
                {HOURS.map((h) => <option key={h} value={h}>{h}시</option>)}
              </select>
              <select value={schedule.minute} onChange={(e) => setSchedule((p) => ({ ...p, minute: e.target.value }))}
                style={{ flex: 1, minWidth: 0, padding: '10px 8px', borderRadius: 9, border: `1px solid ${BORDER}`, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: TEXT, appearance: 'none', WebkitAppearance: 'none' }}>
                {(mode === 'edit' && !['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].includes(schedule.minute) ? [schedule.minute, '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'] : ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']).map((m) => <option key={m} value={m}>{m}분</option>)}
              </select>
            </div>
          </div>
          {mode === 'edit' && broadcastId != null ? (
            <LiveProductPicker mode="remote" broadcastId={broadcastId} showToast={showToast} />
          ) : mode === 'create' ? (
            <LiveProductPicker mode="local" value={createProducts ?? []} onChange={onCreateProductsChange} showToast={showToast} />
          ) : null}
        </div>
        <div style={{
          flexShrink: 0, background: '#fff', borderTop: `1px solid ${BORDER}`,
          padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}>
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