'use client'

import type { Member, Plan } from '../types'
import { GradeEditor } from '../GradeEditor'
import { MembershipRegisterForm } from '../MembershipRegisterForm'

const card = { background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '12px 12px' } as const

type Props = {
  member: Member
  planList: Plan[]
  onGradeSaved: (grade: string) => void
}

export function SummaryTab({ member, planList, onGradeSaved }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={card}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>ROLE</div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: '#fff' }}>{member.role}</div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>POINTS</div>
        <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 900, color: '#c9a84c' }}>{(member.points || 0).toLocaleString()}P</div>
      </div>
      <div style={{ ...card, gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>STATUS</div>
        <div style={{ marginTop: 6, fontSize: 13, fontWeight: 900, color: '#fff' }}>{member.status}</div>
      </div>
      <GradeEditor member={member} onSaved={onGradeSaved} />
      <MembershipRegisterForm memberId={member.id} planList={planList} />
    </div>
  )
}
