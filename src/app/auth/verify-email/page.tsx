'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function VerifyEmailInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const role = searchParams.get('role') || 'customer'
  const supabase = createClient()
  const [resending, setResending] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [error, setError] = useState('')

  async function handleResend() {
    if (!email.trim()) return
    setResending(true)
    setError('')
    setResendDone(false)
    try {
      const { error: err } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
      if (err) throw err
      setResendDone(true)
    } catch (e: any) {
      setError(e.message || '재발송에 실패했습니다.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: 24 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: 'var(--text)', marginBottom: 12 }}>
          이메일 인증을 완료해주세요
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 24, maxWidth: 320 }}>
          가입하신 이메일로 인증 링크를 보냈어요. 메일함을 확인해주세요.
          <br />(인증 링크 유효시간: 24시간)
        </p>
        {email && (
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24, wordBreak: 'break-all' }}>{email}</p>
        )}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          style={{
            padding: '14px 24px',
            background: 'rgba(201,168,76,0.15)',
            border: '1px solid rgba(201,168,76,0.4)',
            borderRadius: 12,
            color: '#c9a84c',
            fontSize: 14,
            fontWeight: 600,
            opacity: resending ? 0.7 : 1,
          }}
        >
          {resending ? '발송 중...' : resendDone ? '인증 메일 다시 보냈어요' : '인증 메일 다시 보내기'}
        </button>
        {error && <p style={{ marginTop: 12, fontSize: 12, color: '#e08080' }}>{error}</p>}
      </div>
      <button
        type="button"
        onClick={() => router.push(`/login?role=${role}`)}
        style={{
          width: '100%',
          padding: 14,
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          color: 'var(--text3)',
          fontSize: 14,
        }}
      >
        로그인 화면으로
      </button>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>로딩 중...</div>}>
      <VerifyEmailInner />
    </Suspense>
  )
}
