'use client'

import React from 'react'
import { useState } from 'react'
import type { Plan } from './types'
import { C, SERIF } from './types'

export function ManualRegisterPanel({ plans, onRegistered }: {
  plans: Plan[]
  onClose?: () => void
  onRegistered?: () => void
}) {
  const [mSearch, setMSearch] = useState('')
  const [mUsers, setMUsers] = useState<{ id: string; name: string; email: string; shipments_remaining?: number; shipments_total?: number; status?: string }[]>([])
  const [mUserId, setMUserId] = useState('')
  const [mUserName, setMUserName] = useState('')
  const [mPlanId, setMPlanId] = useState('')
  const [mShipments, setMShipments] = useState(6)
  const [mDate, setMDate] = useState('')
  const [mMemo, setMMemo] = useState('')
  const [mBusy, setMBusy] = useState(false)
  const [mMsg, setMMsg] = useState('')

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 12, cursor: 'pointer', color: active ? '#fff' : C.muted,
    background: active ? C.purple : '#fff', border: active ? 'none' : `0.5px solid rgba(123,94,167,0.22)`,
    borderRadius: 17, padding: '6px 13px', fontFamily: 'inherit',
  })

  // 수동 등록
  const searchUsers = async (q: string) => {
    if (q.length < 2) { setMUsers([]); return }
    const res = await fetch('/api/admin/membership/manual?q=' + encodeURIComponent(q))
    const json = await res.json()
    setMUsers(json.users || [])
  }

  const registerManual = async () => {
    if (!mUserId || !mPlanId || !mDate) { setMMsg('고객·플랜·배송일을 모두 입력해주세요'); return }
    setMBusy(true); setMMsg('')
    const res = await fetch('/api/admin/membership/manual', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: mUserId, plan_id: mPlanId, shipments_total: mShipments, next_shipment_date: mDate, memo: mMemo || undefined, user_name: mUserName || undefined }),
    })
    const json = await res.json()
    setMBusy(false)
    if (json.ok) { setMMsg('등록 완료! 💜'); setMUserId(''); setMUserName(''); setMPlanId(''); setMDate(''); setMMemo(''); setMSearch(''); setMUsers([]); onRegistered?.() }
    else { setMMsg(json.error || '실패했어요') }
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: C.ink, marginBottom: 12 }}>수동 멤버십 등록</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>고객 검색</div>
          <input value={mSearch} onChange={e => { setMSearch(e.target.value); void searchUsers(e.target.value) }}
            placeholder="이름 또는 이메일 2자 이상"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
          {mUsers.length > 0 && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
              {mUsers.map(u => (
                <div key={u.id} onClick={() => { setMUserId(u.id); setMUserName(u.name || ''); setMSearch(u.email); setMUsers([]) }}
                  style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: `0.5px solid ${C.line}`, background: mUserId === u.id ? C.purpleSoft : '#fff', color: '#111' }}>
                  {u.name || '(이름없음)'} · {u.email}
                  {u.shipments_remaining != null ? ` · 남은 ${u.shipments_remaining}회` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
        {mUserId && (
          <input value={mUserName} onChange={e => setMUserName(e.target.value)} placeholder="이름 확인/수정"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
        )}
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>플랜</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {plans.map(p => <button key={p.id} onClick={() => setMPlanId(p.id)} style={pill(mPlanId === p.id)}>{p.name} · ₩{p.price.toLocaleString()}</button>)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>배송 횟수</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[3, 6, 12].map(n => <button key={n} onClick={() => setMShipments(n)} style={pill(mShipments === n)}>{n}회</button>)}
          </div>
        </div>
        <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
        <input value={mMemo} onChange={e => setMMemo(e.target.value)} placeholder="메모 (예: 300만원 송금 확인)"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: 'inherit', outline: 'none', color: '#111', background: '#fff' }}/>
        {mMsg && <div style={{ fontSize: 12, color: mMsg.includes('완료') ? C.green : '#A33' }}>{mMsg}</div>}
        <button onClick={registerManual} disabled={mBusy}
          style={{ padding: 12, background: mBusy ? '#C9BFD8' : C.purple, border: 'none', color: '#fff', borderRadius: 9, fontSize: 13, cursor: mBusy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {mBusy ? '등록 중...' : '멤버십 등록하기'}
        </button>
      </div>
    </div>
  )
}
