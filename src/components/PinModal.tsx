'use client'

import { useState, useCallback } from 'react'

const GOLD = '#c9a84c'

type PinModalProps = {
  title: string
  onConfirm: (pin: string) => Promise<void>
  onCancel: () => void
  error?: string
  lockedMinutes?: number
}

export default function PinModal({ title, onConfirm, onCancel, error, lockedMinutes }: PinModalProps) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(error || '')

  const submit = useCallback(async () => {
    if (pin.length !== 6) return
    setLoading(true)
    setErr('')
    try {
      await onConfirm(pin)
    } catch (e: any) {
      setErr(e?.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [pin, onConfirm])

  const addDigit = (d: string) => {
    if (pin.length >= 6) return
    setPin((p) => p + d)
    setErr('')
  }
  const backspace = () => setPin((p) => p.slice(0, -1))

  if (lockedMinutes != null && lockedMinutes > 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>🔒 PIN 잠금</div>
          <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 20 }}>
            비정상적인 시도가 감지되어 {lockedMinutes}분 후에 다시 시도해주세요.
          </p>
          <button onClick={onCancel} style={{ width: '100%', padding: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }}>
            닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, maxWidth: 320, width: '100%', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{title}</div>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>결제 PIN 6자리를 입력해주세요.</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                width: 36,
                height: 44,
                borderRadius: 8,
                border: '2px solid ' + (pin.length > i ? GOLD : 'var(--border)'),
                background: 'var(--bg3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: '#fff',
              }}
            >
              {pin.length > i ? '•' : ''}
            </div>
          ))}
        </div>
        {(err || error) && <p style={{ fontSize: 12, color: '#e08080', marginBottom: 12, textAlign: 'center' }}>{err || error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) =>
            key === '' ? (
              <div key="empty" />
            ) : key === '⌫' ? (
              <button key="back" type="button" onClick={backspace} style={{ padding: 14, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 18 }}>
                ⌫
              </button>
            ) : (
              <button key={key} type="button" onClick={() => addDigit(key)} style={{ padding: 14, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: '#fff', fontSize: 18 }}>
                {key}
              </button>
            )
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, padding: 12, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)' }}>
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pin.length !== 6 || loading}
            style={{ flex: 1, padding: 12, background: pin.length === 6 ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 10, color: pin.length === 6 ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '확인 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}
