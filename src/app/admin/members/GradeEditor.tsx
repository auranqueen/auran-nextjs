'use client'

import { useState } from 'react'
import { GRADES, type Member } from './types'

export function GradeEditor({ member, onSaved }: { member: Member; onSaved: (grade: string) => void }) {
  const [gradeEdit, setGradeEdit] = useState(member.customer_grade || 'PETAL')
  const [gradeSaved, setGradeSaved] = useState(false)

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>GRADE</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <select
          value={gradeEdit}
          onChange={e => setGradeEdit(e.target.value)}
          style={{
            fontSize: 12,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6,
            color: '#fff',
            padding: '2px 6px',
          }}
        >
          {GRADES.map(g => (
            <option key={g} value={g} style={{ background: '#1a1a2e' }}>
              {g}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={async () => {
            const res = await fetch('/api/admin/customer-grade', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ user_id: member.id, customer_grade: gradeEdit }),
            })
            const j = await res.json().catch(() => ({}))
            if (!res.ok || !j?.ok) {
              alert(
                j?.error === 'not_customer'
                  ? '고객(role=customer)만 변경할 수 있어요.'
                  : typeof j?.error === 'string'
                    ? j.error
                    : '등급 저장 실패'
              )
              return
            }
            onSaved(gradeEdit)
            setGradeSaved(true)
            setTimeout(() => setGradeSaved(false), 2000)
          }}
          style={{
            fontSize: 11,
            background: gradeSaved ? '#3b7a57' : '#7B5EA7',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            padding: '3px 10px',
            cursor: 'pointer',
          }}
        >
          {gradeSaved ? '적용완료 ✓' : '저장'}
        </button>
      </div>
    </div>
  )
}
