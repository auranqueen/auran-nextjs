'use client'

import type { Member } from './types'

type Props = {
  member: Member
  onSelect: (m: Member) => void
  onToggleFounder: (m: Member) => void
}

export function MemberListRow({ member: m, onSelect, onToggleFounder }: Props) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(m)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(m)
        }
      }}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: '12px 14px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.name || m.email?.split('@')[0] || '이름 없음'} <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>({m.role})</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: "'JetBrains Mono', monospace", marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {m.email}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void onToggleFounder(m)
          }}
          style={{
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 999,
            border: m.is_founder ? '1px solid rgba(201,169,110,0.55)' : '1px solid rgba(255,255,255,0.12)',
            background: m.is_founder ? 'rgba(201,169,110,0.2)' : 'rgba(255,255,255,0.04)',
            color: m.is_founder ? '#C9A96E' : 'rgba(255,255,255,0.38)',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          {m.is_founder ? '👑 Founders' : '미부여'}
        </button>
        {m.customer_grade && (
          <span style={{ fontSize: 11, background: 'rgba(123,94,167,0.2)', color: '#C084FC', padding: '2px 8px', borderRadius: 20, marginLeft: 4 }}>
            {m.customer_grade}
          </span>
        )}
        <div style={{ fontSize: 10, padding: '4px 8px', borderRadius: 999, background: m.status === 'suspended' ? 'rgba(217,79,79,0.12)' : 'rgba(76,173,126,0.12)', border: '1px solid rgba(255,255,255,0.10)', color: m.status === 'suspended' ? '#d94f4f' : '#4cad7e', fontWeight: 900 }}>
          {m.status}
        </div>
      </div>
    </div>
  )
}
