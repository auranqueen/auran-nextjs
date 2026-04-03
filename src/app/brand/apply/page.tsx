'use client'

/*
 * Supabase SQL Editor에서 실행 (앱이 실행하지 않음):
 *
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS brand_name_kr text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS founded_year int;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_url text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS story_image_urls text[];
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS story_video_url text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS story_gif_url text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS product_categories text[];
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS manager_name text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS manager_title text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS manager_phone text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS kakao_id text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS address text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS biz_no text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS ceo_name text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS biz_doc_url text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS commerce_doc_url text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS import_doc_url text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS bank_name text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS bank_account text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS bank_holder text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS price_range_min int;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS price_range_max int;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS settlement_cycle text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS sample_available text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS promo_condition text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS extra_request text;
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS apply_status text DEFAULT 'pending';
 * ALTER TABLE brands ADD COLUMN IF NOT EXISTS applied_at timestamptz DEFAULT now();
 */

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
import { useCallback, useMemo, useState } from 'react'

const BG = '#0f0d14'
const ACC = '#7B5EA7'
const GOLD = '#C9A96E'

const ORIGIN_PRESETS = ['프랑스', '한국', '독일', '이탈리아', '스페인', '스위스', '미국', '일본', '기타(직접입력)'] as const
const PRODUCT_PRESETS = ['스킨케어', '클렌징', '마스크', '바디케어', '헤어케어', '선케어', '더마코스메틱'] as const
const BANKS = ['국민', '신한', '우리', '하나', '기업', '농협', '카카오뱅크', '토스뱅크', 'SC제일', '기타'] as const

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

type Summary = {
  brandName: string
  origin: string
  managerName: string
  email: string
  bank: string
  holder: string
  appliedAt: string
  status: string
}

