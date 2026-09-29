'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Member } from './types'

type Props = {
  member: Member
  onClose: () => void
  onGranted: (balance: number, row: any) => void
}

export function PointGrantModal({ member, onClose, onGranted }: Props) {
  const supabase = createClient()
  const [pointAmount, setPointAmount] = useState('')
  const [pointReason, setPointReason] = useState('관리자 수동 지급')
  const [pointSaving, setPointSaving] = useState(false)

  const grantPoints = async () => {
    const amt = Number(pointAmount)
    if (!amt || !Number.isFinite(amt)) {
      alert('지급 포인트를 입력해주세요.')
      return
    }
    setPointSaving(true)
    try {
      const res = await fetch('/api/admin/point-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ user_id: member.id, amount: amt, reason: pointReason })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.message || '포인트 지급 실패')
      const nextBalance = result.balance_after
      const now = new Date().toISOString()
      onGranted(nextBalance, { id: `local_${now}`, type: 'admin', amount: amt, balance: nextBalance, description: pointReason, created_at: now })
    } catch (e: any) {
      alert(e?.message || '포인트 지급 중 오류가 발생했습니다.')
    } finally {
      setPointSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0f1218', border: '1px solid rgba(255,255,255,0.13)', borderTop: '2px solid #c9a84c', borderRadius: 14, padding: 26, minWidth: 360, maxWidth: 520, width: '92%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#eef1f6' }}>✨ 포인트 지급</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{member.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 19, cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>지급 포인트 (P)</div>
          <input
            value={pointAmount}
            onChange={e => setPointAmount(e.target.value)}
            placeholder="예) 1000"
            type="number"
            style={{ width: '100%', background: '#161b24', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, color: '#eef1f6', fontSize: 12, padding: '8px 11px', outline: 'none', fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>지급 사유</div>
          <select
            value={pointReason}
            onChange={e => setPointReason(e.target.value)}
            style={{ width: '100%', background: '#161b24', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 7, color: '#eef1f6', fontSize: 12, padding: '8px 11px', outline: 'none' }}
          >
            <option>관리자 수동 지급</option>
            <option>이벤트 보상</option>
            <option>오류 보상</option>
            <option>구매 적립 수동</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button className="btn btn-gy" onClick={onClose}>취소</button>
          <button className="btn btn-gd" onClick={grantPoints} disabled={pointSaving} style={{ opacity: pointSaving ? 0.7 : 1 }}>
            {pointSaving ? '지급 중...' : '✨ 지급'}
          </button>
        </div>
      </div>
    </div>
  )
}
