'use client'
import FindAccountModalImport from '@/components/FindAccountModal'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { normalizePosition, positionToDashboardPath, POSITION_STORAGE_KEY } from '@/lib/position'
import { useAdminSettings } from '@/hooks/useAdminSettings'

const ROLE_META: Record<string, { label: string; icon: string; accent: string; border: string; bg: string; hint: string; brand: string }> = {
  customer: { label: '고객', icon: '💧', accent: '#C9A96E', border: 'rgba(201,169,110,0.35)', bg: 'rgba(201,169,110,0.08)', hint: '피부 분석·제품 추천·살롱 예약', brand: 'AURAN' },
  partner:  { label: '파트너스', icon: '💼', accent: '#B8AF80', border: 'rgba(184,175,128,0.35)', bg: 'rgba(184,175,128,0.08)', hint: '추천 링크·커미션 수익', brand: 'AURAN PARTNERS' },
  owner:    { label: '원장님', icon: '🏥', accent: '#D4A97A', border: 'rgba(212,169,122,0.35)', bg: 'rgba(212,169,122,0.08)', hint: '예약·스토어·매출 관리', brand: 'AURAN PRO' },
  brand:    { label: '브랜드사', icon: '🏭', accent: '#C4A0B8', border: 'rgba(196,160,184,0.35)', bg: 'rgba(196,160,184,0.08)', hint: '입점·납품·AI 추천 노출', brand: 'AURAN BRAND HUB' },
  admin:    { label: '관리자', icon: '⚙️', accent: '#C9A96E', border: 'rgba(201,169,110,0.35)', bg: 'rgba(201,169,110,0.08)', hint: '플랫폼 전체 관리', brand: 'AURAN' },
}

function dashboardPathForRole(role: string): string {
  if (role === 'owner' || role === 'salon') return '/dashboard/owner'
  if (role === 'partner') return '/dashboard/partner'
  if (role === 'brand') return '/dashboard/brand'
  if (role === 'admin') return '/admin'
  return '/'
}

