'use client'
import type { CSSProperties } from 'react'
import ProductThumbnail from '@/components/ProductThumbnail'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
type Row = Record<string, unknown>
interface Props {
  rows: Row[]
  tab: 'pending' | 'active' | 'hidden'
  onTabChange: (t: 'pending' | 'active' | 'hidden') => void
  onEdit: (p: Row) => void
  onNew: () => void
}
function badge(p: Row) {
  const s = String(p.status || '')
  if (s === 'active') return { t: '판매중', bg: 'rgba(76,175,80,0.15)', color: '#4CAF50' }
  if (s === 'hidden' || s === 'discontinued') return { t: '숨김', bg: 'rgba(255,255,255,0.07)', color: SUB }
  return { t: '승인 대기', bg: 'rgba(255,193,7,0.15)', color: '#FFC107' }
}
export default function BrandTabProducts({ rows, tab, onTabChange, onEdit, onNew }: Props) {
  const counts = {
    pending: rows.filter(r => !['active','hidden','discontinued'].includes(String(r.status || ''))).length,
    active: rows.filter(r => r.status === 'active').length,
    hidden: rows.filter(r => r.status === 'hidden' || r.status === 'discontinued').length,
  }
  const filtered = rows.filter(r => {
    if (tab === 'active') return r.status === 'active'
    if (tab === 'hidden') return r.status === 'hidden' || r.status === 'discontinued'
    return !['active','hidden','discontinued'].includes(String(r.status || ''))
  })
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          type="button"
          onClick={onNew}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', cursor: 'pointer' }}
        >
          + 새 제품 등록
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {([{ key: 'pending', label: '승인 대기' }, { key: 'active', label: '판매중' }, { key: 'hidden', label: '숨김' }] as const).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: `0.5px solid ${tab === t.key ? PURPLE : 'rgba(255,255,255,0.1)'}`, background: tab === t.key ? 'rgba(123,94,167,0.2)' : 'transparent', color: tab === t.key ? '#c4a7e7' : SUB, cursor: 'pointer' }}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>
      <div style={CARD}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: SUB, fontSize: 13 }}>이 탭에 표시할 제품이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(p => {
              const b = badge(p)
              return (
                <div key={String(p.id)} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                    <ProductThumbnail src={typeof p.thumb_img === 'string' ? p.thumb_img : null} alt={String(p.name || '')} size={56} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: TEXT, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(p.name || '이름 없음')}</div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: b.bg, color: b.color }}>{b.t}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: SUB, cursor: 'pointer', flexShrink: 0 }}
                  >
                    수정
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
