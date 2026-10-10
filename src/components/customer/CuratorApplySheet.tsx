'use client'

import { useEffect, useState } from 'react'
import SlideUpSheet from '@/components/ui/SlideUpSheet'

const GOLD = 'var(--gold)'
const BG = 'var(--bg)'
const CARD_BG = 'rgba(var(--fg-rgb),0.03)'
const CARD_BORDER = '1px solid rgba(var(--fg-rgb),0.07)'
const TEXT = 'rgba(var(--fg-rgb),0.85)'
const TEXT_MUTED = 'rgba(var(--fg-rgb),0.4)'

const CATEGORIES = ['스킨케어', '메이크업', '피부관리', '바디케어', '네일헤어', '에스테틱']
const BANKS = [
  'KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', 'SC제일은행', '카카오뱅크',
  '토스뱅크', '케이뱅크', '새마을금고', '우체국', '수협은행', '신협', '부산은행', '대구은행(iM뱅크)',
  '경남은행', '광주은행', '전북은행', '제주은행', '한국씨티은행',
]
const AGREEMENTS = [
  { key: 'terms', label: '큐레이터 이용약관 동의' },
  { key: 'privacy', label: '개인정보 수집·이용 동의 (원천징수 정산용)' },
  { key: 'condition', label: '월 4건 미만 시 자격 중지 및 수익 미발생 조건 확인' },
] as const
type AgreeKey = (typeof AGREEMENTS)[number]['key']

const ERRORS: Record<string, string> = {
  already_applied: '이미 진행 중이거나 승인된 신청이 있어요.',
  invalid_email: '이메일 형식을 확인해 주세요.',
  intro_too_short: '자기소개를 30자 이상 입력해 주세요.',
  invalid_bank: '정산 계좌 정보를 확인해 주세요.',
  invalid_rrn: '주민번호 앞 6자리와 뒷 1자리를 확인해 주세요.',
  not_logged_in: '로그인이 필요해요.',
}

type Status = { status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string } | null

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: CARD_BG, border: CARD_BORDER, borderRadius: 10,
  padding: '11px 12px', fontSize: 13, color: TEXT, outline: 'none',
}
const lbl: React.CSSProperties = { fontSize: 12, color: TEXT_MUTED, marginBottom: 6, marginTop: 16 }

interface Props {
  open: boolean
  onClose: () => void
}

