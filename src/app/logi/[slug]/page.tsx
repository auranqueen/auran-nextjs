'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
interface BrandInfo {
  id: string
  name: string
  brand_name_kr: string | null
  logo_url: string | null
  slug: string
  user_id: string
}
export default function LogiLoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const [brand, setBrand] = useState<BrandInfo | null>(null)
  const [loadingBrand, setLoadingBrand] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  useEffect(() => {
    const loadBrand = async () => {
      const { data } = await supabase
        .from('brands')
        .select('id, name, brand_name_kr, logo_url, slug, user_id')
        .eq('slug', slug)
        .maybeSingle()
      if (!data) { setNotFound(true); setLoadingBrand(false); return }
      setBrand(data as BrandInfo)
      setLoadingBrand(false)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && session.user.id === (data as BrandInfo).user_id) {
        router.replace(`/dashboard/logi?slug=${slug}`)
      }
    }
    void loadBrand()
  }, [slug])
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId.trim() || !password) { setError('아이디와 비밀번호를 입력해주세요'); return }
    if (!brand) return
    setLoading(true); setError('')
    const email = userId.includes('@') ? userId : `${userId.trim()}@auran.kr`
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.user) {
      setError('아이디 또는 비밀번호가 올바르지 않아요')
      setLoading(false); return
    }
    if (data.user.id !== brand.user_id) {
      await supabase.auth.signOut()
      setError('이 물류 허브에 접근 권한이 없어요')
      setLoading(false); return
    }
    router.replace(`/dashboard/logi?slug=${slug}`)
  }
  const BG = '#0d1117'
  const CARD_BG = '#161b22'
  const BORDER = 'rgba(255,255,255,0.08)'
  const TEXT = 'rgba(255,255,255,0.85)'
  const SUB = 'rgba(255,255,255,0.4)'
  const BLUE = '#2188ff'
  const INPUT_STYLE: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: `0.5px solid ${BORDER}`, borderRadius: 10,
    padding: '13px 14px', fontSize: 15, color: TEXT, outline: 'none',
  }
  if (loadingBrand) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SUB, fontSize: 14 }}>로딩 중...</div>
  )
  if (notFound) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <div style={{ fontSize: 16, color: TEXT }}>존재하지 않는 물류 허브예요</div>
      <div style={{ fontSize: 13, color: SUB }}>URL을 다시 확인해주세요</div>
    </div>
  )
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={brand.name}
              style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'contain', background: '#fff', padding: 8, marginBottom: 16 }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 16, background: `${BLUE}20`, border: `1px solid ${BLUE}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}>
              🚛
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: 600, color: TEXT, marginBottom: 4 }}>
            {brand?.brand_name_kr || brand?.name}
          </div>
          <div style={{ fontSize: 12, color: SUB, letterSpacing: 2 }}>물류 허브</div>
        </div>
        <div style={{ background: CARD_BG, border: `0.5px solid ${BORDER}`, borderRadius: 16, padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 6 }}>
            {brand?.brand_name_kr || brand?.name} 물류 허브
          </div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 24, lineHeight: 1.6 }}>
            물류팀 전용 계정으로 로그인해주세요
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>아이디</div>
              <input value={userId} onChange={e => setUserId(e.target.value)}
                placeholder="예: civasan" autoComplete="username" style={INPUT_STYLE} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: SUB, marginBottom: 6 }}>비밀번호</div>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호 입력" autoComplete="current-password"
                  style={{ ...INPUT_STYLE, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: SUB, fontSize: 16, padding: 0 }}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            {error && (
              <div style={{ background: 'rgba(229,57,53,0.08)', border: '0.5px solid rgba(229,57,53,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#E53935', marginBottom: 14 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: loading ? `${BLUE}60` : BLUE, color: '#fff', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {loading ? '로그인 중...' : '물류 허브 접속'}
            </button>
          </form>
          <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 11, color: SUB, lineHeight: 1.7 }}>
            물류팀 전용 시스템입니다<br/>
            계정 문의: queen8039@gmail.com<br/>
            AURAN 물류 허브 · {brand?.name}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
          © AURAN · 주식회사티엔씨
        </div>
      </div>
    </div>
  )
}
