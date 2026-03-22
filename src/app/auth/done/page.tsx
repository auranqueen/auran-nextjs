'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { normalizePosition, positionToDashboardPath, POSITION_STORAGE_KEY } from '@/lib/position'
import { createClient } from '@/lib/supabase/client'

function AuthDoneInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const [phase, setPhase] = useState<'loading' | 'phone' | 'redirect'>('loading')
  const [phoneInput, setPhoneInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    ;(async () => {
      let { data } = await supabase.auth.getSession()
      if (!data.session?.user) {
        // 세션 동기화 지연 대응 - 1초 후 재시도
        await new Promise(r => setTimeout(r, 1000))
        const { data: retry } = await supabase.auth.getSession()
        if (!retry.session?.user) {
          const fromQuery = normalizePosition(params.get('position'))
          const position = fromQuery || 'customer'
          router.replace(positionToDashboardPath(position))
          return
        }
        data = retry
      }
      const { data: row } = await supabase.from('users').select('phone').eq('auth_id', data.session!.user.id).maybeSingle()
      const p = String(row?.phone || '').replace(/\D/g, '')
      if (p.length >= 10) {
        setPhase('redirect')
        const fromQuery = normalizePosition(params.get('position'))
        const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
        const position = fromQuery || stored || 'customer'
        localStorage.setItem(POSITION_STORAGE_KEY, position)
        const redirect = params.get('redirect')
        const safeRedirect = redirect && redirect.startsWith('/') ? redirect : null
        router.replace(safeRedirect || positionToDashboardPath(position))
        return
      }
      setPhase('phone')
    })()
  }, [params, router, supabase])

  const goDashboard = () => {
    const fromQuery = normalizePosition(params.get('position'))
    const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
    const position = fromQuery || stored || 'customer'
    localStorage.setItem(POSITION_STORAGE_KEY, position)
    const redirect = params.get('redirect')
    const safeRedirect = redirect && redirect.startsWith('/') ? redirect : null
    router.replace(safeRedirect || positionToDashboardPath(position))
  }

  const savePhone = async () => {
    const digits = phoneInput.replace(/\D/g, '')
    if (digits.length < 10) {
      setHint('휴대폰 번호를 확인해 주세요')
      return
    }
    setSaving(true)
    setHint('')
    const res = await fetch('/api/auth/complete-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ phone: digits }),
    })
    const j = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok || !j?.ok) {
      setHint(j?.error || '저장에 실패했어요')
      return
    }
    goDashboard()
  }

  if (phase === 'loading' || phase === 'redirect') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
        로그인 처리 중...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 8, textAlign: 'center' }}>혜택 알림을 받을 휴대폰 번호</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, textAlign: 'center', lineHeight: 1.5 }}>
        가입 완료 알림·쿠폰 안내를 보내드려요. 번호는 계정에 안전하게 저장됩니다.
      </div>
      <input
        type="tel"
        inputMode="tel"
        placeholder="01012345678"
        value={phoneInput}
        onChange={(e) => setPhoneInput(e.target.value)}
        style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 16, marginBottom: 12 }}
      />
      {hint && <div style={{ color: '#e57373', fontSize: 12, marginBottom: 12 }}>{hint}</div>}
      <button
        type="button"
        disabled={saving}
        onClick={savePhone}
        style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900, marginBottom: 10 }}
      >
        {saving ? '저장 중...' : '저장하고 시작하기'}
      </button>
      <button
        type="button"
        onClick={goDashboard}
        style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'var(--text3)', fontWeight: 800 }}>
        나중에 입력하기
      </button>
    </div>
  )
}

export default function AuthDonePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>로그인 처리 중...</div>}>
      <AuthDoneInner />
    </Suspense>
  )
}
