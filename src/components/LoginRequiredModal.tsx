'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { navigateToSupabaseOAuthRedirect } from '@/lib/supabase/oauth-pkce-client'
import { normalizePosition, POSITION_STORAGE_KEY } from '@/lib/position'

type Props = {
  open: boolean
  onClose: () => void
  /** 로그인 후 돌아올 경로 (이메일 로그인 / OAuth 콜백용) */
  returnPath: string
}

export default function LoginRequiredModal({ open, onClose, returnPath }: Props) {
  const router = useRouter()
  const [socialLoading, setSocialLoading] = useState('')
  const [oauthError, setOauthError] = useState('')

  if (!open) return null

  async function handleSocial(provider: 'kakao') {
    setSocialLoading(provider)
    setOauthError('')
    try {
      const stored = normalizePosition(localStorage.getItem(POSITION_STORAGE_KEY))
      const position = stored || 'customer'
      localStorage.setItem(POSITION_STORAGE_KEY, position)
      const safeReturn = returnPath.startsWith('/') ? returnPath : '/'
      const callbackQuery = `?role=${encodeURIComponent(position)}&redirect=${encodeURIComponent(safeReturn)}`
      const redirectTo = `https://www.auran.kr/auth/callback${callbackQuery}`
      await navigateToSupabaseOAuthRedirect({
        provider,
        redirectTo,
        scopes: 'profile_nickname profile_image',
      })
    } catch (e: unknown) {
      console.error('카카오 로그인 예외:', e)
      setOauthError(e instanceof Error ? e.message : '카카오 로그인에 실패했습니다.')
    } finally {
      setSocialLoading('')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 320,
          background: 'linear-gradient(160deg,#141820,#0d1014)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '22px 18px',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 }}>로그인이 필요해요</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>로그인 후 이어서 진행할 수 있어요.</div>
        {oauthError && (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              background: 'rgba(217,79,79,0.12)',
              border: '1px solid rgba(217,79,79,0.35)',
              borderRadius: 10,
              fontSize: 12,
              color: '#e08080',
            }}
          >
            {oauthError}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => void handleSocial('kakao')}
            disabled={!!socialLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: '#fee500',
              border: 'none',
              borderRadius: 12,
              color: '#3c1e1e',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {socialLoading === 'kakao' ? '연결 중...' : '카카오로 로그인'}
          </button>
          <button
            type="button"
            onClick={() => {
              const q = returnPath.startsWith('/') ? `?redirect=${encodeURIComponent(returnPath)}` : ''
              router.push(`/login?role=customer${q}`)
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            이메일로 로그인
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text3)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
