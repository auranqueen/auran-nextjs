'use client'

import React from 'react'
import type { Draft, ProductPick } from './types'
import { TRACKS, PHASES, SKINS, CONCERNS, ZONES, inp } from './types'

const lbl = (t: string) => (
  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>{t}</div>
)

export function DraftForm({
  draft,
  setDraft,
  pq,
  setPq,
  picks,
  productMeta,
  onAddProduct,
  onRemoveProduct,
  onSave,
  onDelete,
  saving,
  isNew,
}: {
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  pq: string
  setPq: (s: string) => void
  picks: ProductPick[]
  productMeta: Record<string, string>
  onAddProduct: (p: ProductPick) => void
  onRemoveProduct: (id: string) => void
  onSave: () => void
  onDelete: () => void
  saving: boolean
  isNew: boolean
}) {
  const sel = (value: string, onChange: (v: string) => void, options: { v: string; l: string }[]) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inp, cursor: 'pointer' }}
    >
      {options.map(o => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  )

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          {lbl('제목')}
          <input
            value={draft.title}
            onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            style={inp}
            placeholder="카드 제목"
          />
        </div>
        <div>
          {lbl('track')}
          {sel(
            draft.track,
            v => setDraft(d => ({ ...d, track: v as Draft['track'] })),
            TRACKS.map(t => ({ v: t, l: t }))
          )}
        </div>
        <div>
          {lbl('phase')}
          {sel(
            draft.phase,
            v => setDraft(d => ({ ...d, phase: v as Draft['phase'] })),
            PHASES.map(p => ({ v: p, l: p }))
          )}
        </div>
        <div>
          {lbl('skin_type')}
          {sel(
            draft.skin_type,
            v => setDraft(d => ({ ...d, skin_type: v as Draft['skin_type'] })),
            SKINS.map(s => ({ v: s, l: s }))
          )}
        </div>
        <div>
          {lbl('skin_concern')}
          {sel(
            draft.skin_concern,
            v => setDraft(d => ({ ...d, skin_concern: v as Draft['skin_concern'] })),
            CONCERNS.map(c => ({ v: c, l: c }))
          )}
        </div>
        <div>
          {lbl('category')}
          {sel(
            draft.category,
            v => setDraft(d => ({ ...d, category: v as Draft['category'] })),
            ZONES.map(z => ({ v: z, l: z }))
          )}
        </div>
      </div>
      <div>
        {lbl('care (케어 방법)')}
        <textarea
          value={draft.care}
          onChange={e => setDraft(d => ({ ...d, care: e.target.value }))}
          rows={4}
          style={{ ...inp, resize: 'vertical', minHeight: 88 }}
        />
      </div>
      <div>
        {lbl('quote (오렌 한마디)')}
        <textarea
          value={draft.quote}
          onChange={e => setDraft(d => ({ ...d, quote: e.target.value }))}
          rows={3}
          style={{ ...inp, resize: 'vertical', minHeight: 72 }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {lbl('is_active')}
        <button
          type="button"
          onClick={() => setDraft(d => ({ ...d, is_active: !d.is_active }))}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: draft.is_active ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.05)',
            color: draft.is_active ? '#a5e9a9' : 'var(--text3)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {draft.is_active ? '활성' : '비활성'}
        </button>
      </div>
      <div>
        {lbl('product_ids · 제품명 검색')}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={pq} onChange={e => setPq(e.target.value)} style={{ ...inp, flex: 1 }} placeholder="제품명…" />
        </div>
        {picks.length > 0 ? (
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              maxHeight: 160,
              overflowY: 'auto',
              marginBottom: 10,
            }}
          >
            {picks.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddProduct(p)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 11px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {(p as ProductPick & { clean_name?: string | null }).clean_name || p.name}
              </button>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {draft.product_ids.map(id => (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(123,94,167,0.2)',
                border: '1px solid rgba(123,94,167,0.35)',
                fontSize: 11,
              }}
            >
              {productMeta[id] || id.slice(0, 8)}
              <button
                type="button"
                onClick={() => onRemoveProduct(id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 14,
                  lineHeight: 1,
                }}
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid rgba(201,168,76,0.4)',
            background: 'rgba(201,168,76,0.18)',
            color: '#f0e6c8',
            fontWeight: 600,
            fontSize: 12,
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {!isNew && draft.id ? (
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid rgba(229,57,53,0.35)',
              background: 'rgba(229,57,53,0.1)',
              color: '#ffab91',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            삭제
          </button>
        ) : null}
      </div>
    </div>
  )
}
