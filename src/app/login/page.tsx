'use client'
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
  return '/dashboard/customer'
}

function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const role = params.get('role') || 'customer'
  const redirectParam = params.get('redirect')
  const meta = ROLE_META[role] || ROLE_META.customer
  const showDemo = process.env.NEXT_PUBLIC_SHOW_DEMO === 'true'
  const { getSettingNum } = useAdminSettings()
  const signupWelcomePoint = getSettingNum('points_action', 'signup_welcome', 8888)

  const REMEMBER_EMAIL_KEY = 'auran_remember_email_v1'
  const REMEMBER_EMAIL_CHECKED_KEY = 'auran_remember_email_checked_v1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [socialLoading, setSocialLoading] = useState('')

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

      if (params.get('role') || redirectParam) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      router.replace(positionToDashboardPath(stored || 'customer'))
    })()
  }, [params, redirectParam, router, supabase])


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

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError

      // 역할/승인 상태는 RLS 영향 없도록 서버에서 확인(service_role)
      const roleRes = await fetch('/api/auth/role-status', { method: 'GET' })
      const roleJson = await roleRes.json().catch(() => ({}))
      const userData = roleJson?.ok ? { role: roleJson.role as any, status: roleJson.status as any } : null

      if (userData?.status === 'suspended') {
        setError('정지된 계정입니다. 고객센터에 문의해주세요.')
        await supabase.auth.signOut()
        return
      }

      const effectiveRole = userData?.role || role
      if ((effectiveRole === 'partner' || effectiveRole === 'owner' || effectiveRole === 'brand') && userData?.status !== 'active') {
        await supabase.auth.signOut()
        router.replace(`/auth/pending-approval?role=${encodeURIComponent(effectiveRole)}`)
        return
      }

      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      const fromDb = normalizePosition(userData?.role)
      const fromParam = normalizePosition(role)
      const position = fromDb || stored || fromParam || 'customer'

      localStorage.setItem(POSITION_STORAGE_KEY, position)

      // redirect 파라미터가 있으면 해당 경로로, 없으면 기본 대시보드로
      const safeRedirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null
      router.replace(safeRedirect || dashboardPathForRole(effectiveRole))
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
        setError('이메일 인증이 필요합니다. 가입 시 발송된 메일의 링크를 확인해주세요.')
        return
      }
      setError(msg === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 맞지 않습니다.'
        : msg || '로그인 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    await submitLogin()
  }

  async function handleSocial(provider: 'kakao' | 'google') {
    setSocialLoading(provider)
    const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
    const fromParam = normalizePosition(role)
    const position = fromParam || stored || 'customer'
    localStorage.setItem(POSITION_STORAGE_KEY, position)
    // 로그인 후 돌아갈 주소: auran-deploy면 프로덕션으로, 아니면 현재 주소 (NEXT_PUBLIC_APP_URL 무시)
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '')
    const appUrl = (typeof window !== 'undefined' && window.location.hostname?.includes('auran-deploy.vercel.app'))
      ? 'https://www.auran.kr'
      : origin
    const redirect = redirectParam && redirectParam.startsWith('/') ? redirectParam : null
    const redirectQuery = redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Use stable production URL to avoid Kakao redirect mismatch (KOE205)
        // redirect 파라미터를 함께 전달해서 소셜 로그인 후에도 원래 페이지로 복귀
        redirectTo: `${appUrl}/auth/callback?role=${position}${redirectQuery}`,
        ...(provider === 'kakao'
          ? { scopes: 'profile_nickname profile_image account_email' }
          : {}),
        queryParams:
          provider === 'kakao'
            ? { scope: 'profile_nickname profile_image account_email' }
            : {},
      },
    })
    if (error) setError(error.message)
    setSocialLoading('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '13px 14px', color: 'var(--text)', fontSize: 14,
    outline: 'none', transition: 'border-color 0.15s',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22, lineHeight: 1 }}>‹</button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: meta.accent }}>{meta.brand} · {meta.label.toUpperCase()} LOGIN</div>
      </div>

      <div style={{ flex: 1, padding: '8px 24px 40px' }}>
        {/* 역할 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '14px 16px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 14 }}>
          <span style={{ fontSize: 28 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: meta.accent }}>{meta.label} 로그인</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{meta.hint}</div>
          </div>
        </div>
        <div style={{ marginTop: -16, marginBottom: 20, padding: '10px 12px', borderRadius: 10, background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', fontSize: 12, color: 'var(--gold)', fontWeight: 700 }}>
          {`지금 가입하면 ${signupWelcomePoint.toLocaleString()}P 즉시 지급`}
        </div>

        {/* 소셜 로그인 */}
        {role !== 'admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <button
              onClick={() => handleSocial('kakao')}
              disabled={!!socialLoading}
              style={{ width: '100%', padding: '14px', background: '#fee500', border: 'none', borderRadius: 12, color: '#3c1e1e', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 1C4.58 1 1 3.91 1 7.5c0 2.3 1.44 4.32 3.62 5.5L3.5 17l4.18-2.76A9.6 9.6 0 009 14c4.42 0 8-2.91 8-6.5S13.42 1 9 1z" fill="#3c1e1e"/>
              </svg>
              {socialLoading === 'kakao' ? '연결 중...' : '카카오로 계속하기'}
            </button>
            <button
              onClick={() => handleSocial('google')}
              disabled={!!socialLoading}
              style={{ width: '100%', padding: '14px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, color: '#333', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {socialLoading === 'google' ? '연결 중...' : 'Google로 계속하기'}
            </button>
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
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace" }}>이메일</div>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com" required
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

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>
              {error}
              {error.includes('이메일 인증') && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => router.push(`/auth/verify-email?email=${encodeURIComponent(email)}&role=${role}`)}
                    style={{ background: 'none', border: 'none', color: meta.accent, textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}
                  >
                    인증 메일 다시 보내기
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button" disabled={loading}
            onClick={submitLogin}
            style={{ width: '100%', padding: '15px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, color: meta.accent, fontSize: 15, fontWeight: 700, marginTop: 4, opacity: loading ? 0.7 : 1, position: 'relative', zIndex: 3, pointerEvents: 'auto', cursor: 'pointer' }}
          >
            {loading ? '로그인 중...' : `${meta.label} 로그인`}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text3)' }}>
          계정이 없으신가요?{' '}
          <button
            onClick={() => router.push(`/signup?role=${role}`)}
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
