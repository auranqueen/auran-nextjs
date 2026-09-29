'use client'

import { useState } from 'react'
import MarketingModal from './MarketingModal'
import { useMembers } from './useMembers'
import { MemberListRow } from './MemberListRow'
import { MemberDetailModal } from './MemberDetailModal'

export default function AdminMembersPage() {
  const {
    members, filtered, loading, q, setQ, planList, approving,
    selected, setSelected, patchMember, suspend, activate, toggleFounder, approvePending,
  } = useMembers()
  const [showMarketing, setShowMarketing] = useState(false)

  return (
    <div style={{ padding: '18px 18px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>전체 회원</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>검색/상세/정지</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>총 {members.length}명</div>
          <button onClick={() => window.location.href = '/admin/membership/members'} style={{ padding: '8px 16px', background: 'rgba(123,94,167,0.2)', border: '1px solid rgba(123,94,167,0.5)', color: '#9B7EC8', borderRadius: 8, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            💜 멤버십 큐레이션 →
          </button>
          <button onClick={() => setShowMarketing(true)} style={{ padding: '5px 12px', background: 'rgba(201,169,110,0.15)', border: '0.5px solid rgba(201,169,110,0.4)', color: '#C9A96E', borderRadius: 16, fontSize: 11, cursor: 'pointer' }}>
            📊 마케팅
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="이름/이메일/역할 검색"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 16,
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.10)',
            color: '#fff',
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>검색 결과가 없습니다.</div>
        ) : (
          filtered.map(m => (
            <MemberListRow key={m.id} member={m} onSelect={setSelected} onToggleFounder={toggleFounder} />
          ))
        )}
      </div>

      {selected && (
        <MemberDetailModal
          key={selected.id}
          member={selected}
          planList={planList}
          approving={approving}
          onClose={() => setSelected(null)}
          onPatchMember={patchMember}
          onSuspend={suspend}
          onActivate={activate}
          onApprove={approvePending}
        />
      )}
      <MarketingModal open={showMarketing} onClose={() => setShowMarketing(false)} members={members} />
    </div>
  )
}
