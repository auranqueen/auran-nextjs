'use client'

import { useState } from 'react'
import type { Member } from './types'

type Props = {
  member: Member
  onDone: (amount: number) => void
  onCancel: () => void
}

export function ToastAdjustPanel({ member, onDone, onCancel }: Props) {
  const [toastAdjustAmount, setToastAdjustAmount] = useState('')
  const [toastAdjustNote, setToastAdjustNote] = useState('')
  const [toastAdjustSubmitting, setToastAdjustSubmitting] = useState(false)
  const [toastAdjustMsg, setToastAdjustMsg] = useState('')

  const submit = async () => {
    if (toastAdjustSubmitting) return
    const amt = Number(toastAdjustAmount)
    if (!Number.isFinite(amt) || amt === 0) {
      setToastAdjustMsg('금액을 확인해주세요')
      return
    }
    setToastAdjustSubmitting(true)
    setToastAdjustMsg('')
    try {
      const res = await fetch('/api/admin/toast/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_user_id: member.id,
          amount: amt,
          note: toastAdjustNote.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) throw new Error(json?.error || '처리 실패')
      setToastAdjustMsg('완료')
      onDone(amt)
    } catch (e: any) {
      setToastAdjustMsg(e?.message || '처리 실패')
    } finally {
      setToastAdjustSubmitting(false)
    }
  }

  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.25)' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>금액 (양수=지급 / 음수=차감)</div>
      <input
        type="number"
        value={toastAdjustAmount}
        onChange={e => setToastAdjustAmount(e.target.value)}
        placeholder="예) 1000 또는 -500"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.07)', background: '#161b24', color: '#eef1f6', fontSize: 12, marginBottom: 10 }}
      />
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>사유</div>
      <textarea
        value={toastAdjustNote}
        onChange={e => setToastAdjustNote(e.target.value)}
        rows={3}
        placeholder="지급/차감 사유"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.07)', background: '#161b24', color: '#eef1f6', fontSize: 12, resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="btn btn-gd"
          disabled={toastAdjustSubmitting || !toastAdjustNote.trim()}
          onClick={() => void submit()}
        >
          {toastAdjustSubmitting ? '처리 중…' : '확인'}
        </button>
        <button
          type="button"
          className="btn btn-gy"
          disabled={toastAdjustSubmitting}
          onClick={onCancel}
        >
          취소
        </button>
      </div>
      {toastAdjustMsg ? (
        <div style={{ marginTop: 8, fontSize: 12, color: toastAdjustMsg === '완료' ? '#4cad7e' : '#d94f4f' }}>
          {toastAdjustMsg}
        </div>
      ) : null}
    </div>
  )
}
