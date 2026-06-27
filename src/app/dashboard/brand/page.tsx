'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { compressImage } from '@/lib/imageUpload'

const BrandProductFormV2 = dynamic(() => import('@/components/brand/BrandProductFormV2'), { ssr: false })
const BrandTabHome = dynamic(() => import('./tabs/BrandTabHome'), { ssr: false })
const BrandTabProducts = dynamic(() => import('./tabs/BrandTabProducts'), { ssr: false })
const BrandTabOwners = dynamic(() => import('./tabs/BrandTabOwners'), { ssr: false })
const BrandTabOrders = dynamic(() => import('./tabs/BrandTabOrders'), { ssr: false })
const BrandTabOrenTalk = dynamic(() => import('./tabs/BrandTabOrenTalk'), { ssr: false })
const BrandTabLive = dynamic(() => import('./tabs/BrandTabLive'), { ssr: false })
const BrandTabSample = dynamic(() => import('./tabs/BrandTabSample'), { ssr: false })
const BrandTabCommunity = dynamic(() => import('./tabs/BrandTabCommunity'), { ssr: false })
const BrandTabExpand = dynamic(() => import('./tabs/BrandTabExpand'), { ssr: false })
const BrandTabData = dynamic(() => import('./tabs/BrandTabData'), { ssr: false })
const BrandTabInvoice = dynamic(() => import('./tabs/BrandTabInvoice'), { ssr: false })
const BrandTabInventory = dynamic(() => import('./tabs/BrandTabInventory'), { ssr: false })
const BrandPinGate = dynamic(() => import('./components/BrandPinGate'), { ssr: false })
const BrandWatermark = dynamic(() => import('./components/BrandWatermark'), { ssr: false })
const BrandTabReport = dynamic(() => import('./tabs/BrandTabReport'), { ssr: false })
const BrandTabReturns = dynamic(() => import('./tabs/BrandTabReturns'), { ssr: false })

const BG = '#0f0d14'
const ACC = '#7B5EA7'
const GOLD = '#C9A96E'

const ORIGIN_PRESETS = ['프랑스', '한국', '독일', '이탈리아', '스페인', '스위스', '미국', '일본', '기타(직접입력)'] as const
const PRODUCT_PRESETS = ['스킨케어', '클렌징', '마스크', '바디케어', '헤어케어', '선케어', '더마코스메틱'] as const
const BANKS = ['국민', '신한', '우리', '하나', '기업', '농협', '카카오뱅크', '토스뱅크', 'SC제일', '기타'] as const

type Row = Record<string, unknown> & { id: string; name?: string | null; status?: string | null; thumb_img?: string | null }

