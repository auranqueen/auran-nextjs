'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { normalizePosition, positionToDashboardPath, POSITION_STORAGE_KEY } from '@/lib/position'
import { createClient } from '@/lib/supabase/client'
import { setStoredTheme } from '@/lib/theme'
import Loading from '@/app/loading'

function AuthDoneInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const [phase, setPhase] = useState<'loading' | 'phone' | 'redirect' | 'theme'>('loading')
  const [phoneInput, setPhoneInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [hint, setHint] = useState('')
  const [sessionUserCreatedAt, setSessionUserCreatedAt] = useState<string | null>(null)

  const navigateDashboard = () => {
    const fromQuery = normalizePosition(params.get('position'))
    const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
    const position = fromQuery || stored || 'customer'
    localStorage.setItem(POSITION_STORAGE_KEY, position)
    const redirect = params.get('redirect')
    const safeRedirect = redirect && redirect.startsWith('/') ? redirect : null
    const savedReturnUrl = localStorage.getItem('returnUrl')
    const safeSavedReturnUrl = savedReturnUrl && savedReturnUrl.startsWith('/') ? savedReturnUrl : null
    if (safeSavedReturnUrl) localStorage.removeItem('returnUrl')
    router.replace(safeSavedReturnUrl || safeRedirect || positionToDashboardPath(position))
  }

  const goDashboard = () => {
    try {
      if (sessionUserCreatedAt && localStorage.getItem('auran_theme_onboarded') !== '1') {
        const age = Date.now() - new Date(sessionUserCreatedAt).getTime()
        if (age >= 0 && age < 10 * 60 * 1000) {
          setPhase('theme')
          return
        }
      }
    } catch {
      /* ignore */
    }
    navigateDashboard()
  }

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
      const createdAt = data.session!.user.created_at
      try {
        await supabase.from('profiles').upsert(
          { auth_id: data.session!.user.id, email: data.session!.user.email ?? '' },
          { onConflict: 'auth_id' }
        )
      } catch (e) { console.error('profiles upsert error:', e) }
      try {
        const _user = data.session!.user
        const _provider = _user.app_metadata?.provider || 'email'
        const _kakaoIdentity = _user.identities?.find((i: any) => i.provider === 'kakao')
        const _kakaoId = _kakaoIdentity?.identity_data?.id
          ? String(_kakaoIdentity.identity_data.id)
          : _kakaoIdentity?.id ? String(_kakaoIdentity.id) : null
        const _email = _user.email ||
          (_provider === 'kakao' && _kakaoId ? `kakao-${_kakaoId}@no-email.auran` : null) ||
          `${_user.id}@no-email.auran`
        const { error: _usersErr } = await supabase.from('users').upsert(
          { auth_id: _user.id, email: _email },
          { onConflict: 'auth_id' }
        )
        console.log('users upsert result:', _usersErr ? _usersErr : 'success', 'email:', _email)
      } catch (e) { console.error('users upsert error:', e) }
      // localStorage에서 research_consent 읽어서 profiles 저장
      try {
        const rc = localStorage.getItem('auran_research_consent')
        if (rc !== null) {
          await supabase.from('profiles').upsert(
            { auth_id: data.session!.user.id, research_consent: rc === 'true' },
            { onConflict: 'auth_id' }
          )
          localStorage.removeItem('auran_research_consent')
        }
      } catch {}
      // localStorage에서 hormone 데이터 읽어서 hormone_cycle 저장
      try {
        const cycleType = localStorage.getItem('auran_cycle_type')
        const track = localStorage.getItem('auran_track')
        const cycleLength = localStorage.getItem('auran_cycle_length')
        const lastPeriod = localStorage.getItem('auran_last_period')
        if (cycleType && track) {
          const payload: any = {
            auth_id: data.session!.user.id,
            cycle_type: cycleType,
            track,
            cycle_length: cycleLength ? parseInt(cycleLength) : 28,
            last_period_date: lastPeriod || null,
          }
          await supabase.from('hormone_cycle').upsert(payload, { onConflict: 'auth_id' })
          localStorage.removeItem('auran_cycle_type')
          localStorage.removeItem('auran_track')
          localStorage.removeItem('auran_cycle_length')
          localStorage.removeItem('auran_last_period')
        }
      } catch {}
      // localStorage에서 birth_date/gender/skin_type 읽어서 profiles 저장
      try {
        const birthDate = localStorage.getItem('auran_birth_date')
        const gender = localStorage.getItem('auran_gender')
        const skinType = localStorage.getItem('auran_skin_type')
        if (birthDate || gender || skinType) {
          await supabase.from('profiles').upsert(
            {
              auth_id: data.session!.user.id,
              ...(birthDate ? { birth_date: birthDate } : {}),
              ...(gender ? { gender } : {}),
              ...(skinType ? { skin_type: skinType } : {}),
            },
            { onConflict: 'auth_id' }
          )
          if (birthDate) localStorage.removeItem('auran_birth_date')
          if (gender) localStorage.removeItem('auran_gender')
          if (skinType) localStorage.removeItem('auran_skin_type')
        }
      } catch {}
      setSessionUserCreatedAt(createdAt)
      const { data: row } = await supabase.from('users').select('phone').eq('auth_id', data.session!.user.id).maybeSingle()
      const p = String(row?.phone || '').replace(/\D/g, '')
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('onboarding_done')
        .eq('auth_id', data.session!.user.id)
        .maybeSingle()
      console.log('profileRow:', profileRow)
      console.log('onboarding_done:', profileRow?.onboarding_done)
      if (profileRow?.onboarding_done !== true) {
        router.replace('/signup/consent')
        return
      }
      if (p.length >= 10) {
        let onboarded = false
        try {
          onboarded = localStorage.getItem('auran_theme_onboarded') === '1'
        } catch {
          onboarded = true
        }
        const age = Date.now() - new Date(createdAt).getTime()
        const isNewSignup = age >= 0 && age < 10 * 60 * 1000
        if (isNewSignup && !onboarded) {
          setPhase('theme')
          return
        }
        setPhase('redirect')
        navigateDashboard()
        return
      }
      setPhase('phone')
    })()
  }, [params, router])

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

  const pickThemeAndContinue = (t: 'dark' | 'light') => {
    setStoredTheme(t)
    try {
      localStorage.setItem('auran_theme_onboarded', '1')
    } catch {
      /* ignore */
    }
    setPhase('redirect')
    navigateDashboard()
  }

  if (phase === 'theme') {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 10, textAlign: 'center' }}>테마 선택</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 22, textAlign: 'center', lineHeight: 1.5 }}>
          화면 테마를 선택해 주세요.
        </div>
        <button
          type="button"
          onClick={() => pickThemeAndContinue('dark')}
          style={{
            width: '100%',
            maxWidth: 320,
            padding: 14,
            marginBottom: 10,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg3)',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          다크 모드
        </button>
        <button
          type="button"
          onClick={() => pickThemeAndContinue('light')}
          style={{
            width: '100%',
            maxWidth: 320,
            padding: 14,
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'var(--bg2)',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          라이트 모드
        </button>
      </div>
    )
  }

  if (phase === 'loading' || phase === 'redirect') {
    return <Loading />
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
    <Suspense fallback={<Loading />}>
      <AuthDoneInner />
    </Suspense>
  )
}
