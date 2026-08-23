'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SalonInfoForm from './SalonInfoForm'

const BG = '#f8f7fc'
const CARD = '#ffffff'
const BORDER = '#ECE7DE'
const P = '#7B5EA7'
const GOLD = '#B08A46'
const TEXT = '#3A3540'
const TEXT_SUB = '#8A7E72'
const SURFACE = '#F5F1FA'

const PHASE_KEYS = ['달빛기', '황금기', '만개기', '물들기'] as const
const MAIN_CTA_OPTIONS = [
  { id: 'booking', label: '📅 예약' },
  { id: 'chat', label: '💬 상담' },
  { id: 'product', label: '🛍️ 제품' },
] as const
const BANNER_LINK_OPTIONS = ['none', 'booking', 'chat', 'url'] as const
const STORY_TYPES = ['image', 'video'] as const

type PhaseGreetings = Record<(typeof PHASE_KEYS)[number], string>
type SnsLinks = { instagram?: string; kakao?: string; youtube?: string }

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#F5F1FA',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: 10,
  color: TEXT,
  fontSize: 13,
  outline: 'none',
}

function chip(on: boolean): CSSProperties {
  return {
    fontSize: 12,
    padding: '8px 14px',
    borderRadius: 20,
    border: `1px solid ${on ? P : BORDER}`,
    background: on ? 'rgba(123,94,167,0.12)' : 'transparent',
    color: on ? TEXT : TEXT_SUB,
    cursor: 'pointer',
  }
}

function parsePhaseGreetings(raw: unknown): PhaseGreetings {
  const base: PhaseGreetings = { 달빛기: '', 황금기: '', 만개기: '', 물들기: '' }
  if (!raw || typeof raw !== 'object') return base
  for (const k of PHASE_KEYS) {
    base[k] = String((raw as Record<string, unknown>)[k] || '')
  }
  return base
}

function parseSns(raw: unknown): SnsLinks {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  return {
    instagram: o.instagram ? String(o.instagram) : '',
    kakao: o.kakao ? String(o.kakao) : '',
    youtube: o.youtube ? String(o.youtube) : '',
  }
}

