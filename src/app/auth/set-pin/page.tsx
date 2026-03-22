'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const GOLD = '#c9a84c'

export default function SetPinPage() {
  const router = useRouter()
  const [step, setStep] = useState<'first' | 'confirm'>('first')
  const [firstPin, setFirstPin] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const addDigit = (d: string) => {
    if (pin.length >= 6) return
    setPin((p) => p + d)
    setError('')
  }
  const backspace = () => setPin((p) => p.slice(0, -1))

  const handleNext = useCallback(() => {
    if (pin.length !== 6) return
    setFirstPin(pin)
    setPin('')
    setStep('confirm')
    setError('')
  }, [pin])

  const handleSubmit = useCallback(async () => {
    if (pin.length !== 6) return
    if (pin !== firstPin) {
      setError('PIN이 일치하지 않습니다.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/pin/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장 실패')
      // 성공 시 바로 이동 (finally 재렌더 전에). 절대 경로 + href로 이동 확실히
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const target = origin ? `${origin}/home` : '/home'
      setTimeout(() => {
        window.location.href = target
      }, 0)
      return
    } catch (e: any) {
      setError(e?.message || '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [pin, firstPin, router])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => step === 'first' ? router.back() : setStep('first')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 18 }}>‹</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
        <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: '#fff', marginBottom: 8, textAlign: 'center' }}>
          {step === 'first' ? '결제 PIN 설정' : 'PIN 다시 입력'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24, textAlign: 'center' }}>
          {step === 'first'
            ? '충전·정산·계좌 변경 시 사용할 6자리 숫자를 입력해주세요.'
            : '동일한 PIN을 한 번 더 입력해주세요.'}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
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
        {error && <p style={{ fontSize: 12, color: '#e08080', marginBottom: 12, textAlign: 'center' }}>{error}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20, maxWidth: 260 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) =>
            key === '' ? <div key="empty" /> : key === '⌫' ? (
              <button key="back" type="button" onClick={backspace} style={{ padding: 14, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 18 }}>⌫</button>
            ) : (
              <button key={key} type="button" onClick={() => addDigit(key)} style={{ padding: 14, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, color: '#fff', fontSize: 18 }}>{key}</button>
            )
          )}
        </div>
        {step === 'first' ? (
          <button type="button" onClick={handleNext} disabled={pin.length !== 6} style={{ width: '100%', maxWidth: 280, padding: 14, background: pin.length === 6 ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: pin.length === 6 ? '#0a0a0a' : 'var(--text3)', fontWeight: 700 }}>
            다음
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={pin.length !== 6 || loading} style={{ width: '100%', maxWidth: 280, padding: 14, background: pin.length === 6 ? GOLD : 'var(--bg3)', border: 'none', borderRadius: 12, color: pin.length === 6 ? '#0a0a0a' : 'var(--text3)', fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
            {loading ? '저장 중...' : '설정 완료'}
          </button>
        )}
      </div>
    </div>
  )
}
