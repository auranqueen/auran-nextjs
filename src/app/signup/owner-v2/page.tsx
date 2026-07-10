'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { POSITION_STORAGE_KEY } from '@/lib/position'

const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const META = {
  label: '원장님',
  icon: '🏥',
  color: '#bf5f90',
  border: 'rgba(191,95,144,0.35)',
  bg: 'rgba(191,95,144,0.08)',
}

function OwnerSignupV2Form() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const ref = params.get('ref') || ''
  const brandId = params.get('brand_id') || ''

  const [brandInviteLabel, setBrandInviteLabel] = useState('')
  const [form, setForm] = useState({
    storeName: '',
    area: '',
    address: '',
    addressDetail: '',
    phone: '',
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorStage, setErrorStage] = useState('')

  useEffect(() => {
    if (!brandId) {
      setBrandInviteLabel('')
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('brands')
        .select('name, brand_name_kr')
        .eq('id', brandId)
        .maybeSingle()
      if (cancelled) return
      if (!data) {
        setBrandInviteLabel('')
        return
      }
      const label = String((data as { brand_name_kr?: string; name?: string }).brand_name_kr || (data as { name?: string }).name || '').trim()
      setBrandInviteLabel(label)
    })()
    return () => { cancelled = true }
  }, [brandId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).daum?.Postcode) return
    const existing = document.querySelector('script[data-daum-postcode="true"]')
    if (existing) return
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.setAttribute('data-daum-postcode', 'true')
    document.body.appendChild(script)
  }, [])

  const openAddressSearch = () => {
    const Postcode = (window as any).daum?.Postcode
    if (!Postcode) {
      setError('주소 검색을 불러오는 중이에요. 잠시 후 다시 시도해주세요.')
      setErrorStage('client')
      return
    }
    new Postcode({
      oncomplete: (data: { address: string; sido: string; sigungu: string }) => {
        setForm((f) => ({
          ...f,
          address: data.address || '',
          area: [data.sido, data.sigungu].filter(Boolean).join(' ') || f.area,
        }))
        setError('')
        setErrorStage('')
      },
    }).open()
  }

  const inp = (
    id: keyof typeof form,
    label: string,
    opts: { type?: string; placeholder?: string; required?: boolean } = {},
  ) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, display: 'block', fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
      </label>
      <input
        type={opts.type || 'text'}
        value={form[id]}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
        placeholder={opts.placeholder}
        required={opts.required}
        style={{
          width: '100%',
          background: 'var(--bg3)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '13px 14px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.target.style.borderColor = META.color }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
      />
    </div>
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setErrorStage('')

    if (!agreed) {
      setError('서비스 이용약관 및 개인정보 처리에 동의해주세요.')
      setErrorStage('validate')
      return
    }
    if (!form.storeName.trim()) {
      setError('매장명(상호명)을 입력해주세요.')
      setErrorStage('validate')
      return
    }
    if (!form.address.trim()) {
      setError('주소를 입력해주세요.')
      setErrorStage('validate')
      return
    }
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError('이름, 이메일, 비밀번호를 입력해주세요.')
      setErrorStage('validate')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.')
      setErrorStage('validate')
      return
    }
    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않아요.')
      setErrorStage('validate')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/owner-signup-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          storeName: form.storeName.trim(),
          area: form.area.trim(),
          address: form.address.trim(),
          addressDetail: form.addressDetail.trim(),
          phone: form.phone.trim(),
          ref: ref || undefined,
          brand_id: brandId || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        setError(typeof json?.error === 'string' ? json.error : '가입 처리에 실패했어요.')
        setErrorStage(typeof json?.stage === 'string' ? json.stage : 'unknown')
        return
      }

      const authEmail = form.email.includes('@') ? form.email.trim() : `${form.email.trim()}@auran.kr`
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: form.password,
      })

      if (!signInError) {
        try {
          localStorage.setItem(POSITION_STORAGE_KEY, 'salon')
          localStorage.setItem('auran_position', 'salon')
        } catch {
          /* ignore */
        }
        router.replace('/dashboard/owner')
        return
      }

      router.replace('/login?role=owner')
    } catch (err: any) {
      setError(err?.message || '가입 중 오류가 발생했어요.')
      setErrorStage('client')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 40px' }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{META.icon}</div>
          <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 20, color: 'var(--text)' }}>
            {META.label} 회원가입
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.6 }}>
            매장 정보와 계정을 한 번에 등록해요
          </div>
          {brandId ? (
            <div style={{ marginTop: 10, fontSize: 12, color: PURPLE, lineHeight: 1.55 }}>
              {brandInviteLabel
                ? `${brandInviteLabel} 브랜드 제휴 초대로 가입 중이에요`
                : '브랜드 제휴 초대로 가입 중이에요'}
            </div>
          ) : null}
          {ref ? (
            <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text3)', fontFamily: "'JetBrains Mono', monospace" }}>
              초대 코드: {ref}
            </div>
          ) : null}
        </div>

        {(error || errorStage) ? (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid rgba(217,79,79,0.35)',
              background: 'rgba(217,79,79,0.08)',
              fontSize: 12,
              color: '#f0a0a0',
              lineHeight: 1.55,
            }}
          >
            {errorStage ? <div style={{ fontSize: 10, color: 'rgba(240,160,160,0.75)', marginBottom: 4 }}>stage: {errorStage}</div> : null}
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          {inp('storeName', '매장명(상호명) *', { placeholder: '예: La Poudre d\'Or', required: true })}
          {inp('area', '지역', { placeholder: '예: 서울 강남구' })}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, display: 'block', fontFamily: "'JetBrains Mono', monospace" }}>
              주소 *
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="주소 검색 또는 직접 입력"
                required
                style={{
                  flex: 1,
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '13px 14px',
                  color: 'var(--text)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={openAddressSearch}
                style={{
                  flexShrink: 0,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: `1px solid ${PURPLE}55`,
                  background: 'rgba(123,94,167,0.12)',
                  color: PURPLE,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                주소검색
              </button>
            </div>
            <input
              value={form.addressDetail}
              onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
              placeholder="상세주소 (동/호수)"
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '13px 14px',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {inp('phone', '전화번호', { type: 'tel', placeholder: '01012345678' })}
          {inp('name', '대표자 이름 *', { placeholder: '실명', required: true })}
          {inp('email', '아이디(이메일) *', { placeholder: '예: lapoudredor 또는 lapoudredor@auran.kr', required: true })}
          {inp('password', '비밀번호 *', { type: 'password', placeholder: '6자 이상', required: true })}
          {inp('passwordConfirm', '비밀번호 확인 *', { type: 'password', required: true })}

          <label
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '12px 14px',
              marginBottom: 16,
              background: 'var(--bg3)',
              border: `1px solid ${agreed ? `${PURPLE}55` : 'var(--border)'}`,
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ accentColor: PURPLE, width: 16, height: 16, marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.55 }}>
              [필수] 서비스 이용약관 및 개인정보 수집·이용에 동의합니다
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: 12,
              border: `1px solid ${META.border}`,
              background: META.bg,
              color: META.color,
              fontSize: 15,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '가입 처리 중...' : '가입 완료'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text3)' }}>
            이미 계정이 있으신가요?{' '}
            <button
              type="button"
              onClick={() => router.push('/login?role=owner')}
              style={{ background: 'none', border: 'none', color: GOLD, fontSize: 12, cursor: 'pointer' }}
            >
              로그인 →
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OwnerSignupV2Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <OwnerSignupV2Form />
    </Suspense>
  )
}