export default function StoreDecorationPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [salonId, setSalonId] = useState<string | null>(null)
  const [ownerSlug, setOwnerSlug] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankSaving, setBankSaving] = useState(false)

  const [bannerUrls, setBannerUrls] = useState<(string | null)[]>([null, null, null])
  const [bannerLinks, setBannerLinks] = useState<string[]>(['none', 'none', 'none'])
  const [bannerLinkUrls, setBannerLinkUrls] = useState<string[]>(['', '', ''])
  const [storyUrl, setStoryUrl] = useState('')
  const [storyType, setStoryType] = useState<(typeof STORY_TYPES)[number]>('image')
  const [phaseGreetings, setPhaseGreetings] = useState<PhaseGreetings>({ 달빛기: '', 황금기: '', 만개기: '', 물들기: '' })
  const [phaseRecoEnabled, setPhaseRecoEnabled] = useState(true)
  const [mainCta, setMainCta] = useState<(typeof MAIN_CTA_OPTIONS)[number]['id']>('booking')
  const [mapUrl, setMapUrl] = useState('')
  const [sns, setSns] = useState<SnsLinks>({})
  const [pageTab, setPageTab] = useState<'decoration' | 'salon-info'>('decoration')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('tab') === 'salon-info') {
      setPageTab('salon-info')
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const sb = supabaseRef.current
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) {
        router.push('/login?role=owner')
        return
      }
      const { data: urow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      if (!urow?.id || cancelled) {
        if (!cancelled) setLoading(false)
        return
      }
      const oid = String(urow.id)
      setOwnerUserId(oid)

      // 웨이브2: profiles ∥ salons (select/eq 동일)
      const [{ data: prof }, { data: salon }] = await Promise.all([
        sb
          .from('profiles')
          .select('slug, avatar_url, owner_bank_name, owner_bank_account, owner_bank_holder')
          .eq('auth_id', auth.user.id)
          .maybeSingle(),
        sb
          .from('salons')
          .select('id, banner_urls, banner_links, story_url, story_type, phase_greetings, phase_reco_enabled, main_cta, map_url, sns_links')
          .eq('owner_id', oid)
          .maybeSingle(),
      ])

      if (cancelled) return
      if (prof?.slug) setOwnerSlug(String(prof.slug))
      if (prof?.avatar_url) setAvatarUrl(String(prof.avatar_url))
      setBankName(String((prof as { owner_bank_name?: string | null } | null)?.owner_bank_name || ''))
      setBankAccount(String((prof as { owner_bank_account?: string | null } | null)?.owner_bank_account || ''))
      setBankHolder(String((prof as { owner_bank_holder?: string | null } | null)?.owner_bank_holder || ''))
      if (salon) {
        setSalonId(String(salon.id))
        const urls = Array.isArray(salon.banner_urls) ? salon.banner_urls.map(String) : []
        setBannerUrls([urls[0] || null, urls[1] || null, urls[2] || null])
        const links = Array.isArray(salon.banner_links) ? salon.banner_links.map(String) : []
        setBannerLinks([links[0] || 'none', links[1] || 'none', links[2] || 'none'])
        setStoryUrl(salon.story_url ? String(salon.story_url) : '')
        setStoryType(salon.story_type === 'video' ? 'video' : 'image')
        setPhaseGreetings(parsePhaseGreetings(salon.phase_greetings))
        setPhaseRecoEnabled(salon.phase_reco_enabled !== false)
        const mc = String(salon.main_cta || 'booking')
        setMainCta(mc === 'chat' || mc === 'product' ? mc : 'booking')
        setMapUrl(salon.map_url ? String(salon.map_url) : '')
        setSns(parseSns(salon.sns_links))
      }
      setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [router])

  const uploadFile = useCallback(async (file: File, kind: string) => {
    if (!ownerUserId) return ''
    if (file.size > 5 * 1024 * 1024) {
      setToast('5MB 이하 파일만 업로드할 수 있어요')
      return ''
    }
    const sb = supabaseRef.current
    const path = `${ownerUserId}/decoration/${kind}_${Date.now()}_${Math.random().toString(16).slice(2)}`
    const { error } = await sb.storage.from('owner-store').upload(path, file, { upsert: true })
    if (error) {
      setToast('업로드에 실패했어요')
      return ''
    }
    const { data } = sb.storage.from('owner-store').getPublicUrl(path)
    return data.publicUrl || ''
  }, [ownerUserId])

  const handleBannerUpload = async (idx: number, file: File | null) => {
    if (!file) return
    const url = await uploadFile(file, `banner${idx}`)
    if (!url) return
    setBannerUrls((prev) => {
      const next = [...prev]
      next[idx] = url
      return next
    })
  }

  const handleStoryUpload = async (file: File | null) => {
    if (!file) return
    const url = await uploadFile(file, 'story')
    if (!url) return
    setStoryUrl(url)
    setStoryType(file.type.startsWith('video/') ? 'video' : 'image')
  }

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return
    const url = await uploadFile(file, 'avatar')
    if (!url) return
    setAvatarUrl(url)
  }

  const handleSave = async () => {
    if (!ownerUserId || !salonId) {
      setToast('살롱 정보를 먼저 등록해주세요')
      return
    }
    setSaving(true)
    const sb = supabaseRef.current
    const linksPayload = bannerLinks.map((l, i) => (l === 'url' ? bannerLinkUrls[i] || 'none' : l))
    const { error } = await sb
      .from('salons')
      .update({
        banner_urls: bannerUrls.filter(Boolean),
        banner_links: linksPayload,
        story_url: storyUrl || null,
        story_type: storyType,
        phase_greetings: phaseGreetings,
        phase_reco_enabled: phaseRecoEnabled,
        main_cta: mainCta,
        map_url: mapUrl.trim() || null,
        sns_links: sns,
      })
      .eq('id', salonId)
    setSaving(false)
    if (error) {
      setToast('저장에 실패했어요')
      return
    }
    const { data: auth } = await sb.auth.getUser()
    if (auth.user) {
      const { error: profErr } = await sb.from('profiles').update({ avatar_url: avatarUrl || null }).eq('auth_id', auth.user.id)
      if (profErr) {
        setToast('살롱은 저장됐지만 프로필 사진 저장에 실패했어요')
        return
      }
    }
    setToast('저장되었어요 💜')
  }

  const saveBankInfo = async () => {
    setBankSaving(true)
    try {
      const sb = supabaseRef.current
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        setToast('로그인이 필요해요')
        return
      }
      const { error } = await sb
        .from('profiles')
        .update({
          owner_bank_name: bankName.trim() || null,
          owner_bank_account: bankAccount.trim() || null,
          owner_bank_holder: bankHolder.trim() || null,
        })
        .eq('auth_id', user.id)
      if (error) {
        setToast('계좌정보 저장에 실패했어요')
        return
      }
      setToast('계좌정보가 저장됐어요 💜')
    } finally {
      setBankSaving(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: BG, color: TEXT_SUB, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>불러오는 중...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, padding: '16px 16px 120px' }}>
      {toast ? (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 16px', fontSize: 12 }}>
          {toast}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 22, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>←</button>
        <div style={{ flex: 1, fontSize: 16, color: TEXT }}>스토어 꾸미기</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setPageTab('decoration')} style={chip(pageTab === 'decoration')}>꾸미기</button>
        <button type="button" onClick={() => setPageTab('salon-info')} style={chip(pageTab === 'salon-info')}>살롱 정보</button>
      </div>

      {pageTab === 'salon-info' ? (
        <SalonInfoForm />
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>프로필 사진</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: P }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: avatarUrl ? `url(${avatarUrl}) center/cover` : '#F5F1FA', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
                {!avatarUrl ? '🌸' : null}
              </div>
              <span>사진 업로드</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { void handleAvatarUpload(e.target.files?.[0] || null) }} />
            </label>
          </div>
          <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 8 }}>권장 정사각형 · 최대 5MB · 고객 스토어·로그인 화면에 노출</div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>정산 송금계좌 (트랙A/B 공용)</div>
          <select
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            style={{ ...fieldStyle, marginBottom: 8 }}
          >
            <option value="">은행 선택</option>
            <option value="국민은행">국민은행</option>
            <option value="신한은행">신한은행</option>
            <option value="우리은행">우리은행</option>
            <option value="하나은행">하나은행</option>
            <option value="농협은행">농협은행</option>
            <option value="카카오뱅크">카카오뱅크</option>
            <option value="토스뱅크">토스뱅크</option>
            <option value="케이뱅크">케이뱅크</option>
            <option value="IBK기업은행">IBK기업은행</option>
            <option value="새마을금고">새마을금고</option>
            <option value="신협">신협</option>
            <option value="우체국">우체국</option>
            <option value="SC제일은행">SC제일은행</option>
            <option value="씨티은행">씨티은행</option>
            <option value="수협은행">수협은행</option>
            <option value="부산은행">부산은행</option>
            <option value="대구은행">대구은행</option>
            <option value="경남은행">경남은행</option>
            <option value="광주은행">광주은행</option>
            <option value="전북은행">전북은행</option>
            <option value="제주은행">제주은행</option>
          </select>
          <input
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder="계좌번호 (숫자만)"
            style={{ ...fieldStyle, marginBottom: 8 }}
          />
          <input
            value={bankHolder}
            onChange={(e) => setBankHolder(e.target.value)}
            placeholder="예금주명"
            style={{ ...fieldStyle, marginBottom: 10 }}
          />
          <button
            type="button"
            onClick={() => void saveBankInfo()}
            disabled={bankSaving}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 10,
              background: P,
              color: '#fff',
              padding: '10px 0',
              fontSize: 13,
              cursor: bankSaving ? 'wait' : 'pointer',
              opacity: bankSaving ? 0.7 : 1,
            }}
          >
            {bankSaving ? '저장 중...' : '계좌정보 저장'}
          </button>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>배너 (최대 3장)</div>
          <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 10 }}>권장 1200×675px · 16:9 · 최대 5MB</div>
          {[0, 1, 2].map((idx) => (
            <div key={idx} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: idx < 2 ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 6 }}>배너 {idx + 1}</div>
              <label style={{ display: 'block', cursor: 'pointer', marginBottom: 8 }}>
                <div style={{ aspectRatio: '16/9', borderRadius: 10, background: bannerUrls[idx] ? `url(${bannerUrls[idx]}) center/cover` : '#F5F1FA', border: `1px dashed ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB, fontSize: 11, position: 'relative', overflow: 'hidden' }}>
                  {!bannerUrls[idx] ? '이미지 없음' : null}
                  <div style={{
                    position: 'absolute', left: 0, right: 0, bottom: 0, padding: '6px 0', textAlign: 'center', fontSize: 10,
                    color: bannerUrls[idx] ? '#fff' : TEXT_SUB,
                    background: bannerUrls[idx] ? 'rgba(58,53,64,0.35)' : 'transparent',
                  }}>탭하여 변경</div>
                </div>
                <span style={{ display: 'block', fontSize: 11, color: P, marginTop: 8 }}>파일 선택</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { void handleBannerUpload(idx, e.target.files?.[0] || null) }} />
              </label>
              <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 6 }}>배너 링크</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {BANNER_LINK_OPTIONS.map((opt) => (
                  <button key={opt} type="button" onClick={() => setBannerLinks((p) => { const n = [...p]; n[idx] = opt; return n })} style={chip(bannerLinks[idx] === opt)}>
                    {opt === 'none' ? '없음' : opt === 'booking' ? '예약' : opt === 'chat' ? '상담' : 'URL'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 4 }}>한번 설정하면 별도 변경 전까지 계속 노출돼요</div>
              {bannerLinks[idx] === 'url' ? (
                <input value={bannerLinkUrls[idx]} onChange={(e) => setBannerLinkUrls((p) => { const n = [...p]; n[idx] = e.target.value; return n })} placeholder="https://" style={fieldStyle} />
              ) : null}
            </div>
          ))}
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>스토리</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {STORY_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setStoryType(t)} style={chip(storyType === t)}>{t === 'image' ? '이미지' : '영상'}</button>
            ))}
          </div>
          {storyUrl ? (
            storyType === 'video' ? (
              <video src={storyUrl} controls style={{ width: '100%', borderRadius: 10, marginBottom: 8 }} />
            ) : (
              <img src={storyUrl} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 8 }} />
            )
          ) : null}
          <label style={{ fontSize: 11, color: P, cursor: 'pointer' }}>
            스토리 업로드
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { void handleStoryUpload(e.target.files?.[0] || null) }} />
          </label>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: TEXT_SUB }}>페이즈별 인사 (general 트랙 전용)</div>
            <button type="button" onClick={() => setPhaseRecoEnabled((v) => !v)} style={chip(phaseRecoEnabled)}>
              {phaseRecoEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          {PHASE_KEYS.map((ph) => (
            <div key={ph} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 4 }}>{ph}</div>
              <input
                value={phaseGreetings[ph]}
                onChange={(e) => setPhaseGreetings((p) => ({ ...p, [ph]: e.target.value }))}
                placeholder={`${ph} 인사말`}
                style={fieldStyle}
              />
            </div>
          ))}
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>메인 버튼 우선순위</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {MAIN_CTA_OPTIONS.map((opt) => (
              <button key={opt.id} type="button" onClick={() => setMainCta(opt.id)} style={chip(mainCta === opt.id)}>{opt.label}</button>
            ))}
          </div>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>지도 링크</div>
          <input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="네이버/카카오 지도 URL" style={{ ...fieldStyle, marginBottom: 12 }} />
          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>SNS</div>
          <input value={sns.instagram || ''} onChange={(e) => setSns((p) => ({ ...p, instagram: e.target.value }))} placeholder="Instagram URL" style={{ ...fieldStyle, marginBottom: 8 }} />
          <input value={sns.kakao || ''} onChange={(e) => setSns((p) => ({ ...p, kakao: e.target.value }))} placeholder="Kakao 채널 URL" style={{ ...fieldStyle, marginBottom: 8 }} />
          <input value={sns.youtube || ''} onChange={(e) => setSns((p) => ({ ...p, youtube: e.target.value }))} placeholder="YouTube URL" style={fieldStyle} />
          <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 12 }}>
            살롱명·메뉴·자격증은 살롱 정보에서 관리 →{' '}
            <button
              type="button"
              onClick={() => setPageTab('salon-info')}
              style={{ color: P, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11 }}
            >
              살롱 정보 탭
            </button>
          </div>
        </div>

        <button type="button" disabled={saving} onClick={() => void handleSave()} style={{ width: '100%', border: 'none', borderRadius: 12, background: P, color: '#fff', padding: '12px 0', fontSize: 14, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '저장 중...' : '저장하기'}
        </button>

        {ownerSlug ? (
          <div style={{ padding: '10px 12px', background: SURFACE, borderRadius: 10, marginBottom: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>내 전용 로그인 주소</div>
            <div style={{ fontSize: 13, color: GOLD }}>auran.kr/owner/{ownerSlug}</div>
          </div>
        ) : null}
        {salonId ? (
          <a href={`/salons/${salonId}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: 13, color: GOLD, textDecoration: 'none', padding: 12 }}>
            고객화면 미리보기 →
          </a>
        ) : null}
      </div>
      )}
    </div>
  )
}
