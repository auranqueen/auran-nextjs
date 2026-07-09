'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TERMS: Record<string, { title: string; content: string }> = {
  required1: {
    title: '개인정보 수집·이용 동의',
    content: `수집 항목: 이름, 이메일, 비밀번호, 생년월일, 성별 (필수) / 프로필 사진, 피부타입, 피부 고민 (선택)

수집 목적: 회원 식별 및 서비스 제공 / 주문·결제·배송 처리 / 고객 문의 응대

보유 기간: 회원 탈퇴 시 즉시 파기
· 계약·청약철회 기록: 5년 (전자상거래법)
· 대금결제·재화공급 기록: 5년 (전자상거래법)
· 소비자 불만·분쟁처리 기록: 3년 (전자상거래법)
· 접속 로그: 3개월 (통신비밀보호법)

동의 거부 시 회원가입이 제한될 수 있습니다.`
  },
  required2: {
    title: '민감정보 처리 동의',
    content: `수집 항목: 호르몬 주기 정보, 피부 상태 기록, 건강 관련 고민

수집 목적: 호르몬 주기 기반 개인화 피부 케어 서비스 제공 / 맞춤형 제품 추천

보유 기간: 회원 탈퇴 시 즉시 파기

위 민감정보는 서비스 제공 목적 외에 사용되지 않습니다.
동의 거부 시 호르몬 주기 기반 맞춤 추천 서비스 이용이 제한될 수 있습니다.`
  },
  marketing: {
    title: '마케팅 정보 수신 동의',
    content: `수집 항목: 이메일, 휴대폰 번호

활용 목적: 신제품·이벤트·프로모션 안내 / 맞춤형 혜택 및 할인 정보 발송

발송 채널: 앱 푸시, 이메일, SMS/카카오 알림톡

보유 기간: 동의 철회 시까지 (미이용 시 2년 후 파기 또는 재동의 요청)

동의 거부 시에도 서비스 이용에 불이익이 없습니다.
수신 동의 후에도 앱 설정에서 언제든지 철회 가능합니다.`
  },
  research: {
    title: '피부 연구 목적 익명 활용 동의',
    content: `수집 항목: 호르몬 주기, 피부 상태 기록, 루틴 이행 기록, 식욕·수면·기분 등 페이즈 경험 기록

활용 목적: 호르몬 주기 기반 피부 과학 연구 / 서비스 추천 알고리즘 개선 / 학술 연구 및 논문 활용 (익명 처리 후)

익명화 처리: 연구 활용 시 개인을 식별할 수 없도록 익명 처리 후 사용됩니다. 원본 개인정보와 분리 보관됩니다.

제3자 제공: 익명 처리된 데이터에 한하여 대학 연구기관, 피부과학 연구팀에 제공될 수 있습니다.

보유 기간: 동의 철회 시까지. 철회 후 익명 데이터는 연구 목적상 삭제되지 않을 수 있습니다.

동의 거부 시 서비스 이용에 불이익이 없습니다.
기록이 쌓일수록 오렌이 나를 더 잘 알아가요 💜`
  }
}

function ConsentInner() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()
  const role = params.get('role') || 'customer'
  const provider = params.get('provider') || ''
  const [consent, setConsent] = useState({ required1: false, required2: false, marketing: false, research: false })
  const [modalKey, setModalKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allRequired = consent.required1 && consent.required2

  useEffect(() => {
    if (role !== 'customer') return
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      window.location.href = '/auth/done?position=customer'
    })()
  }, [role])

  const handleSubmit = async (providerOverride?: string) => {
    const finalProvider = providerOverride !== undefined ? providerOverride : provider
    if (!allRequired) { setError('필수 약관에 동의해주세요'); return }
    setLoading(true)
    try {
      localStorage.setItem('auran_research_consent', consent.research ? 'true' : 'false')
      localStorage.setItem('auran_marketing_consent', consent.marketing ? 'true' : 'false')

      if (role === 'owner' || role === 'partner' || role === 'brand') {
        window.location.href = `/signup?role=${role}`
      } else {
        window.location.href = `/signup/onboarding?provider=${finalProvider}&role=${role}&marketing=${consent.marketing ? 'true' : 'false'}&research=${consent.research ? 'true' : 'false'}`
      }
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const items = [
    { key: 'required1', label: '[필수] 개인정보 수집·이용 동의' },
    { key: 'required2', label: '[필수] 민감정보 처리 동의' },
    { key: 'marketing', label: '[선택] 마케팅 정보 수신 동의' },
    { key: 'research', label: '[선택] 피부 연구 목적 익명 활용 동의' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', paddingLeft: 24, paddingRight: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 16, whiteSpace: 'nowrap', color: 'var(--text)', marginBottom: 6, textAlign: 'center' }}>오렌에 오신 걸 환영해요 💜</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 28, textAlign: 'center' }}>서비스 이용을 위해 약관에 동의해주세요</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {items.map(item => (
            <label key={item.key} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '13px 14px', background: 'var(--bg3)', border: `1px solid ${(consent as any)[item.key] ? '#7B5EA755' : 'var(--border)'}`, borderRadius: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={(consent as any)[item.key]}
                onChange={e => setConsent(c => ({ ...c, [item.key]: e.target.checked }))}
                style={{ accentColor: '#7B5EA7', width: 16, height: 16, flexShrink: 0 }}
              />
              <div style={{ flex: 1, fontSize: 11, color: 'var(--text)' }}>{item.label}</div>
              <button
                type="button"
                onClick={e => { e.preventDefault(); setModalKey(item.key) }}
                style={{ fontSize: 10, color: '#7B5EA7', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >보기</button>
            </label>
          ))}
        </div>

        <label style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 10, cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={consent.required1 && consent.required2 && consent.marketing && consent.research}
            onChange={e => setConsent({ required1: e.target.checked, required2: e.target.checked, marketing: e.target.checked, research: e.target.checked })}
            style={{ accentColor: '#7B5EA7', width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13, color: '#7B5EA7' }}>전체 동의</span>
        </label>

        {error && <div style={{ fontSize: 12, color: '#e08080', textAlign: 'center', marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {role !== 'owner' && role !== 'partner' && role !== 'brand' && (
            <>
              <button
                onClick={() => { if (!allRequired) { setError('필수 약관에 동의해주세요'); return } handleSubmit('kakao') }}
                disabled={loading}
                style={{ width: '100%', padding: 14, background: '#FEE500', border: 'none', borderRadius: 12, color: '#3C1E1E', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                💬 카카오로 시작하기
              </button>
              <button
                onClick={() => { if (!allRequired) { setError('필수 약관에 동의해주세요'); return } handleSubmit('google') }}
                disabled={loading}
                style={{ width: '100%', padding: 14, background: '#fff', border: '1px solid #ddd', borderRadius: 12, color: '#333', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                G 구글로 시작하기
              </button>
            </>
          )}
          <button
            onClick={() => { if (!allRequired) { setError('필수 약관에 동의해주세요'); return } handleSubmit('') }}
            disabled={loading}
            style={{ width: '100%', padding: 14, background: 'var(--bg3)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 12, color: 'var(--text)', fontSize: 15, cursor: 'pointer' }}
          >
            {loading ? '처리중...' : '아이디로 시작하기'}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: '#e08080', textAlign: 'center', marginTop: 10 }}>{error}</div>}
      </div>

      {modalKey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%', maxHeight: '70vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setModalKey(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text3)' }}>✕</button>
            <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 16 }}>{TERMS[modalKey]?.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{TERMS[modalKey]?.content}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentInner />
    </Suspense>
  )
}