export default function BrandDashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const loginRole = searchParams.get('login_role') || 'director'
  const isCEO = loginRole === 'ceo'
  const [pinAuth, setPinAuth] = useState<{
    id: string
    name: string
    role: string
    permissions: string[]
  } | null>(null)
  const [authId, setAuthId] = useState<string | null>(null)
  const [userPk, setUserPk] = useState<string | null>(null)
  const [brandId, setBrandId] = useState<string | null>(null)
  const [brandName, setBrandName] = useState('')
  const [brandRow, setBrandRow] = useState<Record<string, unknown> | null>(null)
  const [myBrands, setMyBrands] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [activeBrandId, setActiveBrandId] = useState<string | null>(null)
  const [showBrandDropdown, setShowBrandDropdown] = useState(false)
  const [showAddBrand, setShowAddBrand] = useState(false)
  const [addBrandName, setAddBrandName] = useState('')
  const [addBrandNameEn, setAddBrandNameEn] = useState('')
  const [addBrandCountry, setAddBrandCountry] = useState('')
  const [addBrandContact, setAddBrandContact] = useState('')
  const [addBrandLoading, setAddBrandLoading] = useState(false)
  const [addBrandDone, setAddBrandDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'pending' | 'active' | 'hidden'>('pending')
  const [mainTab, setMainTab] = useState<'home' | 'products' | 'owners' | 'orders' | 'orentalk' | 'live' | 'sample' | 'community' | 'expand' | 'data' | 'invoice' | 'inventory' | 'report' | 'returns' | 'settlement'>('home')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<{ id: string } | null>(null)
  const [brands, setBrands] = useState<{ id: string; name: string; origin_country?: string | null }[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [applyStep, setApplyStep] = useState(1)
  const [applyErr, setApplyErr] = useState('')
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyFolder] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`))

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

  const applyStNorm = useMemo(() => {
    const raw = brandRow?.apply_status
    if (raw == null || raw === '') return ''
    return String(raw).toLowerCase().trim()
  }, [brandRow])

  const needsApply = !brandId || (applyStNorm !== 'pending' && applyStNorm !== 'approved')
  const isPending = applyStNorm === 'pending'
  const isApproved = applyStNorm === 'approved'
  const showWelcome = isApproved && brandRow !== null && brandRow.welcome_shown === false

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login?role=brand')
      return
    }
    setAuthId(user.id)
    const { data: u } = await supabase.from('users').select('id,role').eq('auth_id', user.id).maybeSingle()
    if (!u?.id || (u as { role?: string }).role !== 'brand') {
      router.replace('/login?role=brand')
      return
    }
    setUserPk(u.id)
    const { data: brandList } = await supabase
      .from('brands')
      .select('id,name,apply_status,welcome_shown,manager_name,origin_country,settlement_cycle,approved_at,logo_url,created_at')
      .eq('user_id', u.id)
      .order('created_at', { ascending: true })
    const b = brandList?.[0] || null
    const bid = (b as { id?: string } | null)?.id || null
    setBrandId(bid)
    setBrandRow((b as Record<string, unknown> | null) || null)
    setBrandName(String((b as { name?: string } | null)?.name || ''))
    const { data: memberRows } = await supabase
      .from('brand_members')
      .select('brand_id, role, brands(id, name)')
      .eq('user_id', u.id)
    if (memberRows && memberRows.length > 0) {
      const list = memberRows.map((m: any) => ({
        id: m.brands?.id ?? m.brand_id,
        name: m.brands?.name ?? '',
        role: m.role,
      }))
      setMyBrands(list)
      if (!activeBrandId) setActiveBrandId(list[0]?.id ?? null)
    }
    const { data: pr } = await supabase
      .from('products')
      .select('*, brands(id,name)')
      .eq('brand_user_id', user.id)
      .eq('brand_id', bid ?? '')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setRows((pr || []) as Row[])
    setLoading(false)
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    supabase
      .from('brands')
      .select('id,name,origin_country')
      .order('name')
      .then(({ data }) => setBrands((data || []) as { id: string; name: string; origin_country?: string | null }[]))
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  const uploadAsset = async (file: File, prefix: string) => {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `apply/${applyFolder}/${prefix}_${Date.now()}.${ext}`
    file = await compressImage(file, 'brand_logo')
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (error) throw error
    const { data } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return data.publicUrl as string
  }

  const applySubmit = useCallback(async () => {
    setApplyErr('')
    if (!logoFile) {
      setApplyErr('브랜드 로고를 선택해 주세요.')
      return
    }
    if (!nameEn.trim()) {
      setApplyErr('브랜드명(영문)을 입력해 주세요.')
      return
    }
    if (!intro.trim() || intro.trim().length > 200) {
      setApplyErr('브랜드 소개를 200자 이내로 입력해 주세요.')
      return
    }
    if (!resolvedOrigin) {
      setApplyErr('원산지를 선택하거나 직접 등록해 주세요.')
      return
    }
    if (categories.length === 0) {
      setApplyErr('주요 취급 제품군을 1개 이상 선택해 주세요.')
      return
    }
    if (!mgrName.trim() || !mgrEmail.trim() || !mgrPhone.trim() || !addr1.trim() || !addr2.trim()) {
      setApplyErr('담당자 정보와 주소를 입력해 주세요.')
      return
    }
    if (!bizNo.trim() || !corpName.trim() || !ceoName.trim() || !bizDoc) {
      setApplyErr('사업자 정보와 사업자등록증을 입력해 주세요.')
      return
    }
    if (!resolvedBank || !bankAccount.trim() || !bankHolder.trim() || (bankSel === '기타' && !bankOther.trim())) {
      setApplyErr('정산 계좌 정보를 입력해 주세요.')
      return
    }
    if (!settlement || !sampleAvail) {
      setApplyErr('공급 조건을 선택해 주세요.')
      return
    }
    if (!agree1 || !agree2 || !agree3) {
      setApplyErr('필수 약관에 동의해 주세요.')
      return
    }

    setApplyBusy(true)
    try {
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
      const bizDocUrl = await uploadAsset(bizDoc, 'biz')
      let commerceUrl: string | null = null
      if (commerceDoc) commerceUrl = await uploadAsset(commerceDoc, 'commerce')
      let importUrl: string | null = null
      if (importDoc) importUrl = await uploadAsset(importDoc, 'import')

      const fy = foundedYear.trim() === '' ? null : Math.floor(Number(foundedYear))
      const prMin = priceMin.trim() === '' ? null : Math.floor(Number(priceMin))
      const prMax = priceMax.trim() === '' ? null : Math.floor(Number(priceMax))

      const addressBlock = [addr1.trim(), addr2.trim()].filter(Boolean).join('\n')
      const termsNote = `약관동의: 파트너/개인정보/위탁=${agree1 && agree2 && agree3 ? 'Y' : 'N'}, 마케팅=${agreeMkt ? 'Y' : 'N'}`
      const extraMerged = [extraReq.trim(), `상호(법인명): ${corpName.trim()}`, termsNote].filter(Boolean).join('\n\n')

      const payload: Record<string, unknown> = {
        user_id: userPk,
        name: nameEn.trim(),
        brand_name_kr: nameKr.trim() || null,
        origin: resolvedOrigin || null,
        origin_country: resolvedOrigin || null,
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

      if (brandId) {
        const { error: upErr } = await supabase.from('brands').update(payload as any).eq('id', brandId)
        if (upErr) throw new Error(upErr.message)
      } else {
        const { error: insErr } = await supabase.from('brands').insert(payload as any).select('id').single()
        if (insErr) throw new Error(insErr.message)
      }

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

      await load()
      setApplyStep(1)
    } catch (e: unknown) {
      setApplyErr(e instanceof Error ? e.message : '신청 처리 중 오류가 발생했습니다.')
    } finally {
      setApplyBusy(false)
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
    brandId,
    categories,
    ceoName,
    commerceDoc,
    corpName,
    extraReq,
    importDoc,
    intro,
    kakaoId,
    load,
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
    userPk,
    foundedYear,
  ])

  const applyGoNext = () => {
    setApplyErr('')
    if (applyStep === 1) {
      if (!logoFile) {
        setApplyErr('브랜드 로고를 선택해 주세요.')
        return
      }
      if (!nameEn.trim() || !intro.trim() || intro.trim().length > 200 || !resolvedOrigin || categories.length === 0) {
        setApplyErr('STEP 1 필수 항목을 확인해 주세요.')
        return
      }
    }
    if (applyStep === 2) {
      if (!mgrName.trim() || !mgrEmail.trim() || !mgrPhone.trim() || !addr1.trim() || !addr2.trim()) {
        setApplyErr('STEP 2 필수 항목을 확인해 주세요.')
        return
      }
    }
    if (applyStep === 3) {
      if (!bizNo.trim() || !corpName.trim() || !ceoName.trim() || !bizDoc || !resolvedBank || !bankAccount.trim() || !bankHolder.trim() || (bankSel === '기타' && !bankOther.trim())) {
        setApplyErr('STEP 3 필수 항목을 확인해 주세요.')
        return
      }
    }
    if (applyStep === 4) {
      if (!settlement || !sampleAvail) {
        setApplyErr('STEP 4 필수 항목을 확인해 주세요.')
        return
      }
    }
    setApplyStep(s => Math.min(5, s + 1))
  }

  const applyGoPrev = () => {
    setApplyErr('')
    setApplyStep(s => Math.max(1, s - 1))
  }

  const dismissWelcome = async () => {
    if (!brandId) return
    const { error } = await supabase.from('brands').update({ welcome_shown: true } as any).eq('id', brandId)
    if (error) {
      setToast(error.message || '저장 실패')
      return
    }
    setBrandRow(r => (r ? { ...r, welcome_shown: true } : r))
  }

  const filtered = useMemo(() => {
    return rows.filter(p => {
      const st = String(p.status || '')
      if (tab === 'pending') return st === 'pending'
      if (tab === 'active') return st === 'active'
      return st === 'discontinued' || st === 'hidden'
    })
  }, [rows, tab])

  const counts = useMemo(() => {
    let pending = 0
    let active = 0
    let hidden = 0
    for (const p of rows) {
      const st = String(p.status || '')
      if (st === 'pending') pending++
      else if (st === 'active') active++
      else if (st === 'discontinued' || st === 'hidden') hidden++
    }
    return { pending, active, hidden }
  }, [rows])

  const listTabForModal = (p: Row): 'pending' | 'active' | 'rejected' => {
    const st = String(p.status || '')
    if (st === 'pending') return 'pending'
    if (st === 'active') return 'active'
    return 'rejected'
  }

  const fetchRows = useCallback(async (overrideBrandId?: string) => {
    if (!authId) return
    const targetBrandId = overrideBrandId || brandId
    const { data: pr } = await supabase
      .from('products')
      .select('*, brands(id,name)')
      .eq('brand_user_id', authId)
      .eq('brand_id', targetBrandId ?? '')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setRows((pr || []) as Row[])
  }, [authId, brandId])

  const approveOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'active' }).eq('id', id).eq('brand_user_id', authId || '')
    setBusyId(null)
    await fetchRows()
  }

  const rejectOne = async (id: string) => {
    setBusyId(id)
    await supabase.from('products').update({ status: 'discontinued' }).eq('id', id).eq('brand_user_id', authId || '')
    setBusyId(null)
    await fetchRows()
  }

  const saveFlashSale = async (
    id: string,
    payload: { is_flash_sale: boolean; flash_sale_price: number | null; flash_sale_start: string | null; flash_sale_end: string | null }
  ) => {
    let q = supabase.from('products').update(payload as any).eq('id', id)
    if (authId) q = q.eq('brand_user_id', authId)
    const { error } = await q
    if (error) {
      setToast(error.message || '저장 실패')
      return
    }
    await fetchRows()
    setToast('타임세일 저장됨')
  }

  const handleProductUpdated = (p: any) => {
    setEditProduct(p)
    setRows(prev => prev.map(r => (r.id === p.id ? { ...r, ...p } : r)))
  }

  const badge = (p: Row) => {
    const st = String(p.status || '')
    if (st === 'pending') return { t: 'PENDING', c: 'rgba(255,193,7,0.25)', b: 'rgba(255,193,7,0.45)' }
    if (st === 'active') return { t: 'ACTIVE', c: 'rgba(76,175,80,0.2)', b: 'rgba(76,175,80,0.45)' }
    return { t: 'HIDDEN', c: 'rgba(158,158,158,0.18)', b: 'rgba(158,158,158,0.4)' }
  }

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

  if (loading || !authId) {
    return (
      <div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  if (!pinAuth && brandId) {
    return (
      <BrandPinGate
        brandId={brandId}
        brandName={brandName}
        onAuth={setPinAuth}
      />
    )
  }

  if (needsApply) {
    const progress = (applyStep / 5) * 100
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#e9e4f1', padding: '20px 16px 40px', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <Link href="/dashboard/brand" style={{ fontSize: 22, color: '#f5f0ff', letterSpacing: '0.12em', textDecoration: 'none' }}>
            AURAN
          </Link>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 6, letterSpacing: '0.08em' }}>BRAND PARTNER ONBOARDING</div>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: ACC, transition: 'width 0.25s ease' }} />
        </div>
        {applyErr ? (
          <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: 'rgba(229,57,53,0.12)', border: '1px solid rgba(229,57,53,0.35)', fontSize: 12, color: '#ffb4b4' }}>{applyErr}</div>
        ) : null}
        {applyStep === 1 && (
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
                  <button
                    type="button"
                    onClick={() => {
                      const t = originCustom.trim()
                      if (!t) return
                      setOriginDisplay(t)
                      setOriginSel('')
                      setOriginCustom('')
                    }}
                    style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${ACC}`, background: 'rgba(123,94,167,0.2)', color: '#e8dff9', fontSize: 12, cursor: 'pointer' }}
                  >
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
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => {
                  const arr = Array.from(e.target.files || [])
                  setStoryImages(prev => {
                    const next = [...prev]
                    for (const file of arr) {
                      next.push({ id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, file, preview: URL.createObjectURL(file) })
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
              <div style={{ marginTop: 8 }}>
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
              <div style={{ marginTop: 8 }}>
                <span style={{ ...label, marginBottom: 4 }}>영상 MP4 (50MB 이하)</span>
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
                  <span
                    key={p}
                    role="button"
                    tabIndex={0}
                    style={chip(categories.includes(p))}
                    onClick={() => setCategories(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]))}
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <input value={catCustom} onChange={e => setCatCustom(e.target.value)} style={{ ...input, flex: 1, minWidth: 160 }} placeholder="직접 등록" />
                <button
                  type="button"
                  onClick={() => {
                    const t = catCustom.trim()
                    if (!t || categories.includes(t)) return
                    setCategories(prev => [...prev, t])
                    setCatCustom('')
                  }}
                  style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${ACC}`, background: 'rgba(123,94,167,0.2)', color: '#e8dff9', fontSize: 12, cursor: 'pointer' }}
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        )}
        {applyStep === 2 && (
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
        {applyStep === 3 && (
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
                  {BANKS.map(bk => (
                    <option key={bk} value={bk} style={{ background: '#1a1522' }}>
                      {bk}
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
        {applyStep === 4 && (
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
              <textarea value={promoCondition} onChange={e => setPromoCondition(e.target.value)} style={{ ...input, minHeight: 100, resize: 'vertical' }} />
            </div>
            <div>
              <span style={label}>정산 주기 희망 (필수)</span>
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
        {applyStep === 5 && (
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
              disabled={applyBusy}
              onClick={() => void applySubmit()}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: `1px solid ${ACC}`,
                background: 'rgba(123,94,167,0.3)',
                color: '#f3ecff',
                fontSize: 14,
                cursor: applyBusy ? 'not-allowed' : 'pointer',
                opacity: applyBusy ? 0.7 : 1,
              }}
            >
              {applyBusy ? '처리 중…' : '입점 신청하기'}
            </button>
            <button type="button" onClick={applyGoPrev} style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>
              이전
            </button>
          </div>
        )}
        {applyStep < 5 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, gap: 10 }}>
            <button
              type="button"
              onClick={applyGoPrev}
              disabled={applyStep <= 1}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                cursor: applyStep <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              이전
            </button>
            <button
              type="button"
              onClick={applyGoNext}
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

  if (isPending) {
    const applied =
      brandRow?.created_at != null ? new Date(String(brandRow.created_at)).toLocaleString('ko-KR') : '—'
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#e9e4f1', padding: '32px 20px', maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <Link href="/dashboard/brand" style={{ fontSize: 22, color: '#f5f0ff', letterSpacing: '0.12em', textDecoration: 'none' }}>
          AURAN
        </Link>
        <div style={{ fontSize: 18, color: ACC, marginTop: 28, marginBottom: 12 }}>입점 신청이 접수됐어요</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>영업일 3~5일 내 검토 결과를 이메일로 안내드려요</div>
        <div style={{ marginTop: 22, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>신청일: {applied}</div>
      </div>
    )
  }

  const logoUrlStr = brandRow?.logo_url != null ? String(brandRow.logo_url) : ''
  const displayName = brandName || String(brandRow?.name || '')
  const originShow = String(brandRow?.origin_country || '—')
  const mgrShow = String(brandRow?.manager_name || '—')
  const settleShow = String(brandRow?.settlement_cycle || '—')
  const approvedStr = brandRow?.approved_at ? new Date(String(brandRow.approved_at)).toLocaleDateString('ko-KR') : '—'
  const initialLetter = displayName.trim().slice(0, 1).toUpperCase() || 'B'

  return (
    <div style={{ position: 'relative', background: BG, minHeight: '100vh', color: '#e9e4f1', padding: '20px 16px 48px', maxWidth: 780, margin: '0 auto' }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes branddash_sparkle{0%,100%{opacity:0.3}50%{opacity:1}}@keyframes branddash_float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`,
        }}
      />
      {showWelcome ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            minHeight: '100%',
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 400,
              background: BG,
              border: '1px solid rgba(201,169,110,0.3)',
              borderRadius: 20,
              overflow: 'hidden',
            }}
          >
            <div style={{ height: 3, background: GOLD }} />
            <div style={{ padding: '20px 18px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 14 }}>
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    style={{
                      fontSize: 18,
                      color: GOLD,
                      animation: 'branddash_sparkle 1.2s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                    }}
                  >
                    ✦
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12, animation: 'branddash_float 2.5s ease-in-out infinite' }}>
                {logoUrlStr ? (
                  <img src={logoUrlStr} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 12 }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(123,94,167,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#e4daf5' }}>{initialLetter}</div>
                )}
                <span style={{ fontSize: 16, color: '#f0eaf8' }}>{displayName}</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: 17, color: ACC, marginBottom: 10 }}>AURAN 파트너가 되셨어요!</div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: `1px solid ${GOLD}`, color: GOLD }}>승인일 {approvedStr}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
                <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>브랜드명</div>
                  {displayName}
                </div>
                <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>원산지</div>
                  {originShow}
                </div>
                <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>담당자</div>
                  {mgrShow}
                </div>
                <div style={{ padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>정산주기</div>
                  {settleShow}
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 14 }}>AURAN과 함께해 주셔서 감사해요 💜</div>
              <ol style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', paddingLeft: 18, marginBottom: 16, lineHeight: 1.6 }}>
                <li>브랜드 정보 최종 확인</li>
                <li>제품 등록 → 납품가 입력 후 승인 요청</li>
                <li>어드민 제품 승인 → 고객에게 노출</li>
              </ol>
              <button
                type="button"
                onClick={() => void dismissWelcome()}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: `1px solid ${ACC}`,
                  background: 'rgba(123,94,167,0.25)',
                  color: '#f0e8ff',
                  fontSize: 13,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                대시보드 바로 가기
              </button>
              <button
                type="button"
                onClick={() => void dismissWelcome()}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 12, cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
            <div style={{ height: 3, background: GOLD }} />
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 500,
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(26,22,34,0.96)',
            border: `1px solid rgba(123,94,167,0.4)`,
            fontSize: 12,
            color: '#e8dff9',
          }}
        >
          {toast}
        </div>
      ) : null}

      {pinAuth && (
        <BrandWatermark
          staffName={pinAuth.name}
          staffRole={pinAuth.role}
        />
      )}

      {editProduct ? (
        <BrandProductFormV2
          brandId={brandId!}
          brandName={brandName}
          authUserId={authId!}
          productId={editProduct.id}
          onSaved={() => { setEditProduct(null); void fetchRows() }}
        />
      ) : null}

      {formOpen && (
        <BrandProductFormV2
          brandId={brandId!}
          brandName={brandName}
          authUserId={authId!}
          onSaved={() => { setFormOpen(false); void fetchRows() }}
        />
      )}

      {myBrands.length > 1 && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <button
            onClick={() => setShowBrandDropdown(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: '#fff', fontSize: 13 }}
          >
            <span>{myBrands.find(b => b.id === activeBrandId)?.name ?? brandName}</span>
            <span style={{ fontSize: 10, opacity: 0.5 }}>▼</span>
          </button>
          {showBrandDropdown && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, minWidth: 180, zIndex: 50, overflow: 'hidden' }}>
              {myBrands.map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    setActiveBrandId(b.id)
                    setBrandId(b.id)
                    setBrandName(b.name)
                    setShowBrandDropdown(false)
                    void fetchRows(b.id)
                  }}
                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 13, color: b.id === activeBrandId ? '#7B5EA7' : 'rgba(255,255,255,0.7)', background: b.id === activeBrandId ? 'rgba(123,94,167,0.1)' : 'transparent' }}
                >
                  {b.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          onClick={() => setShowAddBrand(true)}
          style={{ fontSize: 12, color: '#7B5EA7', background: 'rgba(123,94,167,0.1)', border: '1px solid rgba(123,94,167,0.3)', borderRadius: 20, padding: '6px 14px', cursor: 'pointer' }}
        >
          + 브랜드 추가
        </button>
      </div>
      {showAddBrand && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#1a1a2e', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 }}>
            {addBrandDone ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
                <div style={{ fontSize: 15, color: '#fff', marginBottom: 8 }}>브랜드 추가 신청 완료!</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>승인 후 대시보드에서 전환할 수 있어요</div>
                <button
                  onClick={() => {
                    setShowAddBrand(false)
                    setAddBrandDone(false)
                    setAddBrandName('')
                    setAddBrandNameEn('')
                    setAddBrandCountry('')
                    setAddBrandContact('')
                  }}
                  style={{ padding: '10px 24px', borderRadius: 20, background: '#7B5EA7', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer' }}
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 15, color: '#fff' }}>새 브랜드 추가</span>
                  <button onClick={() => setShowAddBrand(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18 }}>
                    ✕
                  </button>
                </div>
                {[
                  { label: '브랜드명 (한글)', value: addBrandName, set: setAddBrandName, placeholder: '예: 탈라' },
                  { label: '브랜드명 (영문)', value: addBrandNameEn, set: setAddBrandNameEn, placeholder: '예: THALAC' },
                  { label: '원산지', value: addBrandCountry, set: setAddBrandCountry, placeholder: '예: 프랑스' },
                  { label: '담당자 연락처', value: addBrandContact, set: setAddBrandContact, placeholder: '010-0000-0000' },
                ].map(({ label, value, set, placeholder }) => (
                  <div key={label} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
                    <input
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder={placeholder}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontSize: 13,
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>
                ))}
                <button
                  disabled={addBrandLoading || !addBrandName}
                  onClick={async () => {
                    if (!addBrandName) return
                    setAddBrandLoading(true)
                    const {
                      data: { user },
                    } = await supabase.auth.getUser()
                    if (!user) {
                      setAddBrandLoading(false)
                      return
                    }
                    const { data: newBrand, error } = await supabase
                      .from('brands')
                      .insert({
                        name: addBrandName,
                        name_en: addBrandNameEn || null,
                        origin_country: addBrandCountry || '대한민국',
                        user_id: user.id,
                        apply_status: 'approved',
                        welcome_shown: true,
                        manager_phone: addBrandContact || null,
                      })
                      .select('id')
                      .single()
                    if (!error && newBrand) {
                      await supabase.from('brand_members').insert({
                        user_id: user.id,
                        brand_id: newBrand.id,
                        role: 'owner',
                      })
                      await supabase.from('notifications').insert({
                        type: 'brand_apply',
                        message: `새 브랜드 추가 신청: ${addBrandName}`,
                        is_read: false,
                      })
                      setAddBrandDone(true)
                      const newEntry = { id: newBrand.id, name: addBrandName, role: 'owner' }
                      setMyBrands(prev => [...prev, newEntry])
                      setActiveBrandId(newBrand.id)
                      setBrandId(newBrand.id)
                      setBrandName(addBrandName)
                      void fetchRows(newBrand.id)
                    }
                    setAddBrandLoading(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: addBrandLoading || !addBrandName ? 'rgba(123,94,167,0.3)' : '#7B5EA7',
                    border: 'none',
                    color: '#fff',
                    fontSize: 14,
                    cursor: 'pointer',
                    marginTop: 8,
                  }}
                >
                  {addBrandLoading ? '신청 중...' : '신청하기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 상단 탭 네비 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', borderBottom: '0.5px solid rgba(255,255,255,0.07)', paddingBottom: 12 }}>
        {([
          { key: 'home', label: '홈', icon: '🏠' },
          { key: 'products', label: '제품 관리', icon: '🧴' },
          { key: 'owners', label: '원장님 관리', icon: '👥' },
          { key: 'orders', label: '발주', icon: '📦' },
          { key: 'orentalk', label: '오렌톡', icon: '💜' },
          { key: 'live', label: '교육라이브', icon: '🎓' },
          { key: 'sample', label: '샘플', icon: '🎁' },
          { key: 'community', label: '커뮤니티', icon: '💬' },
          { key: 'expand', label: '외연확장', icon: '🌐' },
          { key: 'data', label: '데이터', icon: '📊' },
          { key: 'invoice', label: '주문내역서', icon: '🖨️' },
          { key: 'inventory', label: '재고·물류', icon: '📦' },
          { key: 'report', label: '대조리포트', icon: '📋' },
          { key: 'returns', label: '반품·교환', icon: '↩️' },
          ...(isCEO ? [{ key: 'settlement' as const, label: '정산', icon: '💰' }] : []),
        ] as const).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMainTab(t.key)}
            style={{
              fontSize: 12,
              padding: '5px 14px',
              borderRadius: 20,
              border: `0.5px solid ${mainTab === t.key ? '#7B5EA7' : 'rgba(255,255,255,0.1)'}`,
              background: mainTab === t.key ? 'rgba(123,94,167,0.2)' : 'transparent',
              color: mainTab === t.key ? '#c4a7e7' : 'rgba(255,255,255,0.3)',
              cursor: 'pointer',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {/* 탭 컨텐츠 */}
      {mainTab === 'home' && (
        <BrandTabHome
          brandName={brandName}
          brandId={brandId}
          activeBrandId={activeBrandId}
          onTabChange={(t) => setMainTab(t as typeof mainTab)}
        />
      )}
      {mainTab === 'products' && (
        <BrandTabProducts
          rows={rows}
          tab={tab}
          onTabChange={setTab}
          onEdit={(p) => setEditProduct(p as { id: string })}
          onNew={() => setFormOpen(true)}
        />
      )}
      {mainTab === 'owners' && (
        <BrandTabOwners
          brandId={brandId}
          brandName={brandName}
          authId={authId}
        />
      )}
      {mainTab === 'orders' && (
        <BrandTabOrders
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'orentalk' && (
        <BrandTabOrenTalk
          brandName={brandName}
          brandId={brandId}
          authId={authId}
        />
      )}
      {mainTab === 'live' && (
        <BrandTabLive
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'sample' && (
        <BrandTabSample
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'community' && (
        <BrandTabCommunity
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'expand' && (
        <BrandTabExpand
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'data' && (
        <BrandTabData
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'invoice' && (
        <BrandTabInvoice
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'inventory' && (
        <BrandTabInventory
          brandId={brandId}
          brandName={brandName}
          authId={authId}
          loginRole={loginRole}
        />
      )}
      {mainTab === 'report' && (
        <BrandTabReport
          brandId={brandId}
          brandName={brandName}
        />
      )}
      {mainTab === 'returns' && (
        <BrandTabReturns
          brandId={brandId}
          brandName={brandName}
        />
      )}
    </div>
  )
}
