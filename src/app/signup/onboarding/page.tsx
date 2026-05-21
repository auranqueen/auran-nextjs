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

  const [birthRaw, setBirthRaw] = useState('')
  const [gender, setGender] = useState('')
  const [cycleType, setCycleType] = useState('')
  const [track, setTrack] = useState('')
  const [cycleLength, setCycleLength] = useState('28')
  const [lastPeriodDate, setLastPeriodDate] = useState('')
  const [skinType, setSkinType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text3)', marginBottom: 5,
    fontFamily: "'JetBrains Mono', monospace", display: 'block'
  }

  const formatBirth = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '').slice(0, 8)
    if (raw.length > 6) return raw.slice(0,4) + '. ' + raw.slice(4,6) + '. ' + raw.slice(6)
    if (raw.length > 4) return raw.slice(0,4) + '. ' + raw.slice(4)
    return raw
  }

  const birthRawDigits = birthRaw.replace(/[^0-9]/g, '')
  const birthAge = birthRawDigits.length === 8
    ? new Date().getFullYear() - parseInt(birthRawDigits.slice(0,4))
    : null

  const birthForDB = birthRawDigits.length === 8
    ? `${birthRawDigits.slice(0,4)}-${birthRawDigits.slice(4,6)}-${birthRawDigits.slice(6,8)}`
    : null

  const handleComplete = async () => {
    if (birthRawDigits.length !== 8) { setError('생년월일을 입력해주세요'); return }
    if (!gender) { setError('성별을 선택해주세요'); return }
    if (gender === '여성' && !cycleType) { setError('생리 주기를 선택해주세요'); return }
    if (gender === '여성' && track === 'general' && !lastPeriodDate) { setError('마지막 생리 시작일을 입력해주세요'); return }
    if (gender === '남성' && !skinType) { setError('피부 타입을 선택해주세요'); return }
    setLoading(true)
    try {
      localStorage.setItem('auran_birth_date', birthForDB || '')
      localStorage.setItem('auran_gender', gender)
      localStorage.setItem('auran_cycle_type', gender === '여성' ? cycleType : 'male')
      localStorage.setItem('auran_track', gender === '여성' ? track : 'male')
      localStorage.setItem('auran_cycle_length', cycleLength)
      localStorage.setItem('auran_last_period', lastPeriodDate)
      localStorage.setItem('auran_skin_type', skinType)
      localStorage.setItem('auran_onboarding_done', 'true')

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
        <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, color: 'var(--text)', marginBottom: 6 }}>나를 알려주세요</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>맞춤 추천을 위한 기본 정보예요</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 생년월일 */}
          <div>
            <label style={labelStyle}>생년월일 *</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              placeholder="19901231"
              value={birthRaw}
              onChange={e => setBirthRaw(formatBirth(e.target.value))}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 18,
                border: '1px solid var(--border)', background: 'var(--bg3)',
                color: 'var(--text)', boxSizing: 'border-box' as const,
                letterSpacing: 2,
              }}
            />
            {birthAge !== null && (
              <div style={{ fontSize: 11, color: '#7B5EA7', marginTop: 4 }}>
                만 {birthAge}세 · 생일 쿠폰 자동 발급 💜
              </div>
            )}
          </div>

          {/* 성별 */}
          <div>
            <label style={labelStyle}>성별 *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['여성', '남성'] as const).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => { setGender(g); setCycleType(''); setTrack(''); setSkinType('') }}
                  style={{
                    flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13,
                    border: gender === g ? '1px solid #7B5EA7' : '1px solid var(--border)',
                    background: gender === g ? 'rgba(123,94,167,0.08)' : 'var(--bg3)',
                    color: gender === g ? '#7B5EA7' : 'var(--text)',
                    cursor: 'pointer',
                  }}
                >{g}</button>
              ))}
            </div>
          </div>

          {/* 여성 - 생리 주기 */}
          {gender === '여성' && (
            <div>
              <label style={labelStyle}>나의 생리 주기는?</label>
              <div style={{ display: 'grid', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setCycleType('menstrual'); setTrack('general') }}
                  style={{
                    textAlign: 'left', padding: '13px 14px', borderRadius: 10,
                    border: cycleType === 'menstrual' ? '1px solid #7B5EA7' : '1px solid var(--border)',
                    background: cycleType === 'menstrual' ? 'rgba(123,94,167,0.08)' : 'var(--bg3)',
                    color: cycleType === 'menstrual' ? '#7B5EA7' : 'var(--text)',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >🌸 생리 주기가 있어요</button>
                <button
                  type="button"
                  onClick={() => { setCycleType('menopause'); setTrack('menopause_peri') }}
                  style={{
                    textAlign: 'left', padding: '13px 14px', borderRadius: 10,
                    border: cycleType === 'menopause' ? '1px solid #7B5EA7' : '1px solid var(--border)',
                    background: cycleType === 'menopause' ? 'rgba(123,94,167,0.08)' : 'var(--bg3)',
                    color: cycleType === 'menopause' ? '#7B5EA7' : 'var(--text)',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >🌙 생리 주기가 없어요</button>
              </div>
              {track === 'general' && (
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  <div>
                    <label style={labelStyle}>평균 주기 일수</label>
                    <input
                      type="text" inputMode="numeric" value={cycleLength}
                      onChange={e => setCycleLength(e.target.value)}
                      placeholder="예: 28"
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 14, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', boxSizing: 'border-box' as const }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>마지막 생리 시작일</label>
                    <input
                      type="date" value={lastPeriodDate}
                      onChange={e => setLastPeriodDate(e.target.value)}
                      style={{ width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: 14, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', boxSizing: 'border-box' as const }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 남성 - 피부 타입 */}
          {gender === '남성' && (
            <div>
              <label style={labelStyle}>피부 타입이 어때요?</label>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['oily', '지성 (번들거려요)'],
                  ['dry', '건성 (당겨요)'],
                  ['combination', '복합성 (T존만 번들)'],
                  ['sensitive', '민감성 (자극에 약해요)'],
                ].map(([k, lab]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSkinType(k)}
                    style={{
                      textAlign: 'left', padding: '13px 14px', borderRadius: 10,
                      border: skinType === k ? '1px solid #C9A96E' : '1px solid var(--border)',
                      background: skinType === k ? 'rgba(201,169,110,0.08)' : 'var(--bg3)',
                      color: skinType === k ? '#C9A96E' : 'var(--text)',
                      fontSize: 13, cursor: 'pointer',
                    }}
                  >{lab}</button>
                ))}
              </div>
            </div>
          )}

        </div>

        {error && <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>{error}</div>}

        <button
          onClick={handleComplete}
          disabled={loading}
          style={{
            width: '100%', padding: 15, borderRadius: 12, marginTop: 20,
            background: '#7B5EA7', border: '1px solid rgba(123,94,167,0.3)',
            color: '#fff', fontSize: 15, cursor: 'pointer',
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
