'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function PendingApprovalInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const role = params.get('role') || 'partner'
  const meta = useMemo(() => {
    if (role === 'owner' || role === 'salon') return { label: '원장님', icon: '✨' }
    if (role === 'brand') return { label: '브랜드사', icon: '🧴' }
    return { label: '파트너스', icon: '💎' }
  }, [role])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', padding: 24 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{meta.icon}</div>
        <h1 style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: 'var(--text)', marginBottom: 10 }}>
          {meta.label} 승인 대기 중입니다
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.7, maxWidth: 360 }}>
          파트너스/원장님/브랜드사 계정은 본사 어드민 승인 후 이용할 수 있어요.
          <br />
          승인 완료 후 다시 로그인해주세요.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={async () => {
            setSending(true)
            setError('')
            setSent(false)
            try {
              const res = await fetch('/api/auth/request-approval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role }),
              })
              const json = await res.json().catch(() => ({}))
              if (!json?.ok) throw new Error(json?.error || json?.reason || 'failed')
              setSent(true)
            } catch (e: any) {
              setError(e?.message || '요청 전송에 실패했습니다.')
            } finally {
              setSending(false)
            }
          }}
          disabled={sending}
          style={{
            width: '100%',
            padding: 14,
            background: 'rgba(201,168,76,0.14)',
            border: '1px solid rgba(201,168,76,0.30)',
            borderRadius: 12,
            color: '#c9a84c',
            fontSize: 14,
            fontWeight: 800,
            opacity: sending ? 0.7 : 1,
          }}
        >
          {sending ? '요청 전송 중...' : sent ? '✅ 승인 요청을 다시 보냈어요' : '✅ 승인 요청 다시 보내기'}
        </button>
        {error && <div style={{ fontSize: 12, color: '#e08080', textAlign: 'center' }}>{error}</div>}
        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
          style={{
            width: '100%',
            padding: 14,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          로그아웃
        </button>
        <button
          type="button"
          onClick={() => router.replace('/')}
          style={{
            width: '100%',
            padding: 14,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            color: 'var(--text3)',
            fontSize: 14,
          }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}

export default function PendingApprovalPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>로딩 중...</div>}>
      <PendingApprovalInner />
    </Suspense>
  )
}

