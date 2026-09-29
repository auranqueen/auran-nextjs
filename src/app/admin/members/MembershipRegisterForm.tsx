'use client'

import { useState } from 'react'
import type { Plan } from './types'

export function MembershipRegisterForm({ memberId, planList }: { memberId: string; planList: Plan[] }) {
  const [showMembership, setShowMembership] = useState(false)
  const [mPlanId, setMPlanId] = useState('')
  const [mShipments, setMShipments] = useState(6)
  const [mDate, setMDate] = useState('')
  const [mMemo, setMMemo] = useState('')
  const [mBusy, setMBusy] = useState(false)
  const [mMsg, setMMsg] = useState('')

  const msgEl = mMsg ? <div style={{ fontSize: 12, color: mMsg.includes('완료') ? '#5B8A6B' : '#A33' }}>{mMsg}</div> : null

  const submit = async () => {
    if (!mPlanId || !mDate) { setMMsg('플랜과 배송일을 선택해주세요'); return }
    setMBusy(true); setMMsg('')
    try {
      const res = await fetch('/api/admin/membership/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: memberId, plan_id: mPlanId, shipments_total: mShipments, next_shipment_date: mDate, memo: mMemo || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (json.ok) { setMMsg('멤버십 등록 완료! 💜'); setShowMembership(false) }
      else { setMMsg(json.error || '실패했어요') }
    } catch {
      setMMsg('실패했어요')
    } finally {
      setMBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 14, borderTop: '0.5px solid rgba(123,94,167,0.12)', paddingTop: 14, gridColumn: '1 / -1' }}>
      <button
        onClick={() => { setShowMembership(!showMembership); setMMsg('') }}
        style={{ width: '100%', padding: '9px 0', background: showMembership ? '#7B5EA7' : 'transparent', border: '1px solid #7B5EA7', color: showMembership ? '#fff' : '#7B5EA7', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        {showMembership ? '닫기' : '+ 멤버십 등록'}
      </button>
      {!showMembership && msgEl && <div style={{ marginTop: 8 }}>{msgEl}</div>}
      {showMembership && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {planList.map(p => (
              <button key={p.id} onClick={() => setMPlanId(p.id)}
                style={{ padding: '6px 12px', borderRadius: 16, border: 'none', fontSize: 12, cursor: 'pointer', background: mPlanId === p.id ? '#7B5EA7' : 'rgba(123,94,167,0.12)', color: mPlanId === p.id ? '#fff' : '#7B5EA7', fontFamily: 'inherit' }}>
                {p.name} · ₩{p.price.toLocaleString()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[3, 6, 12].map(n => (
              <button key={n} onClick={() => setMShipments(n)}
                style={{ padding: '6px 14px', borderRadius: 16, border: 'none', fontSize: 12, cursor: 'pointer', background: mShipments === n ? '#7B5EA7' : 'rgba(123,94,167,0.12)', color: mShipments === n ? '#fff' : '#7B5EA7', fontFamily: 'inherit' }}>
                {n}회
              </button>
            ))}
          </div>
          <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.25)', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
          <input value={mMemo} onChange={e => setMMemo(e.target.value)} placeholder="메모 (예: 300만원 송금 확인)"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(123,94,167,0.25)', fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
          {msgEl}
          <button
            onClick={() => void submit()}
            disabled={mBusy}
            style={{ padding: '11px 0', background: mBusy ? '#C9BFD8' : '#7B5EA7', border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: mBusy ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            {mBusy ? '등록 중...' : '멤버십 등록하기'}
          </button>
        </div>
      )}
    </div>
  )
}
