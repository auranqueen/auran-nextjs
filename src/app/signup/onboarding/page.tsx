'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function OnboardingInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const provider = params.get('provider') || ''
  const role = params.get('role') || 'customer'

  const [cycleType, setCycleType] = useState('')
  const [track, setTrack] = useState('')
  const [cycleLength, setCycleLength] = useState('28')
  const [lastPeriodDate, setLastPeriodDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text3)', marginBottom: 5,
    fontFamily: "'JetBrains Mono', monospace", display: 'block'
  }

  const inp = (id: string, val: string, setter: (v: string) => void, opts: any = {}) => (
    <input
      id={id} value={val}
      onChange={e => setter(e.target.value)}
      style={{
        width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 14,
        border: '1px solid var(--border)', background: 'var(--bg3)',
        color: 'var(--text)', boxSizing: 'border-box' as const,
      }}
      {...opts}
    />
  )

  const handleComplete = async () => {
    if (!cycleType) { setError('생리 주기를 선택해주세요'); return }
    if (track === 'general' && !lastPeriodDate) { setError('마지막 생리 시작일을 입력해주세요'); return }
    setLoading(true)
    try {
      // localStorage에 hormone 데이터 저장
      localStorage.setItem('auran_cycle_type', cycleType)
      localStorage.setItem('auran_track', track)
      localStorage.setItem('auran_cycle_length', cycleLength)
      localStorage.setItem('auran_last_period', lastPeriodDate)

      const appUrl = window.location.origin
      const callbackQuery = `?role=${role}`

      if (provider === 'kakao') {
        await supabase.auth.signInWithOAuth({
          provider: 'kakao',
          options: {
            redirectTo: `${appUrl}/auth/callback${callbackQuery}`,
            scopes: 'profile_nickname profile_image',
          }
        })
        return
      }
      if (provider === 'google') {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${appUrl}/auth/callback${callbackQuery}` }
        })
        return
      }
      // 이메일 가입
      router.push(`/signup?role=${role}`)
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, color: 'var(--text)', marginBottom: 6 }}>나의 생리 주기는?</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>맞춤 추천 정확도를 높이기 위한 마지막 단계예요</div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => { setCycleType('menstrual'); setTrack('general') }}
            style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 12,
              border: cycleType === 'menstrual' ? '1px solid #7B5EA7' : '1px solid var(--border)',
              background: cycleType === 'menstrual' ? 'rgba(123,94,167,0.08)' : 'var(--bg3)',
              color: cycleType === 'menstrual' ? '#7B5EA7' : 'var(--text)',
              fontSize: 14, cursor: 'pointer',
            }}
          >🌸 생리 주기가 있어요</button>
          <button
            type="button"
            onClick={() => { setCycleType('menopause'); setTrack('menopause_peri') }}
            style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 12,
              border: cycleType === 'menopause' ? '1px solid #7B5EA7' : '1px solid var(--border)',
              background: cycleType === 'menopause' ? 'rgba(123,94,167,0.08)' : 'var(--bg3)',
              color: cycleType === 'menopause' ? '#7B5EA7' : 'var(--text)',
              fontSize: 14, cursor: 'pointer',
            }}
          >🌙 생리 주기가 없어요</button>
        </div>

        {track === 'general' && (
          <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
            <div><label style={labelStyle}>평균 주기 일수</label>{inp('cycle', cycleLength, setCycleLength, { inputMode: 'numeric', placeholder: '예: 28' })}</div>
            <div><label style={labelStyle}>마지막 생리 시작일</label>{inp('lastPeriod', lastPeriodDate, setLastPeriodDate, { type: 'date' })}</div>
          </div>
        )}

        {error && <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>{error}</div>}

        <button
          onClick={handleComplete}
          disabled={loading || !cycleType}
          style={{
            width: '100%', padding: 15, borderRadius: 12,
            background: cycleType ? '#7B5EA7' : 'var(--bg3)',
            border: '1px solid rgba(123,94,167,0.3)',
            color: cycleType ? '#fff' : 'var(--text3)',
            fontSize: 15, cursor: cycleType ? 'pointer' : 'default',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '처리 중...' : '다음 →'}
        </button>

        <button
          onClick={() => router.back()}
          style={{ width: '100%', padding: 10, marginTop: 8, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}
        >← 뒤로</button>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  )
}
