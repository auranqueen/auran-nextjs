'use client'
import { useState } from 'react'

const C = { purple: '#7B5EA7', gold: '#C9A96E', green: '#5B8A6B', red: '#dc5050' }

type Buyer = { id: string; name: string; phone: string | null; auran_joined: boolean; auran_user_id?: string | null }

export default function BuyerBroadcastModal({
  selectedBuyerIds,
  buyers,
  onClose,
}: {
  selectedBuyerIds: string[]
  buyers: Buyer[]
  onClose: () => void
}) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; noChannel: number } | null>(null)

  const targets = buyers.filter((b) => selectedBuyerIds.includes(b.id))
  const joinedCount = targets.filter((b) => b.auran_joined).length
  const smsCount = targets.length - joinedCount

  const send = async () => {
    if (!message.trim() || sending || selectedBuyerIds.length === 0) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/marketing/broadcast-to-buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerIds: selectedBuyerIds, message: message.trim() }),
      })
      const json = await res.json().catch(() => null)
      if (json?.ok) {
        setResult({ success: json.success || 0, failed: json.failed || 0, noChannel: json.noChannel || 0 })
      } else {
        setResult({ success: 0, failed: selectedBuyerIds.length, noChannel: 0 })
      }
    } catch {
      setResult({ success: 0, failed: selectedBuyerIds.length, noChannel: 0 })
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: 380, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', background: '#1a1830', border: '0.5px solid rgba(123,94,167,0.4)', borderRadius: 16, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', color: '#8A7E92', fontSize: 22, lineHeight: 1, cursor: 'pointer', minWidth: 32, minHeight: 32 }}
        >
          ×
        </button>

        <div style={{ fontSize: 14, fontWeight: 700, color: '#e8e0f5', marginBottom: 4 }}>선택 고객 즉석 발송</div>
        <div style={{ fontSize: 11, color: '#8A7E92', marginBottom: 14 }}>
          선택 {targets.length}명 · 가입 {joinedCount}명(알림) · 미가입 {smsCount}명(문자)
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="보낼 메시지를 입력하세요"
          rows={5}
          disabled={sending}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e8e0f5', fontSize: 12, padding: '10px', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
        />

        <button
          type="button"
          onClick={send}
          disabled={sending || !message.trim() || selectedBuyerIds.length === 0}
          style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 9, border: 'none', background: sending || !message.trim() || selectedBuyerIds.length === 0 ? 'rgba(123,94,167,0.3)' : C.purple, color: '#fff', fontSize: 13, fontWeight: 600, cursor: sending || !message.trim() ? 'default' : 'pointer' }}
        >
          {sending ? '발송 중…' : `${selectedBuyerIds.length}명에게 발송`}
        </button>

        {result && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#8A7E92' }}>성공</span>
              <span style={{ color: C.green, fontWeight: 600 }}>{result.success}건</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#8A7E92' }}>실패</span>
              <span style={{ color: C.red, fontWeight: 600 }}>{result.failed}건</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#8A7E92' }}>채널없음(미발송)</span>
              <span style={{ color: C.gold, fontWeight: 600 }}>{result.noChannel}건</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