export default function CuratorApplySheet({ open, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<Status>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [bankOpen, setBankOpen] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [channelUrl, setChannelUrl] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [intro, setIntro] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [rrnFront, setRrnFront] = useState('')
  const [rrnBack, setRrnBack] = useState('')
  const [agree, setAgree] = useState<Record<AgreeKey, boolean>>({ terms: false, privacy: false, condition: false })

  // [ANCHOR: curator-apply-load-status]
  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setDone(false)
    setError('')
    fetch('/api/curator/apply')
      .then(r => (r.ok ? r.json() : null))
      .then((j: { application?: Status; email?: string } | null) => {
        if (!alive) return
        setCurrent(j?.application ?? null)
        if (j?.email) setEmail(prev => prev || j.email || '')
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [open])

  const toggleCategory = (c: string) =>
    setCategories(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))

  const urlOk = (v: string) => !v.trim() || /^https?:\/\//i.test(v.trim())
  const canSubmit =
    !!displayName.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    categories.length > 0 &&
    intro.trim().length >= 30 &&
    urlOk(channelUrl) &&
    urlOk(portfolioUrl) &&
    !!bankHolder.trim() &&
    !!bankName &&
    bankAccount.replace(/[^0-9]/g, '').length >= 8 &&
    /^\d{6}$/.test(rrnFront) &&
    /^[1-8]$/.test(rrnBack) &&
    agree.terms && agree.privacy && agree.condition

  // [ANCHOR: curator-apply-submit]
  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/curator/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        email,
        instagram,
        channel_url: channelUrl,
        categories,
        intro,
        portfolio_url: portfolioUrl,
        bank_holder: bankHolder,
        bank_name: bankName,
        bank_account: bankAccount,
        rrn_front: rrnFront,
        rrn_back_first: rrnBack,
        agree_terms: agree.terms,
        agree_privacy: agree.privacy,
        agree_condition: agree.condition,
      }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    setSubmitting(false)
    if (!res?.ok || !json?.ok) {
      setError(ERRORS[json?.error ?? ''] ?? '신청하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setDone(true)
  }

  const notice = (icon: string, title: string, desc: string) => (
    <div style={{ textAlign: 'center', padding: '60px 8px 24px' }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 18, color: TEXT, marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{desc}</div>
      <button
        type="button"
        onClick={onClose}
        style={{ marginTop: 28, width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', background: GOLD, color: BG, fontSize: 14, cursor: 'pointer' }}
      >
        확인
      </button>
    </div>
  )

  const body = () => {
    if (loading) return <div style={{ textAlign: 'center', padding: 60, fontSize: 13, color: TEXT_MUTED }}>불러오는 중…</div>
    if (done) return notice('✦', '신청 접수됐어요!', '검토 후 3~5 영업일 내에\n입력하신 이메일로 결과를 안내드릴게요.')
    if (current?.status === 'pending') return notice('⏳', '검토 중이에요', '이미 접수된 신청이 있어요.\n3~5 영업일 내에 이메일로 안내드릴게요.')
    if (current?.status === 'approved') return notice('✦', '이미 큐레이터예요', '큐레이터 대시보드에서 활동을 시작해 보세요.')

    return (
      <>
        {current?.status === 'rejected' && (
          <div style={{ background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: TEXT, lineHeight: 1.5, marginBottom: 4 }}>
            이전 신청이 반려됐어요.{current.admin_note ? ` 사유: ${current.admin_note}` : ''}
          </div>
        )}

        <div style={lbl}>활동명</div>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={50} placeholder="매거진에 표시될 이름" style={inp} />

        <div style={lbl}>이메일</div>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" maxLength={200} placeholder="결과 안내를 받을 이메일" style={inp} />

        <div style={lbl}>인스타그램 (선택)</div>
        <div style={{ ...inp, display: 'flex', alignItems: 'center', gap: 2, padding: 0 }}>
          <span style={{ paddingLeft: 12, fontSize: 13, color: TEXT_MUTED, flexShrink: 0 }}>instagram.com/</span>
          <input value={instagram} onChange={e => setInstagram(e.target.value.replace(/\s/g, ''))} maxLength={60} placeholder="아이디" style={{ ...inp, border: 'none', background: 'transparent', paddingLeft: 0 }} />
        </div>

        <div style={lbl}>블로그 / 유튜브 URL (선택)</div>
        <input value={channelUrl} onChange={e => setChannelUrl(e.target.value)} maxLength={500} placeholder="https://" style={inp} />

        <div style={lbl}>활동 분야 (복수 선택)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map(c => {
            const on = categories.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                style={{ padding: '8px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: on ? `1px solid ${GOLD}` : CARD_BORDER, background: on ? 'rgba(var(--fg-rgb),0.08)' : CARD_BG, color: on ? GOLD : TEXT }}
              >
                {c}
              </button>
            )
          })}
        </div>

        <div style={{ ...lbl, display: 'flex', justifyContent: 'space-between' }}>
          <span>자기소개 (30자 이상)</span>
          <span style={{ color: intro.trim().length >= 30 ? GOLD : TEXT_MUTED }}>{intro.trim().length} / 2000</span>
        </div>
        <textarea value={intro} onChange={e => setIntro(e.target.value)} maxLength={2000} rows={5} placeholder="어떤 콘텐츠를 만들고 싶은지 소개해 주세요" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />

        <div style={lbl}>대표 콘텐츠 링크 (선택)</div>
        <input value={portfolioUrl} onChange={e => setPortfolioUrl(e.target.value)} maxLength={500} placeholder="https://" style={inp} />

        <div style={{ fontSize: 13, color: TEXT, marginTop: 28 }}>정산 정보</div>

        <div style={lbl}>예금주명</div>
        <input value={bankHolder} onChange={e => setBankHolder(e.target.value)} maxLength={50} style={inp} />

        {/* [ANCHOR: bank-dropdown] */}
        <div style={lbl}>은행</div>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setBankOpen(v => !v)} style={{ ...inp, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: bankName ? TEXT : TEXT_MUTED }}>{bankName || '은행을 선택하세요'}</span>
            <span style={{ color: TEXT_MUTED }}>{bankOpen ? '▲' : '▼'}</span>
          </button>
          {bankOpen && (
            <div style={{ marginTop: 6, maxHeight: 220, overflowY: 'auto', background: 'var(--bg3, #1a1a1a)', border: CARD_BORDER, borderRadius: 10 }}>
              {BANKS.map(b => (
                <div
                  key={b}
                  onClick={() => {
                    setBankName(b)
                    setBankOpen(false)
                  }}
                  style={{ padding: '11px 12px', fontSize: 13, cursor: 'pointer', color: b === bankName ? GOLD : TEXT, borderBottom: '1px solid rgba(var(--fg-rgb),0.05)' }}
                >
                  {b}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={lbl}>계좌번호</div>
        <input value={bankAccount} onChange={e => setBankAccount(e.target.value.replace(/[^0-9-]/g, ''))} inputMode="numeric" maxLength={30} placeholder="- 없이 입력" style={inp} />

        <div style={lbl}>주민등록번호 (원천징수 신고용)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={rrnFront} onChange={e => setRrnFront(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="앞 6자리" style={{ ...inp, flex: 1 }} />
          <span style={{ color: TEXT_MUTED }}>-</span>
          <input value={rrnBack} onChange={e => setRrnBack(e.target.value.replace(/\D/g, '').slice(0, 1))} inputMode="numeric" style={{ ...inp, width: 44, textAlign: 'center', padding: '11px 0' }} />
          <span style={{ fontSize: 13, color: TEXT_MUTED, letterSpacing: 2 }}>●●●●●●</span>
        </div>

        {/* [ANCHOR: curator-apply-agreements] */}
        <div style={{ marginTop: 28, background: CARD_BG, border: CARD_BORDER, borderRadius: 12, padding: '6px 14px' }}>
          {AGREEMENTS.map((a, i) => (
            <label key={a.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', fontSize: 12, color: TEXT, lineHeight: 1.5, cursor: 'pointer', borderBottom: i < AGREEMENTS.length - 1 ? '1px solid rgba(var(--fg-rgb),0.05)' : 'none' }}>
              <input
                type="checkbox"
                checked={agree[a.key]}
                onChange={e => setAgree(prev => ({ ...prev, [a.key]: e.target.checked }))}
                style={{ marginTop: 2, accentColor: 'var(--gold)', flexShrink: 0 }}
              />
              <span>(필수) {a.label}</span>
            </label>
          ))}
        </div>

        {error && <div style={{ fontSize: 12, color: '#e5534b', marginTop: 12 }}>{error}</div>}

        <button
          type="button"
          disabled={!canSubmit || submitting}
          onClick={() => void submit()}
          style={{ marginTop: 20, width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', fontSize: 14, cursor: canSubmit && !submitting ? 'pointer' : 'default', background: canSubmit ? GOLD : 'rgba(var(--fg-rgb),0.1)', color: canSubmit ? BG : TEXT_MUTED }}
        >
          {submitting ? '제출 중…' : '큐레이터 신청하기'}
        </button>
      </>
    )
  }

  return (
    <SlideUpSheet open={open} onClose={onClose}>
      <div style={{ padding: '20px 16px 48px', maxWidth: 560, margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 17, color: TEXT }}>✦ 큐레이터 신청</div>
          <button type="button" aria-label="닫기" onClick={onClose} style={{ border: 'none', background: 'transparent', color: TEXT_MUTED, fontSize: 24, lineHeight: 1, cursor: 'pointer', padding: 4 }}>
            ×
          </button>
        </div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>뷰티 콘텐츠로 매거진에 기고하고 수익을 받아보세요.</div>
        {body()}
      </div>
    </SlideUpSheet>
  )
}