export default function BrandApplyPage() {
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [doneSummary, setDoneSummary] = useState<Summary | null>(null)
  const [applyFolder] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uid()))

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [nameKr, setNameKr] = useState('')
  const [originSel, setOriginSel] = useState('')
  const [originCustom, setOriginCustom] = useState('')
  const [originDisplay, setOriginDisplay] = useState('')
  const [foundedYear, setFoundedYear] = useState('')
  const [intro, setIntro] = useState('')
  const [storyImages, setStoryImages] = useState<{ id: string; file: File; preview: string }[]>([])
  const [storyGif, setStoryGif] = useState<File | null>(null)
  const [storyGifPreview, setStoryGifPreview] = useState('')
  const [storyVideo, setStoryVideo] = useState<File | null>(null)
  const [storyVideoPreview, setStoryVideoPreview] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [catCustom, setCatCustom] = useState('')

  const [mgrName, setMgrName] = useState('')
  const [mgrTitle, setMgrTitle] = useState('')
  const [mgrEmail, setMgrEmail] = useState('')
  const [mgrPhone, setMgrPhone] = useState('')
  const [kakaoId, setKakaoId] = useState('')
  const [addr1, setAddr1] = useState('')
  const [addr2, setAddr2] = useState('')

  const [bizNo, setBizNo] = useState('')
  const [corpName, setCorpName] = useState('')
  const [ceoName, setCeoName] = useState('')
  const [bizDoc, setBizDoc] = useState<File | null>(null)
  const [commerceDoc, setCommerceDoc] = useState<File | null>(null)
  const [importDoc, setImportDoc] = useState<File | null>(null)
  const [bankSel, setBankSel] = useState('')
  const [bankOther, setBankOther] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')

  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [promoCondition, setPromoCondition] = useState('')
  const [settlement, setSettlement] = useState('')
  const [sampleAvail, setSampleAvail] = useState('')
  const [extraReq, setExtraReq] = useState('')

  const [agree1, setAgree1] = useState(false)
  const [agree2, setAgree2] = useState(false)
  const [agree3, setAgree3] = useState(false)
  const [agreeMkt, setAgreeMkt] = useState(false)

  const resolvedOrigin = useMemo(() => {
    if (originDisplay) return originDisplay
    if (originSel === '기타(직접입력)') return originCustom.trim()
    return originSel
  }, [originCustom, originDisplay, originSel])

  const resolvedBank = bankSel === '기타' ? bankOther.trim() : bankSel

  const uploadAsset = async (file: File, prefix: string) => {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `apply/${applyFolder}/${prefix}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (error) throw error
    const { data } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return data.publicUrl as string
  }

  const toggleCat = (c: string) => {
    setCategories(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]))
  }

  const addOriginCustom = () => {
    const t = originCustom.trim()
    if (!t) return
    setOriginDisplay(t)
    setOriginSel('')
    setOriginCustom('')
  }

  const addCatCustom = () => {
    const t = catCustom.trim()
    if (!t || categories.includes(t)) return
    setCategories(prev => [...prev, t])
    setCatCustom('')
  }

  const validateStep = (s: number) => {
    if (s === 1) {
      if (!logoFile) return '브랜드 로고를 선택해 주세요.'
      if (!nameEn.trim()) return '브랜드명(영문)을 입력해 주세요.'
      if (!intro.trim()) return '브랜드 소개를 입력해 주세요.'
      if (intro.trim().length > 200) return '브랜드 소개는 200자 이내입니다.'
      if (!resolvedOrigin) return '원산지를 선택하거나 직접 등록해 주세요.'
      if (categories.length === 0) return '주요 취급 제품군을 1개 이상 선택해 주세요.'
    }
    if (s === 2) {
      if (!mgrName.trim()) return '담당자 이름을 입력해 주세요.'
      if (!mgrEmail.trim()) return '이메일을 입력해 주세요.'
      if (!mgrPhone.trim()) return '연락처를 입력해 주세요.'
      if (!addr1.trim() || !addr2.trim()) return '사업장 주소 두 줄을 모두 입력해 주세요.'
    }
    if (s === 3) {
      if (!bizNo.trim()) return '사업자등록번호를 입력해 주세요.'
      if (!corpName.trim()) return '법인명/상호를 입력해 주세요.'
      if (!ceoName.trim()) return '대표자명을 입력해 주세요.'
      if (!bizDoc) return '사업자등록증을 업로드해 주세요.'
      if (!resolvedBank) return '은행을 선택해 주세요.'
      if (bankSel === '기타' && !bankOther.trim()) return '은행명을 입력해 주세요.'
      if (!bankAccount.trim()) return '계좌번호를 입력해 주세요.'
      if (!bankHolder.trim()) return '예금주명을 입력해 주세요.'
    }
    if (s === 4) {
      if (!settlement) return '정산 주기를 선택해 주세요.'
      if (!sampleAvail) return '샘플 제공 가능 여부를 선택해 주세요.'
    }
    if (s === 5) {
      if (!agree1 || !agree2 || !agree3) return '필수 약관에 동의해 주세요.'
    }
    return ''
  }

  const goNext = () => {
    setErr('')
    const v = validateStep(step)
    if (v) {
      setErr(v)
      return
    }
    setStep(s => Math.min(5, s + 1))
  }

  const goPrev = () => {
    setErr('')
    setStep(s => Math.max(1, s - 1))
  }

  const submit = useCallback(async () => {
    setErr('')
    const v = validateStep(5)
    if (v) {
      setErr(v)
      return
    }
    setBusy(true)
    try {
      if (!logoFile) throw new Error('로고가 없습니다.')

      const logoUrl = await uploadAsset(logoFile, 'logo')
      const storyUrls: string[] = []
      for (let i = 0; i < storyImages.length; i++) {
        storyUrls.push(await uploadAsset(storyImages[i].file, `story_img_${i}`))
      }
      let gifUrl: string | null = null
      if (storyGif) gifUrl = await uploadAsset(storyGif, 'story_gif')
      let videoUrl: string | null = null
      if (storyVideo) {
        if (storyVideo.size > 50 * 1024 * 1024) throw new Error('영상은 50MB 이하만 가능합니다.')
        videoUrl = await uploadAsset(storyVideo, 'story_video')
      }
      const bizDocUrl = await uploadAsset(bizDoc!, 'biz')
      let commerceUrl: string | null = null
      if (commerceDoc) commerceUrl = await uploadAsset(commerceDoc, 'commerce')
      let importUrl: string | null = null
      if (importDoc) importUrl = await uploadAsset(importDoc, 'import')

      const fy = foundedYear.trim() === '' ? null : Math.floor(Number(foundedYear))
      const prMin = priceMin.trim() === '' ? null : Math.floor(Number(priceMin))
      const prMax = priceMax.trim() === '' ? null : Math.floor(Number(priceMax))

      let userIdPk: string | null = null
      const { data: auth } = await supabase.auth.getUser()
      if (auth?.user?.id) {
        const { data: urow } = await supabase.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
        userIdPk = (urow as { id?: string } | null)?.id ?? null
      }

      const addressBlock = [addr1.trim(), addr2.trim()].filter(Boolean).join('\n')
      const termsNote = `약관동의: 파트너/개인정보/위탁=${agree1 && agree2 && agree3 ? 'Y' : 'N'}, 마케팅=${agreeMkt ? 'Y' : 'N'}`
      const extraMerged = [extraReq.trim(), `상호(법인명): ${corpName.trim()}`, termsNote].filter(Boolean).join('\n\n')

      const insertPayload: Record<string, unknown> = {
        user_id: userIdPk,
        name: nameEn.trim(),
        brand_name_kr: nameKr.trim() || null,
        origin: resolvedOrigin || null,
        description: intro.trim(),
        logo_url: logoUrl,
        founded_year: fy != null && Number.isFinite(fy) ? fy : null,
        story_image_urls: storyUrls.length ? storyUrls : null,
        story_gif_url: gifUrl,
        story_video_url: videoUrl,
        product_categories: categories,
        manager_name: mgrName.trim(),
        manager_title: mgrTitle.trim() || null,
        manager_phone: mgrPhone.trim(),
        kakao_id: kakaoId.trim() || null,
        address: addressBlock || null,
        biz_no: bizNo.trim(),
        ceo_name: ceoName.trim(),
        biz_doc_url: bizDocUrl,
        commerce_doc_url: commerceUrl,
        import_doc_url: importUrl,
        bank_name: resolvedBank || null,
        bank_account: bankAccount.trim(),
        bank_holder: bankHolder.trim(),
        price_range_min: prMin != null && Number.isFinite(prMin) ? prMin : null,
        price_range_max: prMax != null && Number.isFinite(prMax) ? prMax : null,
        settlement_cycle: settlement || null,
        sample_available: sampleAvail || null,
        promo_condition: promoCondition.trim() || null,
        extra_request: extraMerged || null,
        apply_status: 'pending',
        applied_at: new Date().toISOString(),
        status: 'pending',
        contact: `${mgrEmail.trim()}\n${mgrPhone.trim()}`,
      }

      const { error: insErr } = await supabase.from('brands').insert(insertPayload as any).select('id').single()
      if (insErr) throw new Error(insErr.message)

      const { data: admins } = await supabase.from('users').select('id').in('role', ['admin', 'master'])
      const notifRows = (admins || []).map((a: { id: string }) => ({
        user_id: a.id,
        title: '브랜드 입점 신청',
        body: nameEn.trim(),
        type: 'system',
        is_read: false,
      }))
      if (notifRows.length) {
        const { error: nErr } = await supabase.from('notifications').insert(notifRows as any)
        if (nErr) console.warn('[brand apply] notify', nErr.message)
      }

      const now = new Date()
      setDoneSummary({
        brandName: nameEn.trim(),
        origin: resolvedOrigin,
        managerName: mgrName.trim(),
        email: mgrEmail.trim(),
        bank: resolvedBank,
        holder: bankHolder.trim(),
        appliedAt: now.toLocaleString('ko-KR'),
        status: '검토중',
      })
      setStep(6)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '신청 처리 중 오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }, [
    addr1,
    addr2,
    agree1,
    agree2,
    agree3,
    agreeMkt,
    applyFolder,
    bankAccount,
    bankHolder,
    bankSel,
    bankOther,
    bizDoc,
    bizNo,
    categories,
    ceoName,
    commerceDoc,
    corpName,
    extraReq,
    importDoc,
    intro,
    kakaoId,
    logoFile,
    mgrEmail,
    mgrName,
    mgrPhone,
    mgrTitle,
    nameEn,
    nameKr,
    priceMax,
    priceMin,
    promoCondition,
    resolvedBank,
    resolvedOrigin,
    sampleAvail,
    settlement,
    storyGif,
    storyImages,
    storyVideo,
    supabase,
    foundedYear,
  ])

  const input: CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
  }

  const label: CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginBottom: 6, display: 'block' }

  const chip = (on: boolean) => ({
    display: 'inline-block',
    margin: 4,
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    cursor: 'pointer',
    border: `1px solid ${on ? ACC : 'rgba(255,255,255,0.12)'}`,
    background: on ? 'rgba(123,94,167,0.22)' : 'rgba(255,255,255,0.04)',
    color: on ? '#e4daf5' : 'rgba(255,255,255,0.55)',
  })

  if (doneSummary && step === 6) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#e9e4f1', padding: '24px 16px 40px', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', fontSize: 42, marginBottom: 12 }}>💜</div>
        <div style={{ textAlign: 'center', fontSize: 20, color: ACC, marginBottom: 20 }}>입점 신청 완료</div>
        <div style={{ padding: 16, borderRadius: 14, border: `1px solid rgba(123,94,167,0.35)`, background: 'rgba(255,255,255,0.03)', fontSize: 13, lineHeight: 1.6 }}>
          <div>브랜드명: {doneSummary.brandName}</div>
          <div>원산지: {doneSummary.origin}</div>
          <div>담당자: {doneSummary.managerName}</div>
          <div>이메일: {doneSummary.email}</div>
          <div>정산: {doneSummary.bank} · {doneSummary.holder}</div>
          <div>신청일: {doneSummary.appliedAt}</div>
          <div>상태: {doneSummary.status}</div>
        </div>
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link href="/" style={{ fontSize: 13, color: ACC }}>
            홈으로
          </Link>
        </div>
      </div>
    )
  }

  const progress = (step / 5) * 100

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#e9e4f1', padding: '20px 16px 40px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <Link href="/" style={{ fontSize: 22, color: '#f5f0ff', letterSpacing: '0.12em', textDecoration: 'none' }}>
          AURAN
        </Link>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, letterSpacing: '0.08em' }}>BRAND PARTNER ONBOARDING</div>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ width: `${progress}%`, height: '100%', background: ACC, transition: 'width 0.25s ease' }} />
      </div>

      {err ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(229,57,53,0.12)', border: '1px solid rgba(229,57,53,0.35)', fontSize: 12, color: '#ffb4b4' }}>{err}</div>
      ) : null}

      {step === 1 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 15, color: ACC }}>STEP 1 — 브랜드 정보</div>
          <div>
            <span style={label}>브랜드 로고 (필수)</span>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
              로고는 AURAN 홈화면 브랜드 섹션에 자동으로 노출됩니다. 투명 배경 PNG 권장
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                if (logoPreview) URL.revokeObjectURL(logoPreview)
                setLogoFile(f)
                setLogoPreview(URL.createObjectURL(f))
              }}
            />
            {logoPreview ? <img src={logoPreview} alt="" style={{ marginTop: 8, maxWidth: 120, borderRadius: 10 }} /> : null}
          </div>
          <div>
            <span style={label}>브랜드명 영문 (필수)</span>
            <input value={nameEn} onChange={e => setNameEn(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>브랜드명 한글</span>
            <input value={nameKr} onChange={e => setNameKr(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>원산지</span>
            <select value={originSel} onChange={e => setOriginSel(e.target.value)} style={{ ...input, marginBottom: 8 }}>
              <option value="">선택</option>
              {ORIGIN_PRESETS.map(o => (
                <option key={o} value={o} style={{ background: '#1a1522' }}>
                  {o}
                </option>
              ))}
            </select>
            {originSel === '기타(직접입력)' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={originCustom} onChange={e => setOriginCustom(e.target.value)} style={{ ...input, flex: 1, minWidth: 160 }} placeholder="원산지 입력" />
                <button type="button" onClick={addOriginCustom} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${ACC}`, background: 'rgba(123,94,167,0.2)', color: '#e8dff9', fontSize: 12, cursor: 'pointer' }}>
                  등록하기
                </button>
              </div>
            ) : null}
            {originDisplay ? <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>등록된 원산지: {originDisplay}</div> : null}
          </div>
          <div>
            <span style={label}>브랜드 설립연도</span>
            <input value={foundedYear} inputMode="numeric" onChange={e => setFoundedYear(e.target.value)} style={input} placeholder="예: 2018" />
          </div>
          <div>
            <span style={label}>브랜드 소개 (필수, 200자)</span>
            <textarea value={intro} maxLength={200} onChange={e => setIntro(e.target.value)} style={{ ...input, minHeight: 88, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{intro.length}/200</div>
          </div>
          <div>
            <span style={label}>브랜드 스토리 미디어 (선택)</span>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>없으면 건너뛰세요</div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ ...label, marginBottom: 4 }}>이미지</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => {
                  const arr = Array.from(e.target.files || [])
                  setStoryImages(prev => {
                    const next = [...prev]
                    for (const file of arr) {
                      next.push({ id: uid(), file, preview: URL.createObjectURL(file) })
                    }
                    return next
                  })
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {storyImages.map(s => (
                  <div key={s.id} style={{ position: 'relative' }}>
                    <img src={s.preview} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(s.preview)
                        setStoryImages(prev => prev.filter(x => x.id !== s.id))
                      }}
                      style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 999, border: 'none', background: '#333', color: '#fff', fontSize: 10, cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ ...label, marginBottom: 4 }}>GIF</span>
              <input
                type="file"
                accept="image/gif"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (storyGifPreview) URL.revokeObjectURL(storyGifPreview)
                  setStoryGif(f)
                  setStoryGifPreview(URL.createObjectURL(f))
                }}
              />
              {storyGifPreview ? <img src={storyGifPreview} alt="" style={{ marginTop: 6, maxWidth: 100 }} /> : null}
            </div>
            <div>
              <span style={{ ...label, marginBottom: 4 }}>영상 MP4 (30초 권장, 50MB 이하)</span>
              <input
                type="file"
                accept="video/mp4,video/*"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  if (storyVideoPreview) URL.revokeObjectURL(storyVideoPreview)
                  setStoryVideo(f)
                  setStoryVideoPreview(URL.createObjectURL(f))
                }}
              />
            </div>
          </div>
          <div>
            <span style={label}>주요 취급 제품군 (필수)</span>
            <div>
              {PRODUCT_PRESETS.map(p => (
                <span key={p} role="button" tabIndex={0} style={chip(categories.includes(p))} onClick={() => toggleCat(p)}>
                  {p}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input value={catCustom} onChange={e => setCatCustom(e.target.value)} style={{ ...input, flex: 1, minWidth: 160 }} placeholder="직접 등록" />
              <button type="button" onClick={addCatCustom} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${ACC}`, background: 'rgba(123,94,167,0.2)', color: '#e8dff9', fontSize: 12, cursor: 'pointer' }}>
                등록
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 15, color: ACC }}>STEP 2 — 담당자 정보</div>
          <div>
            <span style={label}>담당자 이름 (필수)</span>
            <input value={mgrName} onChange={e => setMgrName(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>직책</span>
            <input value={mgrTitle} onChange={e => setMgrTitle(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>이메일 (필수)</span>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
              입점 승인, 정산 안내 등 중요 메일이 발송됩니다. 실제 확인 가능한 이메일을 입력해주세요.
            </div>
            <input value={mgrEmail} type="email" onChange={e => setMgrEmail(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>연락처 (필수)</span>
            <input value={mgrPhone} onChange={e => setMgrPhone(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>카카오톡 ID (선택)</span>
            <input value={kakaoId} onChange={e => setKakaoId(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>사업장 주소 (필수)</span>
            <input value={addr1} onChange={e => setAddr1(e.target.value)} style={{ ...input, marginBottom: 8 }} placeholder="주소 1줄" />
            <input value={addr2} onChange={e => setAddr2(e.target.value)} style={input} placeholder="주소 2줄" />
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 15, color: ACC }}>STEP 3 — 사업자 인증 · 정산 계좌</div>
          <div>
            <span style={label}>사업자등록번호 (필수)</span>
            <input value={bizNo} onChange={e => setBizNo(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>법인명/상호 (필수)</span>
            <input value={corpName} onChange={e => setCorpName(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>대표자명 (필수)</span>
            <input value={ceoName} onChange={e => setCeoName(e.target.value)} style={input} />
          </div>
          <div>
            <span style={label}>사업자등록증 (필수)</span>
            <input type="file" accept="image/*,application/pdf" onChange={e => setBizDoc(e.target.files?.[0] || null)} />
          </div>
          <div>
            <span style={label}>통신판매업 신고증 (선택)</span>
            <input type="file" accept="image/*,application/pdf" onChange={e => setCommerceDoc(e.target.files?.[0] || null)} />
          </div>
          <div>
            <span style={label}>수입원 계약서 (선택)</span>
            <input type="file" accept="image/*,application/pdf" onChange={e => setImportDoc(e.target.files?.[0] || null)} />
          </div>
          <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${GOLD}`, background: 'rgba(201,169,110,0.08)' }}>
            <div style={{ fontSize: 12, color: GOLD, marginBottom: 10 }}>정산 금액이 입금되는 계좌입니다. 오입력으로 인한 오송금은 책임지지 않습니다.</div>
            <div style={{ marginBottom: 10 }}>
              <span style={label}>은행명</span>
              <select value={bankSel} onChange={e => setBankSel(e.target.value)} style={input}>
                <option value="">선택</option>
                {BANKS.map(b => (
                  <option key={b} value={b} style={{ background: '#1a1522' }}>
                    {b}
                  </option>
                ))}
              </select>
              {bankSel === '기타' ? <input value={bankOther} onChange={e => setBankOther(e.target.value)} style={{ ...input, marginTop: 8 }} placeholder="은행명 입력" /> : null}
            </div>
            <div style={{ marginBottom: 10 }}>
              <span style={label}>계좌번호 (필수)</span>
              <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>계좌번호를 다시 한번 확인해주세요. 정산 오류 발생 시 복구가 어렵습니다.</div>
              <input value={bankAccount} onChange={e => setBankAccount(e.target.value)} style={input} />
            </div>
            <div>
              <span style={label}>예금주명 (필수)</span>
              <div style={{ fontSize: 11, color: GOLD, marginBottom: 4 }}>사업자등록증의 대표자명 또는 법인명과 일치해야 합니다.</div>
              <input value={bankHolder} onChange={e => setBankHolder(e.target.value)} style={input} />
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 15, color: ACC }}>STEP 4 — 공급 조건</div>
          <div>
            <span style={label}>납품 단가 범위 (선택)</span>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>어드민 검토 시 참고용으로만 사용됩니다.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input value={priceMin} inputMode="numeric" placeholder="최소" onChange={e => setPriceMin(e.target.value)} style={input} />
              <input value={priceMax} inputMode="numeric" placeholder="최대" onChange={e => setPriceMax(e.target.value)} style={input} />
            </div>
          </div>
          <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${GOLD}`, background: 'rgba(201,169,110,0.06)' }}>
            <span style={label}>추가 증정 / 납품 프로모션 조건</span>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
              예) 4+1 · 10+5 · 20개 이상 주문 시 샘플 10개 증정 · 특별 프로모션 기간 추가 할인
              <br />
              협의된 내용을 정확히 기재해주세요. 히스토리로 관리됩니다.
            </div>
            <textarea value={promoCondition} onChange={e => setPromoCondition(e.target.value)} style={{ ...input, minHeight: 100, resize: 'vertical' }} />
          </div>
          <div>
            <span style={label}>정산 주기 희망 (필수)</span>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>월마감: 매월 말 판매 내역 기준 정산 · 선불: 납품 전 선지급 방식</div>
            {(['월마감 정산', '선불'] as const).map(x => (
              <span key={x} role="button" tabIndex={0} style={chip(settlement === x)} onClick={() => setSettlement(x)}>
                {x}
              </span>
            ))}
          </div>
          <div>
            <span style={label}>샘플 제공 가능 여부</span>
            {(['가능', '불가', '협의'] as const).map(x => (
              <span key={x} role="button" tabIndex={0} style={chip(sampleAvail === x)} onClick={() => setSampleAvail(x)}>
                {x}
              </span>
            ))}
          </div>
          <div>
            <span style={label}>추가 요청사항</span>
            <textarea value={extraReq} onChange={e => setExtraReq(e.target.value)} style={{ ...input, minHeight: 80, resize: 'vertical' }} />
          </div>
        </div>
      )}

      {step === 5 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 15, color: ACC }}>STEP 5 — 약관 동의</div>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={agree1} onChange={e => setAgree1(e.target.checked)} style={{ marginTop: 3 }} />
            <span>[필수] AURAN 브랜드 파트너 이용약관</span>
          </label>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={agree2} onChange={e => setAgree2(e.target.checked)} style={{ marginTop: 3 }} />
            <span>[필수] 개인정보 수집 및 이용</span>
          </label>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={agree3} onChange={e => setAgree3(e.target.checked)} style={{ marginTop: 3 }} />
            <span>[필수] 전자상거래 표준 위탁 판매 계약</span>
          </label>
          <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={agreeMkt} onChange={e => setAgreeMkt(e.target.checked)} style={{ marginTop: 3 }} />
            <span>[선택] 마케팅 정보 수신</span>
          </label>
          <div style={{ fontSize: 12, color: GOLD, padding: 12, borderRadius: 10, border: `1px solid rgba(201,169,110,0.35)`, background: 'rgba(201,169,110,0.07)' }}>
            입점 신청 후 영업일 3~5일 내 검토 결과를 안내드려요. 승인 완료 시 등록된 이메일로 대시보드 접근 링크를 발송합니다.
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              border: `1px solid ${ACC}`,
              background: 'rgba(123,94,167,0.3)',
              color: '#f3ecff',
              fontSize: 14,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? '처리 중…' : '입점 신청하기'}
          </button>
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              onClick={goPrev}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              이전
            </button>
          </div>
        </div>
      )}

      {step < 5 ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, gap: 10 }}>
          <button
            type="button"
            onClick={goPrev}
            disabled={step <= 1}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 13,
              cursor: step <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            이전
          </button>
          <button
            type="button"
            onClick={goNext}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: `1px solid ${ACC}`,
              background: 'rgba(123,94,167,0.2)',
              color: '#e8dff9',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            다음
          </button>
        </div>
      ) : null}
    </div>
  )
}
