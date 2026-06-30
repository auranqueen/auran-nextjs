'use client'

import { useState } from 'react'

const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.85)'
const SUB = 'rgba(255,255,255,0.4)'
const BORDER = 'rgba(255,255,255,0.08)'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  color: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  marginBottom: 8,
}

export default function FindAccountModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'id' | 'pw'>('id')
  const [idPhone, setIdPhone] = useState('')
  const [idStep, setIdStep] = useState<'phone' | 'code' | 'done'>('phone')
  const [idCode, setIdCode] = useState('')
  const [foundId, setFoundId] = useState('')
  const [pwUserId, setPwUserId] = useState('')
  const [pwPhone, setPwPhone] = useState('')
  const [pwStep, setPwStep] = useState<'info' | 'code' | 'reset' | 'done'>('info')
  const [pwCode, setPwCode] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendIdCode = async () => {
    setError('')
    if (!idPhone.trim()) { setError('휴대폰 번호를 입력해주세요'); return }
    setLoading(true)
    const res = await fetch('/api/auth/find-id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: idPhone, step: 'send' }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || '오류가 발생했어요'); return }
    setIdStep('code')
  }

  const verifyIdCode = async () => {
    setError('')
    if (!idCode.trim()) { setError('인증번호를 입력해주세요'); return }
    setLoading(true)
    const res = await fetch('/api/auth/find-id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: idPhone, step: 'verify', code: idCode }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || '오류가 발생했어요'); return }
    setFoundId(json.userId)
    setIdStep('done')
  }

  const sendPwCode = async () => {
    setError('')
    if (!pwUserId.trim() || !pwPhone.trim()) { setError('아이디와 휴대폰 번호를 입력해주세요'); return }
    setLoading(true)
    const res = await fetch('/api/auth/find-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pwUserId, phone: pwPhone, step: 'send' }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || '오류가 발생했어요'); return }
    setPwStep('code')
  }

  const verifyPwCode = async () => {
    setError('')
    if (!pwCode.trim()) { setError('인증번호를 입력해주세요'); return }
    setLoading(true)
    const res = await fetch('/api/auth/find-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: pwPhone, step: 'verify', code: pwCode }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || '오류가 발생했어요'); return }
    setPwStep('reset')
  }

  const resetPw = async () => {
    setError('')
    if (newPw.length < 6) { setError('비밀번호는 6자 이상이어야 해요'); return }
    if (newPw !== newPw2) { setError('비밀번호가 일치하지 않아요'); return }
    setLoading(true)
    const res = await fetch('/api/auth/find-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pwUserId, phone: pwPhone, step: 'reset', newPassword: newPw }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error || '오류가 발생했어요'); return }
    setPwStep('done')
  }

  return (
    <div style={{ marginTop: 12, padding: '14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => { setTab('id'); setError('') }}
            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: tab === 'id' ? 'rgba(123,94,167,0.25)' : 'transparent', color: tab === 'id' ? '#c4a8f0' : SUB }}>
            아이디 찾기
          </button>
          <button type="button" onClick={() => { setTab('pw'); setError('') }}
            style={{ padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: tab === 'pw' ? 'rgba(123,94,167,0.25)' : 'transparent', color: tab === 'pw' ? '#c4a8f0' : SUB }}>
            비밀번호 찾기
          </button>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: SUB, fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>

      {error && (
        <div style={{ background: 'rgba(229,57,53,0.08)', border: '0.5px solid rgba(229,57,53,0.3)', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#E53935', marginBottom: 10 }}>
          {error}
        </div>
      )}

      {tab === 'id' && (
        <>
          {idStep === 'phone' && (
            <>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>휴대폰 번호를 입력하면 인증 후 아이디를 알려드려요</div>
              <input value={idPhone} onChange={e => setIdPhone(e.target.value)} placeholder="01012345678" style={INPUT_STYLE} />
              <button type="button" onClick={sendIdCode} disabled={loading}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? '발송 중...' : '인증번호 받기'}
              </button>
            </>
          )}
          {idStep === 'code' && (
            <>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>인증번호 6자리를 입력해주세요</div>
              <input value={idCode} onChange={e => setIdCode(e.target.value)} placeholder="123456" style={INPUT_STYLE} />
              <button type="button" onClick={verifyIdCode} disabled={loading}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? '확인 중...' : '확인'}
              </button>
            </>
          )}
          {idStep === 'done' && (
            <div style={{ textAlign: 'center', padding: '6px 0' }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>회원님의 아이디는</div>
              <div style={{ fontSize: 16, color: '#c4a8f0', fontWeight: 600 }}>{foundId}</div>
            </div>
          )}
        </>
      )}

      {tab === 'pw' && (
        <>
          {pwStep === 'info' && (
            <>
              <input value={pwUserId} onChange={e => setPwUserId(e.target.value)} placeholder="아이디 입력" style={INPUT_STYLE} />
              <input value={pwPhone} onChange={e => setPwPhone(e.target.value)} placeholder="휴대폰 번호" style={INPUT_STYLE} />
              <button type="button" onClick={sendPwCode} disabled={loading}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? '발송 중...' : '인증번호 받기'}
              </button>
            </>
          )}
          {pwStep === 'code' && (
            <>
              <input value={pwCode} onChange={e => setPwCode(e.target.value)} placeholder="인증번호 6자리" style={INPUT_STYLE} />
              <button type="button" onClick={verifyPwCode} disabled={loading}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? '확인 중...' : '확인'}
              </button>
            </>
          )}
          {pwStep === 'reset' && (
            <>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)" style={INPUT_STYLE} />
              <input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} placeholder="새 비밀번호 확인" style={INPUT_STYLE} />
              <button type="button" onClick={resetPw} disabled={loading}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: PURPLE, color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </>
          )}
          {pwStep === 'done' && (
            <div style={{ fontSize: 12, color: '#a78bfa', textAlign: 'center', lineHeight: 1.6 }}>
              비밀번호가 변경됐어요!<br/>새 비밀번호로 로그인해주세요 💜
            </div>
          )}
        </>
      )}
    </div>
  )
}
