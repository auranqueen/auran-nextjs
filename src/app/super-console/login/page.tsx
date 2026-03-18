'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SuperConsoleLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const REMEMBER_EMAIL_KEY = 'auran_remember_email_v1'
  const REMEMBER_EMAIL_CHECKED_KEY = 'auran_remember_email_checked_v1'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberEmail, setRememberEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const checked = localStorage.getItem(REMEMBER_EMAIL_CHECKED_KEY) === 'true'
      if (checked) {
        const saved = localStorage.getItem(REMEMBER_EMAIL_KEY) || ''
        if (saved) setEmail(saved)
      }
      setRememberEmail(checked)
    } catch {}
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12,
    padding: '14px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // 아이디 기억하기 저장/해제
      try {
        localStorage.setItem(REMEMBER_EMAIL_CHECKED_KEY, rememberEmail ? 'true' : 'false')
        if (rememberEmail) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim())
        else localStorage.removeItem(REMEMBER_EMAIL_KEY)
      } catch {}

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authErr) throw authErr

      // role check: server-side verify (service role, avoids RLS issues)
      const res = await fetch('/api/super-console/verify', { method: 'GET' })
      if (!res.ok) {
        await supabase.auth.signOut()
        setError('접근 권한이 없습니다')
        return
      }

      // 통과: 실제 어드민 콘솔로 이동 (슈퍼콘솔 URL은 비공개 진입점)
      router.replace('/admin')
    } catch {
      setError('접근 권한이 없습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#07090c', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 22 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 26, letterSpacing: '4px', color: '#c9a84c', fontWeight: 700 }}>AURAN</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
            Super Console
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            required
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            required
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: '#c9a84c' }}
            />
            아이디 기억하기
          </label>

          {error && (
            <div style={{ padding: '10px 12px', background: 'rgba(217,79,79,0.10)', border: '1px solid rgba(217,79,79,0.25)', borderRadius: 12, color: '#e08080', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%',
              padding: 14,
              borderRadius: 12,
              border: '1px solid rgba(201,168,76,0.35)',
              background: 'rgba(201,168,76,0.14)',
              color: '#c9a84c',
              fontWeight: 800,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.replace('/')}
          style={{ width: '100%', marginTop: 10, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.10)', background: 'transparent', color: 'rgba(255,255,255,0.65)' }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}

