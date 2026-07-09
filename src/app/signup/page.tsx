'use client'
import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'
import { TrackType } from '@/lib/hormoneUtils'
import OwnerStoreStep from './OwnerStoreStep'

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
  const mode = params.get('mode') || ''
  const meta = ROLE_META[role] || ROLE_META.customer

  const [step, setStep] = useState(1) // 1: 정보입력 2: 온보딩 3: 완료
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '', phone: '', storeName: '' })
  const [consent, setConsent] = useState({ required1: false, required2: false, marketing: false, research: false })
  const [termsModalKey, setTermsModalKey] = useState<string | null>(null)
  const [track, setTrack] = useState<TrackType>('general')
  const [cycleLength, setCycleLength] = useState('28')
  const [lastPeriodDate, setLastPeriodDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [isBreastfeeding, setIsBreastfeeding] = useState(false)
  const [cycleType, setCycleType] = useState<string | null>(null)
  const [menopauseReason, setMenopauseReason] = useState('')
  useEffect(() => {
    const t = localStorage.getItem('auran_track')
    const c = localStorage.getItem('auran_cycle_type')
    const cl = localStorage.getItem('auran_cycle_length')
    const lp = localStorage.getItem('auran_last_period')
    if (t) setTrack(t as TrackType)
    if (c) setCycleType(c)
    if (cl) setCycleLength(cl)
    if (lp) setLastPeriodDate(lp)
    const mr = localStorage.getItem('auran_menopause_reason')
    if (mr) setMenopauseReason(mr)
  }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ownerSlug, setOwnerSlug] = useState('')
  const [ownerSlugCopied, setOwnerSlugCopied] = useState(false)
  const [ownerStoreStep, setOwnerStoreStep] = useState(false)
  const [hasOfflineStore, setHasOfflineStore] = useState<boolean | null>(null)
  const [storeType, setStoreType] = useState('')
  const [ownerStoreAddress, setOwnerStoreAddress] = useState('')
  const [ownerStoreArea, setOwnerStoreArea] = useState('')
  const { getSettingNum } = useAdminSettings()
  const [signupWelcomePoint, setSignupWelcomePoint] = useState(() =>
    getSettingNum('points_action', 'signup_welcome', 10000)
  )

  useEffect(() => {
    if (mode === 'track') setStep(2)
  }, [mode])

  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      const { data: psRow } = await supabase
        .from('point_settings')
        .select('points')
        .eq('action', 'signup')
        .maybeSingle()
      setSignupWelcomePoint(
        psRow?.points
          ? Math.max(0, Math.floor(Number(psRow.points)))
          : getSettingNum('points_action', 'signup_welcome', 10000)
      )
    })()
  }, [getSettingNum])

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
      const authEmail = form.email.includes('@') ? form.email.trim() : `${form.email.trim()}@auran.kr`
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: authEmail,
        password: form.password,
        options: {
          data: {
            name: form.name,
            role,
            phone: form.phone,
            invite_code: inviteCode || undefined,
            onboarding_track: track,
            onboarding_cycle_length: cycleLength,
            onboarding_last_period_date: lastPeriodDate || undefined,
            onboarding_due_date: dueDate || undefined,
            onboarding_delivery_date: deliveryDate || undefined,
            onboarding_breastfeeding: isBreastfeeding,
          },
        },
      })
      if (authErr) throw authErr

      if (authData.user && !authData.session) {
        try {
          const expectedPeriodDate =
            track === 'general' && lastPeriodDate
              ? (() => {
                  const d = new Date(lastPeriodDate)
                  d.setDate(d.getDate() + Math.max(21, Math.min(60, Number(cycleLength || 28))))
                  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
                })()
              : null
          const payload: any = {
            auth_id: authData.user.id,
            track,
            cycle_length: track === 'general' ? Math.max(21, Math.min(60, Number(cycleLength || 28))) : null,
            last_period_date: track === 'general' || track === 'menopause_peri' ? (lastPeriodDate || null) : null,
            due_date: track === 'pregnant' ? (dueDate || null) : null,
            delivery_date: track === 'postpartum' ? (deliveryDate || null) : null,
            breastfeeding: track === 'postpartum' ? isBreastfeeding : null,
            expected_period_date: expectedPeriodDate,
            menopause_reason: (track === 'menopause_peri' || track === 'menopause_post') ? (menopauseReason || null) : null,
            updated_at: new Date().toISOString(),
          }
          await supabase.from('hormone_cycle').upsert(payload, { onConflict: 'auth_id' })
          if (cycleType) {
            await supabase.from('profiles').upsert(
              { auth_id: authData.user.id, email: authEmail, cycle_type: cycleType, research_consent: localStorage.getItem('auran_research_consent') === 'true', marketing_agreed: localStorage.getItem('auran_marketing_consent') === 'true', birth_date: localStorage.getItem('auran_birth_date') || null, gender: localStorage.getItem('auran_gender') || null, skin_type: localStorage.getItem('auran_skin_type') || null } as any,
              { onConflict: 'auth_id' }
            )
          }
        } catch {}
        // 이메일 인증 필요 시 세션이 없음 → 인증 대기 화면으로
        if (mode === 'track') {
          router.replace('/')
          return
        }
        router.push(`/auth/done?position=${encodeURIComponent(role)}`)
        return
      }
      if (authData.user && authData.session) {
        // 인증 없이 즉시 세션 발급된 경우(설정에 따라): users 저장 후 완료
        const referralCode = Math.random().toString(36).slice(2, 8).toUpperCase()
        const status = role === 'customer' ? 'active' : 'pending'
        let referredByUserId: string | null = null
        if (inviteCode) {
          const { data: linkRow } = await supabase
            .from('invite_links')
            .select('created_by')
            .eq('code', inviteCode)
            .maybeSingle()

          if (linkRow?.created_by) {
            referredByUserId = linkRow.created_by
          } else {
            const { data: refUser } = await supabase
              .from('users')
              .select('id')
              .eq('referral_code', inviteCode)
              .maybeSingle()
            referredByUserId = refUser?.id || null
          }
        }
        const { data: newUserRow, error: newUserInsertErr } = await supabase
          .from('users')
          .insert({
            auth_id: authData.user.id,
            email: authEmail,
            name: form.name,
            phone: form.phone,
            role,
            provider: 'email',
            referral_code: referralCode,
            referred_by: referredByUserId || null,
            status,
            points: 0,
            charge_balance: 0,
          })
          .select('id')
          .single()
        if (newUserInsertErr) {
          console.warn('[users insert]', newUserInsertErr)
        }
        if (role === 'owner' && authData.user) {
          const { data: profRow } = await supabase.from('profiles').select('slug, owner_store_name').eq('auth_id', authData.user.id).maybeSingle()
          let createdSlug = profRow?.slug ? String(profRow.slug) : ''
          if (!createdSlug) {
            const nameTrim = String(profRow?.owner_store_name || form.storeName || form.name || '').trim()
            if (nameTrim) {
              let base = nameTrim.toLowerCase().replace(/[^a-z0-9]/g, '')
              if (!base) base = 'owner' + Math.random().toString(16).slice(2, 10)
              let candidate = base
              for (let suffix = 1; suffix < 1000; suffix++) {
                const { data: taken } = await supabase.from('profiles').select('auth_id').eq('slug', candidate).neq('auth_id', authData.user.id).maybeSingle()
                if (!taken) break
                candidate = `${base}${suffix}`
              }
              createdSlug = candidate
            }
          }
          const profilePayload: Record<string, unknown> = {
            auth_id: authData.user.id,
            email: authEmail,
            full_name: form.name,
            role: 'owner',
            owner_store_name: form.storeName || undefined,
            has_offline_store: hasOfflineStore,
            store_type: hasOfflineStore ? (storeType || null) : null,
          }
          if (createdSlug && !profRow?.slug) profilePayload.slug = createdSlug
          await supabase.from('profiles').upsert(profilePayload as any, { onConflict: 'auth_id' })
          if (createdSlug) setOwnerSlug(createdSlug)
          if (newUserRow?.id) {
            await supabase.from('salons').insert({
              owner_id: newUserRow.id,
              name: (form.storeName || form.name).trim(),
              area: ownerStoreArea.trim() || null,
              address: ownerStoreAddress.trim() || null,
              status: 'pending',
            })
          }
        }
        if (inviteCode) {
          await supabase.from('invite_links').update({ used_count: supabase.rpc('increment', { row_id: inviteCode }) }).eq('code', inviteCode)
        }
        await supabase.from('traffic_logs').insert({
          user_id: authData.user.id,
          source: inviteCode ? 'partner' : 'direct',
          invite_code: inviteCode || null,
          action: 'signup',
        })
      }
      if (authData.user) {
        const expectedPeriodDate =
          track === 'general' && lastPeriodDate
            ? (() => {
                const d = new Date(lastPeriodDate)
                d.setDate(d.getDate() + Math.max(21, Math.min(60, Number(cycleLength || 28))))
                return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
              })()
            : null
        const payload: any = {
          auth_id: authData.user.id,
          track,
          cycle_length: track === 'general' ? Math.max(21, Math.min(60, Number(cycleLength || 28))) : null,
          last_period_date: track === 'general' || track === 'menopause_peri' ? (lastPeriodDate || null) : null,
          due_date: track === 'pregnant' ? (dueDate || null) : null,
          delivery_date: track === 'postpartum' ? (deliveryDate || null) : null,
          breastfeeding: track === 'postpartum' ? isBreastfeeding : null,
          expected_period_date: expectedPeriodDate,
          menopause_reason: (track === 'menopause_peri' || track === 'menopause_post') ? (menopauseReason || null) : null,
          updated_at: new Date().toISOString(),
        }
        const { error: hcErr } = await supabase.from('hormone_cycle').upsert(payload, { onConflict: 'auth_id' })
        if (hcErr) {
          await supabase.from('hormone_cycle').insert(payload)
        }
        if (cycleType) {
          await supabase.from('profiles').upsert(
            { auth_id: authData.user.id, email: authEmail, cycle_type: cycleType, research_consent: localStorage.getItem('auran_research_consent') === 'true', marketing_agreed: localStorage.getItem('auran_marketing_consent') === 'true', birth_date: localStorage.getItem('auran_birth_date') || null, gender: localStorage.getItem('auran_gender') || null, skin_type: localStorage.getItem('auran_skin_type') || null } as any,
            { onConflict: 'auth_id' }
          )
        }
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
  const uiStep = role === 'owner' && ownerStoreStep ? 2 : step

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
      {/* 헤더 */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => {
          if (role === 'owner' && ownerStoreStep) { setOwnerStoreStep(false); setError(''); return }
          if (step > 1) setStep(s => s - 1)
          else router.push(`/signup/consent?role=${role}`)
        }}
          style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 22 }}>‹</button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: meta.color }}>
          AURAN · {meta.label.toUpperCase()} 회원가입
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>{uiStep}/3</div>
      </div>

      {/* 스텝 바 */}
      <div style={{ padding: '0 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= uiStep ? meta.color : 'var(--bg3)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          {['정보 입력', '온보딩', '가입 완료'].map((l, i) => (
            <span key={i} style={{ fontSize: 9, color: i + 1 <= uiStep ? meta.color : 'var(--text3)' }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 24px calc(40px + env(safe-area-inset-bottom, 0px))' }}>

        {/* STEP 1: 정보 입력 */}
        {step === 1 && !(role === 'owner' && ownerStoreStep) && (
          <div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>정보를 입력해주세요</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 24 }}>{meta.icon} {meta.label}으로 가입합니다</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={labelStyle}>이름 또는 닉네임 *</label>{inp('name', form.name, v => setForm(f => ({ ...f, name: v })), { placeholder: '실명 입력', required: true })}</div>
              {role === 'owner' && (
                <div>
                  <label style={labelStyle}>상호명(매장명) *</label>
                  {inp('storeName', form.storeName, v => setForm(f => ({ ...f, storeName: v })), { placeholder: '매장명 입력', required: true })}
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4, lineHeight: 1.4 }}>
                    실제 상호명을 입력해주세요 — 매장/스토어 화면에 그대로 표기됩니다
                  </div>
                </div>
              )}
              <div><label style={labelStyle}>아이디 *</label>{inp('email', form.email, v => setForm(f => ({ ...f, email: v })), { type: 'text', placeholder: '아이디', required: true })}</div>
              <div><label style={labelStyle}>비밀번호 * (6자 이상)</label>{inp('pw', form.password, v => setForm(f => ({ ...f, password: v })), { type: 'password', placeholder: '6자 이상 입력', required: true })}</div>
              <div><label style={labelStyle}>비밀번호 확인 *</label>{inp('pw2', form.passwordConfirm, v => setForm(f => ({ ...f, passwordConfirm: v })), { type: 'password', placeholder: '비밀번호 재입력', required: true })}</div>
              <div><label style={labelStyle}>휴대폰 번호</label>{inp('phone', form.phone, v => setForm(f => ({ ...f, phone: v })), { type: 'tel', placeholder: '010-0000-0000' })}</div>
            </div>

            {error && <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(217,79,79,0.1)', border: '1px solid rgba(217,79,79,0.3)', borderRadius: 8, fontSize: 12, color: '#e08080' }}>{error}</div>}

            <button
              onClick={() => {
                if (!form.name || !form.email || !form.password) { setError('필수 항목을 입력해주세요'); return }
                if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다'); return }
                if (form.password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다'); return }
                const savedGender = localStorage.getItem('auran_gender') || ''
                const savedCycleType = localStorage.getItem('auran_cycle_type') || ''
                if (savedGender === '남성' || savedGender === 'male' || savedCycleType === 'male') {
                  setCycleType('male')
                  setTrack('male')
                }
                if (role === 'owner') {
                  if (!form.storeName.trim()) { setError('상호명을 입력해주세요'); return }
                  setOwnerStoreStep(true)
                  setError('')
                  return
                }
                handleSignup()
              }}
              disabled={loading}
              style={{ width: '100%', padding: '15px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 12, color: meta.color, fontSize: 15, fontWeight: 700, marginTop: 20, opacity: loading ? 0.7 : 1 }}
            >
              다음 →
            </button>
          </div>
        )}

        {step === 1 && role === 'owner' && ownerStoreStep && (
          <OwnerStoreStep
            hasOfflineStore={hasOfflineStore}
            setHasOfflineStore={setHasOfflineStore}
            storeType={storeType}
            setStoreType={setStoreType}
            ownerStoreAddress={ownerStoreAddress}
            setOwnerStoreAddress={setOwnerStoreAddress}
            ownerStoreArea={ownerStoreArea}
            setOwnerStoreArea={setOwnerStoreArea}
            error={error}
            loading={loading}
            meta={meta}
            onSubmit={() => {
              if (hasOfflineStore === null) { setError('오프라인 매장 유무를 선택해주세요'); return }
              if (hasOfflineStore && !storeType) { setError('업종을 선택해주세요'); return }
              if (!ownerStoreAddress.trim()) { setError('주소를 입력해주세요'); return }
              setError('')
              handleSignup()
            }}
          />
        )}

        {/* STEP 3: 완료 (이메일 인증 비활성 시에만 표시) */}
        {step === 3 && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>🎉</div>
            <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>가입 완료!</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 8 }}>
              {form.name}님, AURAN에 오신 걸 환영합니다.
            </div>
            <div style={{ padding: '12px 16px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--gold)', marginBottom: 28 }}>
              {role === 'customer'
                ? `환영해요! 🎉 +${signupWelcomePoint.toLocaleString()}P가 적립됐어요`
                : '회원가입이 완료됐어요! 🎉'}
            </div>
            {role === 'owner' && ownerSlug ? (
              <div style={{ padding: '14px 16px', background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 10, marginBottom: 16, textAlign: 'left' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>내 전용 로그인 주소</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 13, color: meta.color, wordBreak: 'break-all' }}>auran.kr/owner/{ownerSlug}</div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(`https://auran.kr/owner/${ownerSlug}`)
                      setOwnerSlugCopied(true)
                      setTimeout(() => setOwnerSlugCopied(false), 2000)
                    }}
                    style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 8, border: `1px solid ${meta.border}`, background: 'transparent', color: meta.color, fontSize: 11, cursor: 'pointer' }}
                  >
                    {ownerSlugCopied ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
            ) : null}
            <div style={{ padding: '14px 16px', background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 10, fontSize: 12, color: '#7B5EA7', marginBottom: 16, lineHeight: 1.7, textAlign: 'left' }}>
              💜 프로필을 완성하면 호르몬 사이클에 맞춘 케어가 더 정교해져요<br />
              지금 바로 내 피부 타입과 고민을 알려주세요
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