function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const role = params.get('role') || 'customer'
  const redirectParam = params.get('redirect')
  const returnUrlParam = params.get('returnUrl')
  const meta = ROLE_META[role] || ROLE_META.customer
  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO === 'true'
  const { getSettingNum } = useAdminSettings()
  const signupWelcomePoint = getSettingNum('points_action', 'signup_welcome', 10000)

  const REMEMBER_EMAIL_KEY = 'auran_remember_email_v1'
  const REMEMBER_EMAIL_CHECKED_KEY = 'auran_remember_email_checked_v1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [kakaoOAuthLoading, setKakaoOAuthLoading] = useState(false)
  const [googleOAuthLoading, setGoogleOAuthLoading] = useState(false)
  const [recentKakao, setRecentKakao] = useState(false)
  const [autoLogin, setAutoLogin] = useState(true)
  const [showReset, setShowReset] = useState(false)
  const [showFindModal, setShowFindModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  useEffect(() => {
    try {
      setRecentKakao(localStorage.getItem('auran_last_provider') === 'kakao')
    } catch {}
    try {
      if (localStorage.getItem('auran_auto_login') === 'false') setAutoLogin(false)
    } catch {}
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const checked = localStorage.getItem(REMEMBER_EMAIL_CHECKED_KEY) === 'true'
        if (checked) {
          const saved = localStorage.getItem(REMEMBER_EMAIL_KEY) || ''
          if (saved) setEmail(saved)
        }
        setRememberEmail(checked)
      } catch {}

      if (redirectParam) return
      const { data: { session: earlySession } } = await supabase.auth.getSession()
      if (earlySession?.user && params.get('role')) {
        const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
        router.replace(redirectParam || positionToDashboardPath(stored || 'customer'))
        return
      }
      if (params.get('role')) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      router.replace(positionToDashboardPath(stored || 'customer'))
    })()
  }, [params, redirectParam, router])


  async function submitLogin() {
    setLoading(true)
    setError('')
    try {
      // 아이디 기억하기 저장/해제
      try {
        localStorage.setItem(REMEMBER_EMAIL_CHECKED_KEY, rememberEmail ? 'true' : 'false')
        if (rememberEmail) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim())
        else localStorage.removeItem(REMEMBER_EMAIL_KEY)
      } catch {}

      const lookupEmail = email.trim().includes('@') ? email.trim() : `${email.trim()}@auran.kr`
      const { data: lockRow } = await supabase
        .from('users')
        .select('login_locked_until')
        .eq('email', lookupEmail)
        .maybeSingle()
      if (lockRow?.login_locked_until) {
        const until = new Date(lockRow.login_locked_until)
        if (until > new Date()) {
          const sec = Math.ceil((until.getTime() - Date.now()) / 1000)
          setError(sec < 60 ? `${sec}초 후 다시 시도해주세요` : `${Math.ceil(sec / 60)}분 후 다시 시도해주세요`)
          return
        }
      }

      const { data: signData, error: authError } = await supabase.auth.signInWithPassword({ email: lookupEmail, password })
      if (authError) throw authError

      if (signData.user?.id) {
        await supabase.from('users').update({ login_failed_count: 0, login_locked_until: null }).eq('auth_id', signData.user.id)
      }

      // 서버 API는 로그인 직후 쿠키가 아직 없어 401일 수 있음 → 클라이언트 users 조회로 보완
      let userData: { role: string | null; status: string | null } | null = null
      const roleRes = await fetch('/api/auth/role-status', { method: 'GET', credentials: 'same-origin' })
      const roleJson = await roleRes.json().catch(() => ({}))
      if (roleJson?.ok) {
        userData = { role: roleJson.role ?? null, status: roleJson.status ?? null }
      } else if (signData.user?.id) {
        const { data: row } = await supabase.from('users').select('role,status').eq('auth_id', signData.user.id).maybeSingle()
        if (row) userData = { role: (row as { role?: string }).role ?? null, status: (row as { status?: string }).status ?? null }
      }

      if (userData?.status === 'suspended') {
        setError('정지된 계정입니다. 고객센터에 문의해주세요.')
        await supabase.auth.signOut()
        return
      }

      const effectiveRole = userData?.role || role
      // 미승인 분기: userData를 실제로 알 때만 (null이면 status 비교 금지 — 전부 미승인으로 오인)
      const needsApproval =
        userData &&
        userData.status !== 'active' &&
        (effectiveRole === 'partner' ||
          effectiveRole === 'owner' ||
          effectiveRole === 'brand' ||
          effectiveRole === 'salon')
      if (needsApproval) {
        await supabase.auth.signOut()
        const r = effectiveRole === 'salon' ? 'owner' : effectiveRole
        router.replace(`/auth/pending-approval?role=${encodeURIComponent(r)}`)
        return
      }

      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      const fromDb = normalizePosition(userData?.role)
      const fromParam = normalizePosition(role)
      const position = fromDb || stored || fromParam || 'customer'

      localStorage.setItem(POSITION_STORAGE_KEY, position)

      // redirect 파라미터가 있으면 해당 경로로, 없으면 기본 대시보드로
      const safeRedirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null
      const safeReturnUrl = returnUrlParam && returnUrlParam.startsWith('/') ? returnUrlParam : null
      router.replace(safeReturnUrl || safeRedirect || dashboardPathForRole(effectiveRole))
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
        const { error: signInRetry } = await supabase.auth.signInWithPassword({ email: email.trim().includes('@') ? email.trim() : `${email.trim()}@auran.kr`, password })
        if (!signInRetry) {
          const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
          router.replace(dashboardPathForRole(stored || role || 'customer'))
          return
        }
        setError('이메일 또는 비밀번호가 맞지 않습니다.')
        return
      }
      setError(msg === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 맞지 않습니다.'
        : msg || '로그인 중 오류가 발생했습니다.')
      if (msg === 'Invalid login credentials' || msg.includes('Invalid login credentials')) {
        const lookupEmail = email.trim().includes('@') ? email.trim() : `${email.trim()}@auran.kr`
        const { data: userRow } = await supabase
          .from('users')
          .select('id, login_failed_count')
          .eq('email', lookupEmail)
          .maybeSingle()
        if (userRow?.id) {
          const failCount = (userRow.login_failed_count ?? 0) + 1
          const updates: Record<string, unknown> = { login_failed_count: failCount }
          let lockUntil: Date | null = null
          if (failCount >= 15) {
            lockUntil = new Date()
            lockUntil.setMinutes(lockUntil.getMinutes() + 30)
          } else if (failCount === 10) {
            lockUntil = new Date()
            lockUntil.setMinutes(lockUntil.getMinutes() + 5)
          } else if (failCount === 5) {
            lockUntil = new Date()
            lockUntil.setSeconds(lockUntil.getSeconds() + 30)
          }
          if (lockUntil) updates.login_locked_until = lockUntil.toISOString()
          await supabase.from('users').update(updates).eq('id', userRow.id)
          if (lockUntil && lockUntil > new Date()) {
            const sec = Math.ceil((lockUntil.getTime() - Date.now()) / 1000)
            setError(sec < 60 ? `${sec}초 후 다시 시도해주세요` : `${Math.ceil(sec / 60)}분 후 다시 시도해주세요`)
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function submitReset() {
    if (!resetEmail) return
    setResetLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetLoading(false)
    if (!error) setResetSent(true)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    await submitLogin()
  }

  async function handleSocial(provider: 'kakao' | 'google') {
    setError('')
    const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
    const fromParam = normalizePosition(role)
    const position = fromParam || stored || 'customer'
    localStorage.setItem(POSITION_STORAGE_KEY, position)
    const redirect = returnUrlParam && returnUrlParam.startsWith('/') ? returnUrlParam : (redirectParam && redirectParam.startsWith('/') ? redirectParam : null)
    if (redirect) {
      localStorage.setItem('returnUrl', redirect)
    }
    const redirectQuery = redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''
    const callbackQuery = `?role=${encodeURIComponent(position)}${redirectQuery}`

    if (provider === 'kakao') {
      setKakaoOAuthLoading(true)
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'kakao',
          options: {
            redirectTo: `https://www.auran.kr/auth/callback${callbackQuery}`,
            scopes: 'profile_nickname profile_image',
          }
        })
        if (error) {
          setError(error.message)
          setKakaoOAuthLoading(false)
        } else {
          try {
            localStorage.setItem('auran_last_provider', 'kakao')
          } catch {}
        }
      } catch (e: unknown) {
        console.error('카카오 로그인:', e)
        setError(e instanceof Error ? e.message : '카카오 로그인에 실패했습니다.')
        setKakaoOAuthLoading(false)
      }
      return
    }

    setGoogleOAuthLoading(true)
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '')
      const appUrl =
        typeof window !== 'undefined' && window.location.hostname?.includes('auran-deploy.vercel.app')
          ? 'https://www.auran.kr'
          : origin
      const googleRedirectTo = `${appUrl}/auth/callback${callbackQuery}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: googleRedirectTo,
          scopes: 'openid email profile',
        }
      })
      if (error) {
        setError(error.message)
        setGoogleOAuthLoading(false)
      }
    } catch (e: unknown) {
      console.error('Google 로그인:', e)
      setError(e instanceof Error ? e.message : 'Google 로그인에 실패했습니다.')
      setGoogleOAuthLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '13px 14px', color: 'var(--text)', fontSize: 14,
    outline: 'none', transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, lineHeight: 1 }}>‹</button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: meta.accent }}>{meta.brand} · {meta.label.toUpperCase()} LOGIN</div>
      </div>

      <div style={{ flex: 1, padding: '8px 24px calc(40px + env(safe-area-inset-bottom, 0px))' }}>
        {/* 역할 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '14px 16px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 14 }}>
          <span style={{ fontSize: 28 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: meta.accent }}>{meta.label} 로그인</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{meta.hint}</div>
          </div>
        </div>
        {role === 'owner' ? (
          <div style={{ padding: '12px 14px', marginBottom: 16, background: 'rgba(212,169,122,0.08)', border: '1px solid rgba(212,169,122,0.25)', borderRadius: 12, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            원장님은 개인 전용 주소(auran.kr/owner/내슬러그)로 로그인하시면 더 빨라요.
            <br />
            주소를 모르시면 스토어 꾸미기 화면에서 확인하실 수 있어요.
          </div>
        ) : null}
        {role === 'partner' ? (
          <div style={{ padding: '12px 14px', marginBottom: 16, background: 'rgba(74,141,192,0.08)', border: '1px solid rgba(74,141,192,0.25)', borderRadius: 12, fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            파트너스는 개인 전용 주소(auran.kr/partner/내슬러그)로 로그인하시면 더 빨라요.
          </div>
        ) : null}
        {role !== 'admin' && role !== 'owner' && role !== 'partner' && role !== 'brand' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 16 }}>
            {recentKakao && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  marginBottom: 8,
                  padding: '6px 10px',
                  borderRadius: 10,
                  background: 'rgba(201,169,110,0.22)',
                  border: '1px solid rgba(201,169,110,0.45)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--gold)',
                  position: 'relative',
                }}
              >
                최근 로그인
                <span
                  style={{
                    position: 'absolute',
                    left: 20,
                    bottom: -6,
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid rgba(201,169,110,0.35)',
                  }}
                  aria-hidden
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSocial('kakao')}
              disabled={kakaoOAuthLoading || googleOAuthLoading}
              style={{
                width: '100%',
                height: 60,
                minHeight: 60,
                padding: '0 14px',
                background: '#fee500',
                border: 'none',
                borderRadius: 12,
                color: '#3c1e1e',
                fontSize: 16,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                <path d="M9 1C4.58 1 1 3.91 1 7.5c0 2.3 1.44 4.32 3.62 5.5L3.5 17l4.18-2.76A9.6 9.6 0 009 14c4.42 0 8-2.91 8-6.5S13.42 1 9 1z" fill="#3c1e1e"/>
              </svg>
              {kakaoOAuthLoading ? '연결 중...' : '카카오로 계속하기'}
            </button>
          </div>
        )}
        <div style={{ marginTop: 0, marginBottom: 20, padding: '10px 12px', borderRadius: 10, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>
          {`지금 가입하면 ${signupWelcomePoint.toLocaleString()}P 즉시 지급`}
        </div>

        {/* 소셜 로그인 */}
        {role !== 'admin' && role !== 'owner' && role !== 'partner' && role !== 'brand' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => void handleSocial('google')}
              disabled={kakaoOAuthLoading || googleOAuthLoading}
              style={{ width: '100%', padding: '14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, color: '#333', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {googleOAuthLoading ? '연결 중...' : 'Google로 계속하기'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>
            {error}
            {false && null}
          </div>
        )}

        {/* 구분선 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>또는 이메일로 로그인</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* 이메일 폼 */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', zIndex: 2, pointerEvents: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace" }}>아이디</div>
            <input
              type="text" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="아이디" required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = meta.accent}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace" }}>비밀번호</div>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력" required
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = meta.accent}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text3)' }}>
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: meta.accent }}
            />
            아이디 기억하기
          </label>

          <button
            type="button" disabled={loading}
            onClick={submitLogin}
            style={{ width: '100%', padding: '15px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, color: meta.accent, fontSize: 15, fontWeight: 700, marginTop: 4, opacity: loading ? 0.7 : 1, position: 'relative', zIndex: 3, pointerEvents: 'auto', cursor: 'pointer' }}
          >
            {loading ? '로그인 중...' : `${meta.label} 로그인`}
          </button>
          <div style={{textAlign:'right', marginTop:8}}>
            <button type="button" onClick={() => setShowFindModal(true)}
              style={{fontSize:12, color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', padding:0}}>
              아이디/비밀번호를 잊으셨나요?
            </button>
          </div>
          {showFindModal && <FindAccountModalImport onClose={() => setShowFindModal(false)} />}
          {showReset && (
            <div style={{marginTop:12, padding:'14px', borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)'}}>
              {resetSent ? (
                <div style={{fontSize:13, color:'#a78bfa', textAlign:'center', lineHeight:1.6}}>
                  📬 재설정 링크를 보냈어요<br/>
                  <span style={{fontSize:11, color:'rgba(255,255,255,0.4)'}}>이메일을 확인해주세요</span>
                </div>
              ) : (
                <>
                  <div style={{fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:8}}>
                    가입한 이메일을 입력하면 재설정 링크를 보내드려요
                  </div>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="아이디"
                    style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:13, boxSizing:'border-box', marginBottom:8, outline:'none'}}
                  />
                  <button type="button" onClick={submitReset} disabled={resetLoading}
                    style={{width:'100%', padding:'10px', borderRadius:8, background:'#7B5EA7', border:'none', color:'#fff', fontSize:13, cursor:'pointer', opacity: resetLoading ? 0.6 : 1}}>
                    {resetLoading ? '전송 중...' : '재설정 링크 보내기'}
                  </button>
                </>
              )}
            </div>
          )}
        </form>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text3)', marginTop: 14, marginBottom: 4 }}>
          <input
            type="checkbox"
            checked={autoLogin}
            onChange={(e) => {
              const v = e.target.checked
              setAutoLogin(v)
              try {
                localStorage.setItem('auran_auto_login', v ? 'true' : 'false')
              } catch {}
            }}
            style={{ width: 14, height: 14, accentColor: meta.accent }}
          />
          자동로그인
        </label>

        {/* 회원가입 링크 */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text3)' }}>
          계정이 없으신가요?{' '}
          <button
            onClick={() => router.push(`/signup/consent?role=${role}`)}
            style={{ background: 'none', border: 'none', color: meta.accent, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            회원가입 →
          </button>
        </div>

        {/* 데모 계정 안내 */}
        {showDemo && (
          <div style={{ marginTop: 24, padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>DEMO ACCOUNT</div>
            {[
              { r: 'customer', e: 'guest@auran.kr', p: 'auran1234!' },
              { r: 'partner', e: 'partner@auran.kr', p: 'auran1234!' },
              { r: 'owner', e: 'shop@auran.kr', p: 'auran1234!' },
              { r: 'brand', e: 'brand@auran.kr', p: 'auran1234!' },
              { r: 'admin', e: 'admin@auran.kr', p: 'auran1234!' },
            ].map(d => (
              <button
                key={d.r}
                type="button"
                onClick={() => { setEmail(d.e); setPassword(d.p); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  fontSize: 10,
                  color: 'var(--text3)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                  marginBottom: 6,
                  cursor: 'pointer',
                }}
              >
                <span>{d.r}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{d.e} / {d.p}</span>
              </button>
            ))}
            <div style={{ fontSize: 9, color: 'rgba(201,168,76,0.75)', marginTop: 6 }}>
              ※ `.env`에서 `NEXT_PUBLIC_SHOW_DEMO=true`일 때만 표시됩니다.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
