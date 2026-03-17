'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ROLE_META: Record<string, { label: string; icon: string; color: string; border: string; bg: string }> = {
  customer: { label: '고객', icon: '💧', color: '#c9a84c', border: 'rgba(201,168,76,0.35)', bg: 'rgba(201,168,76,0.08)' },
  partner:  { label: '파트너스', icon: '💼', color: '#4a8dc0', border: 'rgba(74,141,192,0.35)', bg: 'rgba(74,141,192,0.08)' },
  owner:    { label: '원장님', icon: '🏥', color: '#bf5f90', border: 'rgba(191,95,144,0.35)', bg: 'rgba(191,95,144,0.08)' },
  brand:    { label: '브랜드사', icon: '🏭', color: '#4cad7e', border: 'rgba(76,173,126,0.35)', bg: 'rgba(76,173,126,0.08)' },
}

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const role = params.get('role') || 'customer'
  const inviteCode = params.get('ref') || ''
  const meta = ROLE_META[role] || ROLE_META.customer

  const [step, setStep] = useState(1) // 1: 동의 2: 정보입력 3: 완료
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '', phone: '' })
  const [consent, setConsent] = useState({ required1: false, required2: false, marketing: false })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const inp = (id: string, value: string, onChange: (v: string) => void, opts: any = {}) => (
    <input
      {...opts}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '13px 14px', color: 'var(--text)', fontSize: 14, outline: 'none',
      }}
      onFocus={e => e.target.style.borderColor = meta.color}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
    />
  )

  async function handleSignup() {
    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (form.password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    setLoading(true); setError('')
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name, role } }
      })
      if (authErr) throw authErr

      if (authData.user) {
        const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase()
        const { error: dbErr } = await supabase.from('users').insert({
          auth_id: authData.user.id,
          email: form.email,
          name: form.name,
          phone: form.phone,
          role,
          provider: 'email',
          referral_code: referralCode,
          status: 'active',
          points: 0,
          charge_balance: 0,
        })
        if (dbErr && !dbErr.message.includes('duplicate')) throw dbErr

        // 초대 코드 처리
        if (inviteCode) {
          await supabase.from('invite_links')
            .update({ used_count: supabase.rpc('increment', { row_id: inviteCode }) })
            .eq('code', inviteCode)
        }

        // 트래픽 로그
        await supabase.from('traffic_logs').insert({
          user_id: authData.user.id,
          source: inviteCode ? 'partner' : 'direct',
          invite_code: inviteCode || null,
          action: 'signup',
        })
      }
      setStep(3)
    } catch (err: any) {
      setError(err.message.includes('already registered')
        ? '이미 가입된 이메일입니다. 로그인해주세요.'
        : err.message || '가입 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text3)', marginBottom: 5, fontFamily: "'JetBrains Mono', monospace", display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push(`/login?role=${role}`)}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22 }}>‹</button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: meta.color }}>
          AURAN · {meta.label.toUpperCase()} 회원가입
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{step}/3</div>
      </div>

      {/* 스텝 바 */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? meta.color : 'var(--bg3)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          {['약관 동의', '정보 입력', '가입 완료'].map((l, i) => (
            <span key={i} style={{ fontSize: 9, color: i + 1 <= step ? meta.color : 'var(--text3)' }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 24px 40px' }}>

        {/* STEP 1: 약관 동의 */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>약관에 동의해주세요</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>서비스 이용을 위해 필수 약관에 동의해주세요</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'required1', label: '[필수] 개인정보 수집·이용 동의', desc: '성명, 이메일, 피부 분석 정보 수집' },
                { key: 'required2', label: '[필수] 민감정보 처리 동의', desc: '피부 타입 등 건강 관련 정보 처리' },
                { key: 'marketing', label: '[선택] 마케팅 정보 수신 동의', desc: '이벤트·프로모션 알림 수신' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 14px', background: 'var(--bg3)', border: `1px solid ${(consent as any)[item.key] ? meta.color + '55' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={(consent as any)[item.key]}
                    onChange={e => setConsent(c => ({ ...c, [item.key]: e.target.checked }))}
                    style={{ marginTop: 2, accentColor: meta.color, width: 16, height: 16, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{item.desc}</div>
                  </div>
                </label>
              ))}
              <label style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: `${meta.bg}`, border: `1px solid ${meta.border}`, borderRadius: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consent.required1 && consent.required2 && consent.marketing}
                  onChange={e => setConsent({ required1: e.target.checked, required2: e.target.checked, marketing: e.target.checked })}
                  style={{ accentColor: meta.color, width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>전체 동의</span>
              </label>
            </div>

            <button
              onClick={() => {
                if (!consent.required1 || !consent.required2) { setError('필수 약관에 동의해주세요'); return }
                setError(''); setStep(2)
              }}
              style={{ width: '100%', padding: '15px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, color: meta.color, fontSize: 15, fontWeight: 700, marginTop: 20 }}
            >
              다음 →
            </button>
            {error && <div style={{ marginTop: 10, fontSize: 12, color: '#e08080', textAlign: 'center' }}>{error}</div>}
          </div>
        )}

        {/* STEP 2: 정보 입력 */}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>정보를 입력해주세요</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>{meta.icon} {meta.label}으로 가입합니다</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>이름 *</label>{inp('name', form.name, v => setForm(f => ({ ...f, name: v })), { placeholder: '실명 입력', required: true })}</div>
              <div><label style={labelStyle}>이메일 *</label>{inp('email', form.email, v => setForm(f => ({ ...f, email: v })), { type: 'email', placeholder: 'example@email.com', required: true })}</div>
              <div><label style={labelStyle}>비밀번호 * (6자 이상)</label>{inp('pw', form.password, v => setForm(f => ({ ...f, password: v })), { type: 'password', placeholder: '6자 이상 입력', required: true })}</div>
              <div><label style={labelStyle}>비밀번호 확인 *</label>{inp('pw2', form.passwordConfirm, v => setForm(f => ({ ...f, passwordConfirm: v })), { type: 'password', placeholder: '비밀번호 재입력', required: true })}</div>
              <div><label style={labelStyle}>휴대폰 번호</label>{inp('phone', form.phone, v => setForm(f => ({ ...f, phone: v })), { type: 'tel', placeholder: '010-0000-0000' })}</div>
            </div>

            {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>{error}</div>}

            <button
              onClick={() => {
                if (!form.name || !form.email || !form.password) { setError('필수 항목을 입력해주세요'); return }
                handleSignup()
              }}
              disabled={loading}
              style={{ width: '100%', padding: '15px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, color: meta.color, fontSize: 15, fontWeight: 700, marginTop: 20, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '가입 중...' : '✅ 가입 완료'}
            </button>
          </div>
        )}

        {/* STEP 3: 완료 */}
        {step === 3 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>🎉</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>가입 완료!</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 8 }}>
              {form.name}님, AURAN에 오신 걸 환영합니다.<br />
              이메일 인증 후 로그인해주세요.
            </div>
            <div style={{ padding: '12px 16px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--gold)', marginBottom: 28 }}>
              🎁 가입 포인트 500P가 적립됩니다!
            </div>
            <button
              onClick={() => router.push(`/login?role=${role}`)}
              style={{ width: '100%', padding: '15px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, color: meta.color, fontSize: 15, fontWeight: 700 }}
            >
              로그인하기 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
