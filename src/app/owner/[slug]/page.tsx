'use client'
import FindAccountModal from '@/components/FindAccountModal'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
interface OwnerInfo {
  id: string
  full_name: string | null
  owner_store_name: string | null
  avatar_url: string | null
  slug: string
  auth_id: string
}
export default function OwnerLoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const [owner, setOwner] = useState<OwnerInfo | null>(null)
  const [loadingOwner, setLoadingOwner] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [userId, setUserId] = useState('')
  const [rememberUserId, setRememberUserId] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showFindModal, setShowFindModal] = useState(false)
  useEffect(() => {
    const saved = localStorage.getItem(`auran_owner_userid_${slug}`)
    const savedRemember = localStorage.getItem(`auran_owner_remember_${slug}`)
    if (saved && savedRemember === 'true') {
      setUserId(saved)
      setRememberUserId(true)
    }
  }, [slug])
  useEffect(() => {
    const loadOwner = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, owner_store_name, avatar_url, slug, auth_id')
        .eq('slug', slug)
        .eq('role', 'owner')
        .maybeSingle()
      if (!data) { setNotFound(true); setLoadingOwner(false); return }
      setOwner(data as OwnerInfo)
      setLoadingOwner(false)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && session.user.id === data.auth_id) {
        router.replace('/dashboard/owner?v=2')
      }
    }
    void loadOwner()
  }, [slug])
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId.trim() || !password) { setError('아이디와 비밀번호를 입력해주세요'); return }
    if (!owner) return
    setLoading(true)
    setError('')
    const email = userId.includes('@') ? userId : `${userId.trim()}@auran.kr`
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.user) {
      setError('아이디 또는 비밀번호가 올바르지 않아요')
      setLoading(false)
      return
    }
    if (data.user.id !== owner.auth_id) {
      await supabase.auth.signOut()
      setError('이 원장님 콘솔에 접근 권한이 없어요')
      setLoading(false)
      return
    }
    if (rememberUserId) {
      localStorage.setItem(`auran_owner_userid_${slug}`, userId.trim())
      localStorage.setItem(`auran_owner_remember_${slug}`, 'true')
    } else {
      localStorage.removeItem(`auran_owner_userid_${slug}`)
      localStorage.removeItem(`auran_owner_remember_${slug}`)
    }
    router.replace('/dashboard/owner?v=2')
  }
  const BG = '#0f0d14'
  const CARD_BG = '#1a1520'
  const BORDER = 'rgba(255,255,255,0.08)'
  const TEXT = 'rgba(255,255,255,0.85)'
  const SUB = 'rgba(255,255,255,0.4)'
  const PURPLE = '#7B5EA7'
  const GOLD = '#C9A96E'
  const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: `0.5px solid ${BORDER}`,
    borderRadius: 10,
    padding: '13px 14px',
    fontSize: 15,
    color: TEXT,
    outline: 'none',
  }
  if (loadingOwner) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 14 }}>
      로딩 중...
    </div>
  )
  if (notFound) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <div style={{ fontSize: 16, color: TEXT }}>존재하지 않는 원장님 콘솔이에요</div>
      <div style={{ fontSize: 13, color: SUB }}>URL을 다시 확인해주세요</div>
    </div>
  )
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {owner?.avatar_url ? (
            <img src={owner.avatar_url} alt={owner.full_name || ''} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${PURPLE}60`, marginBottom: 16 }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${PURPLE}30`, border: `1px solid ${PURPLE}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>
              🌸
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
            {owner?.owner_store_name || owner?.full_name || '원장님'}
          </div>
          <div style={{ fontSize: 12, color: GOLD, letterSpacing: 2 }}>AURAN OWNER CONSOLE</div>
        </div>
        <div style={{ background: CARD_BG, border: `0.5px solid ${BORDER}`, borderRadius: 16, padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 6 }}>
            {owner?.owner_store_name || owner?.full_name} 전용 콘솔
          </div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 24, lineHeight: 1.6 }}>
            원장님 본인 계정으로 로그인해주세요
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>아이디</div>
              <input
                value={userId}
                onChange={e => setUserId(e.target.value)}
                placeholder="아이디 입력"
                autoComplete="username"
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>비밀번호</div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  autoComplete="current-password"
                  style={{ ...INPUT_STYLE, paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, fontSize: 16, padding: 0 }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}
              onClick={() => setRememberUserId(v => !v)}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${rememberUserId ? PURPLE : 'rgba(255,255,255,0.2)'}`, background: rememberUserId ? PURPLE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                {rememberUserId && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>아이디 기억하기</span>
            </div>
            {error && (
              <div style={{ background: 'rgba(229,57,53,0.08)', border: '0.5px solid rgba(229,57,53,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#E53935', marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: loading ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {loading ? '로그인 중...' : '로그인하기'}
            </button>
          </form>
          {showFindModal && <FindAccountModal onClose={() => setShowFindModal(false)} />}
          <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 11, color: SUB, lineHeight: 1.7 }}>
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowFindModal(v => !v)}>아이디·비밀번호를 잊으셨나요?</span><br/>
            AURAN Owner Console · {owner?.owner_store_name || owner?.full_name}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          © AURAN · 주식회사티엔씨
        </div>
      </div>
    </div>
  )
}
