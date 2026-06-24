'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { uploadToStorage, uploadVideoToStorage, insertNewProduct, updateProduct } from '@/lib/product/productFormUtils'
import dynamic from 'next/dynamic'

const ProductDetailEditor = dynamic(() => import('@/components/admin/ProductDetailEditor'), { ssr: false })

export default function ProductEditFormV2({ id: idProp }: { id?: string }) {
  const supabase = createClient()
  const router = useRouter()
  const editId = idProp || null
  const workingIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tmpSavedAt, setTmpSavedAt] = useState<string | null>(null)
  const [showDraftPicker, setShowDraftPicker] = useState(false)
  const [draftList, setDraftList] = useState<{ id: string; name: string; created_at: string }[]>([])

  const [name, setName] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [keywords, setKeywords] = useState('')
  const [brandId, setBrandId] = useState('')
  const [brands, setBrands] = useState<any[]>([])
  const [origin, setOrigin] = useState('')
  const [categoryText, setCategoryText] = useState('')
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; parent_id: string | null; level: number; sort_order: number | null }[]>([])
  const [catL1, setCatL1] = useState('')
  const [catL2, setCatL2] = useState('')
  const [catL3, setCatL3] = useState('')
  const [catL4, setCatL4] = useState('')
  const [catL5, setCatL5] = useState('')
  const [productCategoryLeafId, setProductCategoryLeafId] = useState('')
  const [selectedSkinTagIds, setSelectedSkinTagIds] = useState<string[]>([])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [categoryPickerTab, setCategoryPickerTab] = useState<'search' | 'select'>('select')
  const [categorySearch, setCategorySearch] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [isFlashSale, setIsFlashSale] = useState(false)
  const [isExclusive, setIsExclusive] = useState(false)

  const [retailPrice, setRetailPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [unitType, setUnitType] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [stockInput, setStockInput] = useState('')
  const [avgUsageDays, setAvgUsageDays] = useState('')

  const [earnPointsPercent, setEarnPointsPercent] = useState('2')
  const [shareVal, setShareVal] = useState('3')
  const [reviewText, setReviewText] = useState('2')
  const [reviewPhoto, setReviewPhoto] = useState('3')
  const [reviewVideo, setReviewVideo] = useState('3')

  const [thumbImages, setThumbImages] = useState<(string | null)[]>([null, null, null, null, null])
  const [videoUrl, setVideoUrl] = useState('')
  const [detailImages, setDetailImages] = useState<string[]>([])
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null])
  const videoRef = useRef<HTMLInputElement | null>(null)
  const detailFileRef = useRef<HTMLInputElement | null>(null)

  const [detailContent, setDetailContent] = useState('')
  // 옵션
  const [useOpt1, setUseOpt1] = useState(false)
  const [optName1, setOptName1] = useState('용량')
  const [optInput1, setOptInput1] = useState('')
  const [optVals1, setOptVals1] = useState<string[]>([])
  const [useOpt2, setUseOpt2] = useState(false)
  const [optName2, setOptName2] = useState('')
  const [optInput2, setOptInput2] = useState('')
  const [optVals2, setOptVals2] = useState<string[]>([])
  // 사은품
  const [useGift, setUseGift] = useState(false)
  const [giftInput, setGiftInput] = useState('')
  const [giftVals, setGiftVals] = useState<string[]>([])
  const [giftMemo, setGiftMemo] = useState('')

  const [keyIngredients, setKeyIngredients] = useState('')
  const [ingredientText, setIngredientText] = useState('')
  const [clinicalResult, setClinicalResult] = useState('')
  const [certifications, setCertifications] = useState('')
  const [ingredientAnalyzeLoading, setIngredientAnalyzeLoading] = useState(false)
  const ingredientPhotoRef = useRef<HTMLInputElement | null>(null)

  const [ptInput, setPtInput] = useState('')
  const [ptResults, setPtResults] = useState<{ id: string; name: string }[]>([])
  const [ptSelected, setPtSelected] = useState<{ id: string; name: string }[]>([])

  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
  const [hormoneStages, setHormoneStages] = useState<string[]>([])
  const [stepTags, setStepTags] = useState<string[]>([])
  const [skinTypes, setSkinTypes] = useState<string[]>([])
  const [seasonTags, setSeasonTags] = useState<string[]>([])
  const [ingredientTags, setIngredientTags] = useState('')

  const [isActive, setIsActive] = useState(true)

  const [eventEmoji, setEventEmoji] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventStartsAt, setEventStartsAt] = useState('')
  const [eventEndsAt, setEventEndsAt] = useState('')

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [medicalTags, setMedicalTags] = useState('')
  const [bodyPartTags, setBodyPartTags] = useState<string[]>([])

  useEffect(() => {
    supabase.from('brands').select('id,name').order('name').then(({ data }) => setBrands(data || []))
  }, [supabase])

  // categories 로드
  useEffect(() => {
    supabase.from('categories').select('id,name,parent_id,level,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .then(({ data }) => setAllCategories((data || []) as typeof allCategories))
  }, [])
  // 리프 ID → catL1~5 역추적
  useEffect(() => {
    const leaf = productCategoryLeafId
    if (!leaf || allCategories.length === 0) return
    const chain: string[] = []
    let cur = allCategories.find(c => c.id === leaf)
    while (cur) {
      chain.unshift(cur.id)
      cur = cur.parent_id ? allCategories.find(c => c.id === cur!.parent_id) : undefined
    }
    const [l1, l2, l3, l4, l5] = chain
    setCatL1(l1 || ''); setCatL2(l2 || ''); setCatL3(l3 || ''); setCatL4(l4 || ''); setCatL5(l5 || '')
    setProductCategoryLeafId('')
  }, [productCategoryLeafId, allCategories])
  // 슈퍼어드민 체크
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('users').select('role').eq('auth_id', data.user.id).single().then(({ data: u }) => {
        setIsSuperAdmin(u?.role === 'admin' || u?.role === 'super_admin')
      })
    })
  }, [supabase])

  useEffect(() => {
    if (!editId) return
    setLoading(true)
    supabase.from('products').select('*').eq('id', editId).single().then(({ data }) => {
      if (!data) {
        setLoading(false)
        return
      }
      setName(data.name || '')
      setShortDesc(data.description || '')
      setKeywords(data.tag || '')
      setBrandId(data.brand_id || '')
      setOrigin(data.category || '')
      setCategoryText(data.category || '')
      setManufacturer(data.ingredient || '')
      setRetailPrice(String(data.retail_price || ''))
      setSalePrice(String(data.sale_price || ''))
      setUnitType(data.unit_type || '')
      setUnitPrice(String(data.unit_price || ''))
      setStockInput(String(data.stock || ''))
      setAvgUsageDays(String(data.avg_usage_days || ''))
      setEarnPointsPercent(String(data.earn_points_percent || ''))
      setShareVal(String(data.share_points || ''))
      setReviewText(String(data.review_points_text || ''))
      setReviewPhoto(String(data.review_points_photo || ''))
      setReviewVideo(String(data.review_points_video || ''))
      setThumbImages(data.thumb_images?.length ? data.thumb_images : [null, null, null, null, null])
      setVideoUrl(data.video_url || '')
      setDetailImages(data.detail_images || [])
      setDetailContent(data.detail_content || '')
      setKeyIngredients(data.key_ingredients || '')
      setClinicalResult(data.clinical_result || '')
      setCertifications(data.certifications || '')
      setPtSelected((data.perfect_together || []).map((id: string) => ({ id, name: id })))
      setSkinConcerns(data.skin_concerns || [])
      setHormoneStages(data.hormone_tags || [])
      setStepTags(data.step_tags || [])
      setSkinTypes(data.skin_types || [])
      setSeasonTags(data.season_tags || [])
      setIngredientTags((data.ingredient_tags || []).join(', '))
      if (data.category_id) setProductCategoryLeafId(data.category_id)
      try {
        const opts = data.options ? JSON.parse(data.options) : null
        if (opts?.opt1) { setUseOpt1(true); setOptName1(opts.opt1.name || '용량'); setOptVals1(opts.opt1.vals || []) }
        if (opts?.opt2) { setUseOpt2(true); setOptName2(opts.opt2.name || ''); setOptVals2(opts.opt2.vals || []) }
        if (opts?.gift) { setUseGift(true); setGiftVals(opts.gift.vals || []); setGiftMemo(opts.gift.memo || '') }
      } catch {}
      setIsActive(data.is_active ?? true)
      setIsExclusive(data.is_exclusive ?? false)
      setIsFlashSale(data.is_flash_sale ?? false)
      setEventEmoji(data.event_emoji || '')
      setEventTitle(data.event_title || '')
      setEventDesc(data.event_desc || '')
      setEventStartsAt(data.event_starts_at?.slice(0, 10) || '')
      setEventEndsAt(data.event_ends_at?.slice(0, 10) || '')
      setMedicalTags((data.medical_tags || []).join(', '))
      setBodyPartTags(data.body_part_tags || [])
      workingIdRef.current = editId
      setLoading(false)
    })
  }, [editId, supabase])

  const handleImagePick = useCallback(async (slot: number, file: File) => {
    if (!workingIdRef.current) {
      if (!brandId) { alert('브랜드를 먼저 선택해 주세요'); return }
      try {
        const pid = await insertNewProduct(supabase, { brand_id: brandId, name: name.trim() || '신규 상품', retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)), is_flash_sale: isFlashSale })
        workingIdRef.current = pid
        const now = new Date(); setTmpSavedAt(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
      } catch { alert('임시 저장 실패'); return }
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const url = await uploadToStorage(file, `edit/${workingIdRef.current}/${slot}-${Date.now()}.${ext}`)
    setThumbImages(prev => {
      const n = [...prev]
      n[slot] = url
      return n
    })
  }, [brandId, name, retailPrice, isFlashSale])

  const handleVideoPick = useCallback(async (file: File) => {
    if (!workingIdRef.current) {
      if (!brandId) { alert('브랜드를 먼저 선택해 주세요'); return }
      try {
        const pid = await insertNewProduct(supabase, { brand_id: brandId, name: name.trim() || '신규 상품', retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)), is_flash_sale: isFlashSale })
        workingIdRef.current = pid
        const now = new Date(); setTmpSavedAt(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
      } catch { alert('임시 저장 실패'); return }
    }
    const ext = file.name.split('.').pop() || 'mp4'
    const url = await uploadVideoToStorage(file, `edit/${workingIdRef.current}/video-${Date.now()}.${ext}`)
    setVideoUrl(url)
  }, [brandId, name, retailPrice, isFlashSale])

  const handleDetailImagePick = useCallback(async (file: File) => {
    if (!workingIdRef.current) {
      if (!brandId) { alert('브랜드를 먼저 선택해 주세요'); return }
      try {
        const pid = await insertNewProduct(supabase, { brand_id: brandId, name: name.trim() || '신규 상품', retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)), is_flash_sale: isFlashSale })
        workingIdRef.current = pid
        const now = new Date(); setTmpSavedAt(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
      } catch { alert('임시 저장 실패'); return }
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const url = await uploadVideoToStorage(file, `edit/${workingIdRef.current}/detail-${Date.now()}.${ext}`)
    setDetailImages(prev => [...prev, url])
  }, [brandId, name, retailPrice, isFlashSale])

  const buildPayload = () => ({
    brand_id: brandId || null,
    name: name.trim().slice(0, 100) || '신규 상품',
    description: shortDesc.trim() || null,
    tag: keywords.trim() || null,
    category_id: catL5 || catL4 || catL3 || catL2 || catL1 || null,
    category: categoryText.trim() || null,
    ingredient: manufacturer.trim() || null,
    retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)),
    sale_price: salePrice.trim() === '' ? null : Math.max(0, Math.floor(Number(salePrice))),
    unit_type: unitType || null,
    unit_price: unitPrice.trim() === '' ? null : Number(unitPrice),
    stock: stockInput.trim() === '' ? null : Math.max(0, Math.floor(Number(stockInput))),
    avg_usage_days: avgUsageDays.trim() === '' ? null : Math.max(1, Math.floor(Number(avgUsageDays))),
    shipping_fee: 3500,
    shipping_memo: '5만원 이상 무료배송 · 제주/도서산간 +5,000원',
    earn_points_percent: earnPointsPercent.trim() === '' ? null : Number(earnPointsPercent),
    share_points: shareVal.trim() === '' ? null : Math.floor(Number(shareVal)),
    review_points_text: reviewText.trim() === '' ? null : Math.floor(Number(reviewText)),
    review_points_photo: reviewPhoto.trim() === '' ? null : Math.floor(Number(reviewPhoto)),
    review_points_video: reviewVideo.trim() === '' ? null : Math.floor(Number(reviewVideo)),
    thumb_images: thumbImages.filter(Boolean),
    thumb_img: thumbImages.find(Boolean) || null,
    storage_thumb_url: thumbImages.find(Boolean) || null,
    video_url: videoUrl || null,
    detail_content: detailContent || null,
    key_ingredients: keyIngredients || null,
    clinical_result: clinicalResult || null,
    certifications: certifications || null,
    perfect_together: ptSelected.map(p => p.id),
    detail_images: detailImages,
    is_active: isActive,
    is_exclusive: isExclusive,
    is_flash_sale: isFlashSale,
    skin_concerns: skinConcerns.length ? skinConcerns : null,
    hormone_tags: hormoneStages.length ? hormoneStages : null,
    step_tags: stepTags.length ? stepTags : null,
    skin_types: skinTypes.length ? skinTypes : null,
    season_tags: seasonTags.length ? seasonTags : null,
    ingredient_tags: ingredientTags.trim() ? ingredientTags.split(',').map(s => s.trim()).filter(Boolean) : null,
    options: JSON.stringify({
      opt1: useOpt1 ? { name: optName1, vals: optVals1 } : null,
      opt2: useOpt2 ? { name: optName2, vals: optVals2 } : null,
      gift: useGift ? { vals: giftVals, memo: giftMemo } : null,
    }),
    event_emoji: eventEmoji || null,
    event_title: eventTitle || null,
    event_desc: eventDesc || null,
    event_starts_at: eventStartsAt || null,
    event_ends_at: eventEndsAt || null,
    medical_tags: medicalTags.trim() ? medicalTags.split(',').map(s => s.trim()).filter(Boolean) : null,
    body_part_tags: bodyPartTags.length ? bodyPartTags : null,
  })

  const onSave = async () => {
    setMsg('')
    if (!brandId) {
      setMsg('브랜드를 선택하세요')
      return
    }
    setSaving(true)
    try {
      let pid = editId || workingIdRef.current || null
      if (!pid) {
        pid = await insertNewProduct(supabase, {
          brand_id: brandId,
          name: name.trim().slice(0, 100) || '신규 상품',
          retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)),
          is_flash_sale: isFlashSale,
        })
        workingIdRef.current = pid
      }
      await updateProduct(supabase, pid!, buildPayload())
      if (typeof window !== 'undefined') {
        localStorage.removeItem(editId ? `auran_product_draft_${editId}` : 'auran_product_draft_new')
      }
      setMsg('저장 완료 ✓')
      setTimeout(() => setMsg(''), 3000)
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setSaving(false)
    }
  }

  const onTmpSave = async () => {
    if (!brandId) { alert('브랜드를 먼저 선택해 주세요'); return }
    if (!workingIdRef.current) {
      try {
        const pid = await insertNewProduct(supabase, { brand_id: brandId, name: name.trim() || '신규 상품', retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)), is_flash_sale: isFlashSale })
        workingIdRef.current = pid
      } catch { alert('임시 저장 실패'); return }
    }
    const now = new Date()
    setTmpSavedAt(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
    const key = editId ? `auran_product_draft_${editId}` : 'auran_product_draft_new'
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify({ name, shortDesc, retailPrice, salePrice }))
    }
  }

  const loadDrafts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, created_at')
      .eq('status', 'pending')
      .is('routine_category', null)
      .order('created_at', { ascending: false })
      .limit(20)
    setDraftList(data || [])
    setShowDraftPicker(true)
  }

  useEffect(() => {
    if (ptInput.trim().length < 1) {
      setPtResults([])
      return
    }
    const t = setTimeout(() => {
      supabase.from('products').select('id,name').ilike('name', `%${ptInput}%`).limit(5).then(({ data }) => setPtResults(data || []))
    }, 300)
    return () => clearTimeout(t)
  }, [ptInput, supabase])

  const S = {
    pg: { background: '#0D0B09', minHeight: '100vh', color: '#e8e4dc', fontFamily: 'var(--font-sans)' } as CSSProperties,
    topbar: { background: '#0D0B09', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 10 } as CSSProperties,
    body: { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, padding: '20px 24px', maxWidth: 1200, margin: '0 auto' } as CSSProperties,
    sec: { background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 } as CSSProperties,
    secTitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
    lbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' } as CSSProperties,
    inp: { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e8e4dc', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const } as CSSProperties,
    sel: { background: '#1a1714', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e8e4dc', fontSize: 13, outline: 'none', width: '100%' } as CSSProperties,
    row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 } as CSSProperties,
    row3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 } as CSSProperties,
    f: { marginBottom: 10 } as CSSProperties,
    tag: (on: boolean) => ({ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: on ? 'rgba(123,94,167,0.35)' : 'rgba(123,94,167,0.1)', border: `0.5px solid ${on ? 'rgba(123,94,167,0.6)' : 'rgba(123,94,167,0.25)'}`, color: '#c4a7e7', cursor: 'pointer', display: 'inline-block', margin: '3px 3px 0 0' }) as CSSProperties,
    goldTag: (on: boolean) => ({ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: on ? 'rgba(201,169,110,0.3)' : 'rgba(201,169,110,0.1)', border: `0.5px solid ${on ? 'rgba(201,169,110,0.6)' : 'rgba(201,169,110,0.25)'}`, color: '#c9a96e', cursor: 'pointer', display: 'inline-block', margin: '3px 3px 0 0' }) as CSSProperties,
    tog: (on: boolean) => ({ width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', background: on ? 'rgba(123,94,167,0.6)' : 'rgba(255,255,255,0.1)' }) as CSSProperties,
  }

  const toggleArr = (arr: string[], val: string, set: (v: string[]) => void) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const catOpts = (parentId: string | null) =>
    allCategories.filter(c => c.parent_id === parentId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const catOpts1 = useMemo(() => catOpts(null), [allCategories])
  const catOpts2 = useMemo(() => catOpts(catL1), [allCategories, catL1])
  const catOpts3 = useMemo(() => catOpts(catL2), [allCategories, catL2])
  const catOpts4 = useMemo(() => catOpts(catL3), [allCategories, catL3])
  const catOpts5 = useMemo(() => catOpts(catL4), [allCategories, catL4])
  const skinTagOptions = useMemo(() => allCategories.filter(c => c.level === 5), [allCategories])
  const categorySearchRows = useMemo(() => {
    if (!categorySearch.trim()) return []
    return allCategories.filter(c => c.name.includes(categorySearch.trim())).slice(0, 80)
  }, [allCategories, categorySearch])
  const categoryBreadcrumb = useMemo(() => {
    return [catL1, catL2, catL3, catL4, catL5].filter(Boolean).map(id => allCategories.find(c => c.id === id)?.name || '').filter(Boolean).join(' > ')
  }, [allCategories, catL1, catL2, catL3, catL4, catL5])

  const ActionBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {msg && <span style={{ fontSize: 12, color: msg.includes('완료') ? '#4cad7e' : '#e08080' }}>{msg}</span>}
      <button type="button" onClick={() => void onTmpSave()} style={{ padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>임시저장</button>
      {!editId && <button type="button" onClick={() => void loadDrafts()} style={{ padding: '7px 12px', borderRadius: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' }}>📋 불러오기</button>}
      <button type="button" onClick={() => void onSave()} disabled={saving} style={{ padding: '7px 18px', borderRadius: 8, background: '#7b5ea7', border: 'none', color: '#fff', fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => router.push('/admin/marketing/products')} style={{ padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>닫기</button>
    </div>
  )

  if (loading) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>불러오는 중...</div>

  return (
    <div style={S.pg}>
      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14 }}>{editId ? '상품 수정 (v2)' : '상품 등록 (v2)'}</span>
          {tmpSavedAt && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{tmpSavedAt} 임시저장됨</span>}
        </div>
        <ActionBar />
      </div>
      <div style={S.body}>
        <div>
          <div style={S.sec}>
            <div style={S.secTitle}>기본 정보</div>
            <div style={S.f}><span style={S.lbl}>상품명 (최대 100자)</span><input style={S.inp} value={name} onChange={e => setName(e.target.value)} placeholder="상품명" /></div>
            <div style={S.f}><span style={S.lbl}>짧은 설명</span><input style={S.inp} value={shortDesc} onChange={e => setShortDesc(e.target.value)} placeholder="한 줄 설명" /></div>
            <div style={S.f}><span style={S.lbl}>검색 키워드</span><input style={S.inp} value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="보습, 진정, 마스크팩" /></div>
            <div style={S.row2}>
              <div><span style={S.lbl}>브랜드</span>
                <select style={S.sel} value={brandId} onChange={e => setBrandId(e.target.value)}>
                  <option value="">선택</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div><span style={S.lbl}>원산지</span><input style={S.inp} value={origin} onChange={e => setOrigin(e.target.value)} placeholder="프랑스" /></div>
            </div>
            <div style={S.row2}>
              <div>
                <span style={S.lbl}>카테고리</span>
                <button type="button" onClick={() => { setCategoryPickerTab('select'); setShowCategoryPicker(true) }}
                  style={{ ...S.inp, textAlign: 'left' as const, cursor: 'pointer', background: '#1a1714' }}>
                  {categoryBreadcrumb || '카테고리 선택'}
                </button>
                {categoryBreadcrumb && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{categoryBreadcrumb}</div>}
              </div>
              <div><span style={S.lbl}>제조사</span><input style={S.inp} value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="제조사명" /></div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {([['플래시세일', isFlashSale, setIsFlashSale], ['AURAN 독점', isExclusive, setIsExclusive]] as const).map(([label, val, set]) => (
                <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor: '#7b5ea7' }} />{label}
                </label>
              ))}
            </div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>가격 / 재고</div>
            <div style={S.row3}>
              <div><span style={S.lbl}>판매가 (₩)</span><input style={S.inp} type="number" value={retailPrice} onChange={e => setRetailPrice(e.target.value)} placeholder="0" /></div>
              <div><span style={S.lbl}>할인가 (₩)</span><input style={S.inp} type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="0" /></div>
              <div><span style={S.lbl}>재고</span><input style={S.inp} type="number" value={stockInput} onChange={e => setStockInput(e.target.value)} placeholder="무제한" /></div>
            </div>
            <div style={S.row3}>
              <div><span style={S.lbl}>단위 기준</span>
                <select style={S.sel} value={unitType} onChange={e => setUnitType(e.target.value)}>
                  <option value="">선택</option>
                  {['ml당', 'g당', '100ml당', '100g당', '1개당'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div><span style={S.lbl}>단위가격</span><input style={S.inp} type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} placeholder="0" /></div>
              <div><span style={S.lbl}>평균 소진 (일)</span><input style={S.inp} type="number" value={avgUsageDays} onChange={e => setAvgUsageDays(e.target.value)} placeholder="30" /></div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  <span>기본 배송비</span><span style={{ color: '#e8e4dc' }}>₩3,500</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  <span>5만원 이상 구매 시</span><span style={{ color: '#4cad7e' }}>무료배송</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  <span>제주 / 도서산간</span><span style={{ color: '#ffb400' }}>+₩5,000 추가</span>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>배송비는 자동 적용됩니다</div>
            </div>
          </div>

          {/* 옵션 설정 */}
          <div style={S.sec}>
            <div style={S.secTitle}>옵션 설정</div>
            {[
              { n: 1, use: useOpt1, setUse: setUseOpt1, name: optName1, setName: setOptName1, input: optInput1, setInput: setOptInput1, vals: optVals1, setVals: setOptVals1, placeholder: '예: 30ml, 50ml, 100ml' },
              { n: 2, use: useOpt2, setUse: setUseOpt2, name: optName2, setName: setOptName2, input: optInput2, setInput: setOptInput2, vals: optVals2, setVals: setOptVals2, placeholder: '예: 오리지널, 센시티브' },
            ].map(({ n, use, setUse, name, setName, input, setInput, vals, setVals, placeholder }) => (
              <div key={n} style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: use ? 12 : 0 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>옵션 {n}</span>
                  <button type="button" style={S.tog(use)} onClick={() => setUse(!use)} aria-label={`옵션${n}`} />
                </div>
                {use && (
                  <>
                    <div style={S.f}><span style={S.lbl}>옵션명</span><input style={S.inp} value={name} onChange={e => setName(e.target.value)} placeholder="예: 용량, 타입" /></div>
                    <div>
                      <span style={S.lbl}>옵션값 — 쉼표로 구분 입력 후 생성</span>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input style={{ ...S.inp, flex: 1 }} value={input} onChange={e => setInput(e.target.value)} placeholder={placeholder} />
                        <button type="button" onClick={() => { const v = input.split(',').map(s => s.trim()).filter(Boolean); if (v.length) { setVals(v); setInput('') } }}
                          style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(123,94,167,0.2)', border: '0.5px solid rgba(123,94,167,0.35)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>생성</button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {vals.map((v, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: 'rgba(123,94,167,0.15)', border: '0.5px solid rgba(123,94,167,0.3)', color: '#c4a7e7', fontSize: 12 }}>
                            {v}<button type="button" onClick={() => setVals(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {!use && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{n === 1 ? '단일 상품으로 판매' : '옵션 2 사용 시 켜주세요'}</div>}
              </div>
            ))}
            <div style={{ background: 'rgba(201,169,110,0.04)', border: '0.5px solid rgba(201,169,110,0.12)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useGift ? 12 : 0 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>🎁 사은품</span>
                <button type="button" style={S.tog(useGift)} onClick={() => setUseGift(!useGift)} aria-label="사은품" />
              </div>
              {useGift && (
                <>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input style={{ ...S.inp, flex: 1 }} value={giftInput} onChange={e => setGiftInput(e.target.value)} placeholder="예: 미니 앰플, 샘플 키트" />
                    <button type="button" onClick={() => { const v = giftInput.split(',').map(s => s.trim()).filter(Boolean); if (v.length) { setGiftVals(v); setGiftInput('') } }}
                      style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(201,169,110,0.18)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>생성</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {giftVals.map((v, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: 'rgba(201,169,110,0.12)', border: '0.5px solid rgba(201,169,110,0.3)', color: '#c9a96e', fontSize: 12 }}>
                        🎁 {v}<button type="button" onClick={() => setGiftVals(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div><span style={S.lbl}>사은품 안내 문구</span><input style={S.inp} value={giftMemo} onChange={e => setGiftMemo(e.target.value)} placeholder="예: 5만원 이상 구매 시 증정" /></div>
                </>
              )}
              {!useGift && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>사은품 없음</div>}
            </div>
          </div>
          {/* 포인트/토스트 */}
          <div style={S.sec}>
            <div style={S.secTitle}>포인트 / 토스트</div>
            <div style={S.row3}>
              <div><span style={S.lbl}>구매 적립 (%)</span><input style={S.inp} type="number" value={earnPointsPercent} onChange={e => setEarnPointsPercent(e.target.value)} /></div>
              <div><span style={S.lbl}>공유 포인트 (%)</span><input style={S.inp} type="number" value={shareVal} onChange={e => setShareVal(e.target.value)} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}><span style={{ ...S.lbl, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>수정 가능 · 기본값 적용됨</span></div>
            </div>
            <div style={S.row3}>
              <div><span style={S.lbl}>텍스트 리뷰 (%)</span><input style={S.inp} type="number" value={reviewText} onChange={e => setReviewText(e.target.value)} /></div>
              <div><span style={S.lbl}>사진 리뷰 (%)</span><input style={S.inp} type="number" value={reviewPhoto} onChange={e => setReviewPhoto(e.target.value)} /></div>
              <div><span style={S.lbl}>영상 리뷰 (%)</span><input style={S.inp} type="number" value={reviewVideo} onChange={e => setReviewVideo(e.target.value)} /></div>
            </div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>상품 이미지</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
              {thumbImages.map((url, i) => (
                <div key={i} onClick={() => fileRefs.current[i]?.click()}
                  style={{ aspectRatio: '1', background: i === 0 ? 'rgba(123,94,167,0.06)' : 'rgba(255,255,255,0.04)', border: `0.5px dashed ${i === 0 ? 'rgba(123,94,167,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                  {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10, color: i === 0 ? 'rgba(196,167,231,0.6)' : 'rgba(255,255,255,0.25)' }}>{i === 0 ? '대표' : '+'}</span>}
                  <input ref={el => { fileRefs.current[i] = el }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleImagePick(i, f) }} />
                </div>
              ))}
            </div>
            <div style={{ background: 'rgba(255,180,0,0.04)', border: '0.5px dashed rgba(255,180,0,0.2)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(255,180,0,0.5)' }} onClick={() => videoRef.current?.click()}>
              {videoUrl ? '영상 업로드됨 ✓' : '+ 영상 업로드'}
              <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleVideoPick(f) }} />
            </div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>상세 설명</div>
            <ProductDetailEditor
              value={detailContent}
              onChange={setDetailContent}
              onImageUpload={async (file) => {
                if (!workingIdRef.current) {
                  if (!brandId) return ''
                  try {
                    const pid = await insertNewProduct(supabase, { brand_id: brandId, name: name.trim() || '신규 상품', retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)), is_flash_sale: isFlashSale })
                    workingIdRef.current = pid
                  } catch { return '' }
                }
                const ext = file.name.split('.').pop() || 'jpg'
                return await uploadToStorage(file, `edit/${workingIdRef.current}/editor-${Date.now()}.${ext}`)
              }}
              onVideoUpload={async (file) => {
                if (!workingIdRef.current) {
                  if (!brandId) return ''
                  try {
                    const pid = await insertNewProduct(supabase, { brand_id: brandId, name: name.trim() || '신규 상품', retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)), is_flash_sale: isFlashSale })
                    workingIdRef.current = pid
                  } catch { return '' }
                }
                const ext = file.name.split('.').pop() || 'mp4'
                return await uploadVideoToStorage(file, `edit/${workingIdRef.current}/editor-video-${Date.now()}.${ext}`)
              }}
            />
            <div style={{ marginTop: 10 }}>
              <span style={S.lbl}>상세 이미지</span>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px dashed rgba(255,255,255,0.1)', borderRadius: 8, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.25)' }} onClick={() => detailFileRef.current?.click()}>
                + 상세 이미지 업로드
                <input ref={detailFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files || []).forEach(f => void handleDetailImagePick(f)) }} />
              </div>
              {detailImages.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{detailImages.length}개 업로드됨</div>}
            </div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>성분 정보</div>
            <div style={S.f}><span style={S.lbl}>KEY INGREDIENTS</span><textarea style={{ ...S.inp, height: 80, resize: 'vertical' as const }} value={keyIngredients} onChange={e => setKeyIngredients(e.target.value)} placeholder="주요 성분 설명" /></div>
            <div style={S.f}><span style={S.lbl}>전성분 텍스트</span><textarea style={{ ...S.inp, height: 60, resize: 'vertical' as const }} value={ingredientText} onChange={e => setIngredientText(e.target.value)} placeholder="Water, Glycerin..." /></div>
            <div style={S.f}>
              <span style={S.lbl}>전성분 사진 AI 분석</span>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px dashed rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 12, color: ingredientAnalyzeLoading ? '#c4a7e7' : 'rgba(255,255,255,0.25)' }} onClick={() => ingredientPhotoRef.current?.click()}>
                {ingredientAnalyzeLoading ? 'AI 분석 중...' : '+ 사진 업로드 → AI 자동 분석'}
                <input ref={ingredientPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  void (async () => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setIngredientAnalyzeLoading(true)
                    try {
                      const base64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.readAsDataURL(f) })
                      const resp = await fetch('/api/analyze-ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: base64 }) })
                      const data = await resp.json()
                      if (data.ingredients) setIngredientText(data.ingredients)
                    } catch { alert('분석 실패') } finally { setIngredientAnalyzeLoading(false) }
                  })()
                }} />
              </div>
            </div>
            <div style={S.f}><span style={S.lbl}>CLINICAL RESULT</span><textarea style={{ ...S.inp, height: 60, resize: 'vertical' as const }} value={clinicalResult} onChange={e => setClinicalResult(e.target.value)} placeholder="보습력 98% 향상..." /></div>
            <div><span style={S.lbl}>CERTIFICATIONS</span><input style={S.inp} value={certifications} onChange={e => setCertifications(e.target.value)} placeholder="ISO 9001, 피부과 테스트 완료" /></div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>함께 쓰기 좋은 제품</div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input style={S.inp} value={ptInput} onChange={e => setPtInput(e.target.value)} placeholder="제품명 검색..." />
              {ptResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1714', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 8, zIndex: 10, marginTop: 4 }}>
                  {ptResults.map(p => (
                    <div key={p.id} onClick={() => { if (ptSelected.length < 3 && !ptSelected.find(x => x.id === p.id)) setPtSelected(prev => [...prev, p]); setPtInput(''); setPtResults([]) }}
                      style={{ padding: '8px 12px', fontSize: 12, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {ptSelected.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 6 }}>
                <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{p.name}</span>
                <button type="button" onClick={() => setPtSelected(prev => prev.filter(x => x.id !== p.id))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>최대 3개</div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>태그 / 호르몬 단계</div>
            {[
              { label: '피부 고민', items: ['보습', '진정', '미백', '탄력', '모공', '각질', '트러블'], arr: skinConcerns, set: setSkinConcerns, style: S.tag },
              { label: '호르몬 단계', items: ['전단계', '달빛기', '황금기', '만개기', '물들기'], arr: hormoneStages, set: setHormoneStages, style: S.goldTag },
              { label: '피부 타입', items: ['건성', '지성', '복합성', '민감성', '중성', '여드름', '홍조', '특정'], arr: skinTypes, set: setSkinTypes, style: S.tag },
              { label: '계절', items: ['전계절', '봄', '여름', '가을', '겨울', '시술후'], arr: seasonTags, set: setSeasonTags, style: S.tag },
            ].map(({ label, items, arr, set, style }) => (
              <div key={label} style={S.f}>
                <span style={S.lbl}>{label}</span>
                <div>{items.map(t => <span key={t} style={style(arr.includes(t))} onClick={() => toggleArr(arr, t, set)}>{t}</span>)}</div>
              </div>
            ))}
            <div style={S.f}>
              <span style={S.lbl}>루틴 단계</span>
              <div>{['클렌징', '토너', '앰플', '세럼', '크림', '선케어', '마스크팩', '아로마오일', '바디입욕제', '바디버블', '바디팩', ...stepTags.filter(t => !['클렌징', '토너', '앰플', '세럼', '크림', '선케어', '마스크팩', '아로마오일', '바디입욕제', '바디버블', '바디팩'].includes(t))].map(t => (
                <span key={t} style={S.tag(stepTags.includes(t))} onClick={() => toggleArr(stepTags, t, setStepTags)}>{t}</span>
              ))}
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'inline-block', margin: '3px 3px 0 0' }}
                  onClick={() => { const v = window.prompt('루틴 단계 추가:'); if (v?.trim()) setStepTags(prev => [...prev, v.trim()]) }}>+ 추가</span>
              </div>
            </div>
            <div><span style={S.lbl}>성분 태그 (콤마 구분)</span><input style={S.inp} value={ingredientTags} onChange={e => setIngredientTags(e.target.value)} placeholder="히알루론산, 나이아신아마이드" /></div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>판매 설정</div>
            {[
              { label: '판매 상태', val: isActive, set: setIsActive },
              { label: 'AURAN 독점', val: isExclusive, set: setIsExclusive },
            ].map(({ label, val, set }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
                <button type="button" style={S.tog(val)} onClick={() => set(!val)} aria-label={label} />
              </div>
            ))}
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>이벤트 배너</div>
            <div style={S.f}><span style={S.lbl}>이모지</span><input style={{ ...S.inp, width: 80 }} value={eventEmoji} onChange={e => setEventEmoji(e.target.value)} placeholder="🎁" /></div>
            <div style={S.f}><span style={S.lbl}>제목</span><input style={S.inp} value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="오픈 기념 특가" /></div>
            <div style={S.f}><span style={S.lbl}>설명</span><textarea style={{ ...S.inp, height: 60, resize: 'vertical' as const }} value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="이벤트 내용" /></div>
            <div style={S.row2}>
              <div><span style={S.lbl}>시작일</span><input style={S.inp} type="date" value={eventStartsAt} onChange={e => setEventStartsAt(e.target.value)} /></div>
              <div><span style={S.lbl}>종료일</span><input style={S.inp} type="date" value={eventEndsAt} onChange={e => setEventEndsAt(e.target.value)} /></div>
            </div>
          </div>

          {isSuperAdmin && (
            <div style={{ ...S.sec, borderColor: 'rgba(201,169,110,0.15)' }}>
              <div style={{ ...S.secTitle, color: 'rgba(201,169,110,0.6)' }}>슈퍼어드민 전용</div>
              <div style={S.f}><span style={S.lbl}>의료 / 피부질환 태그</span><input style={S.inp} value={medicalTags} onChange={e => setMedicalTags(e.target.value)} placeholder="아토피, 여드름" /></div>
              <div><span style={S.lbl}>신체 부위 태그</span>
                <div>{['얼굴', '목', '데콜테', '바디', '두피'].map(t => <span key={t} style={S.tag(bodyPartTags.includes(t))} onClick={() => toggleArr(bodyPartTags, t, setBodyPartTags)}>{t}</span>)}</div>
              </div>
            </div>
          )}

          {/* 카테고리 피커 모달 */}
          {showCategoryPicker && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCategoryPicker(false)}>
              <div style={{ background: '#141210', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 14, width: 'min(980px, 92vw)', maxHeight: '80vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button type="button" onClick={() => setCategoryPickerTab('select')} style={{ padding: '6px 14px', borderRadius: 8, background: categoryPickerTab === 'select' ? '#7b5ea7' : 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}>카테고리 선택</button>
                  <button type="button" onClick={() => setCategoryPickerTab('search')} style={{ padding: '6px 14px', borderRadius: 8, background: categoryPickerTab === 'search' ? '#7b5ea7' : 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}>검색</button>
                  <button type="button" onClick={() => setShowCategoryPicker(false)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>닫기</button>
                </div>
                {categoryPickerTab === 'search' ? (
                  <div>
                    <input value={categorySearch} onChange={e => setCategorySearch(e.target.value)} placeholder="카테고리 검색..."
                      style={{ ...S.inp, marginBottom: 12 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {categorySearchRows.map(c => (
                        <div key={c.id} onClick={() => { setProductCategoryLeafId(c.id); setShowCategoryPicker(false) }}
                          style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', cursor: 'pointer', fontSize: 13, color: '#e8e4dc' }}>
                          {c.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
                    {[
                      { opts: catOpts1, val: catL1, set: setCatL1, reset: [setCatL2, setCatL3, setCatL4, setCatL5] },
                      { opts: catOpts2, val: catL2, set: setCatL2, reset: [setCatL3, setCatL4, setCatL5] },
                      { opts: catOpts3, val: catL3, set: setCatL3, reset: [setCatL4, setCatL5] },
                      { opts: catOpts4, val: catL4, set: setCatL4, reset: [setCatL5] },
                      { opts: catOpts5, val: catL5, set: setCatL5, reset: [] as ((v: string) => void)[] },
                    ].map((col, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {col.opts.map(c => (
                          <div key={c.id} onClick={() => { col.set(c.id); col.reset.forEach(r => r('')) }}
                            style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: col.val === c.id ? 'rgba(123,94,167,0.3)' : 'rgba(255,255,255,0.04)', color: col.val === c.id ? '#c4a7e7' : 'rgba(255,255,255,0.7)', border: `0.5px solid ${col.val === c.id ? 'rgba(123,94,167,0.5)' : 'rgba(255,255,255,0.06)'}` }}>
                            {c.name}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>선택 경로: {categoryBreadcrumb || '미선택'}</div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {skinTagOptions.map(t => {
                    const on = selectedSkinTagIds.includes(t.id)
                    return <span key={t.id} onClick={() => setSelectedSkinTagIds(prev => on ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: on ? 'rgba(123,94,167,0.35)' : 'rgba(123,94,167,0.1)', border: `0.5px solid ${on ? 'rgba(123,94,167,0.6)' : 'rgba(123,94,167,0.25)'}`, color: '#c4a7e7', cursor: 'pointer' }}>{t.name}</span>
                  })}
                </div>
              </div>
            </div>
          )}
          {showDraftPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowDraftPicker(false)}>
              <div style={{ background: '#1a1714', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 14, width: 'min(480px, 90vw)', maxHeight: '70vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 14, color: '#e8e4dc' }}>임시저장 목록</span>
                  <button type="button" onClick={() => setShowDraftPicker(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
                </div>
                {draftList.length === 0 && (
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '24px 0' }}>임시저장된 상품이 없어요</div>
                )}
                {draftList.map(d => (
                  <div key={d.id}
                    onClick={() => { window.location.href = `/admin/products/edit-v2?id=${d.id}` }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', marginBottom: 8, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(123,94,167,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                    <div>
                      <div style={{ fontSize: 13, color: '#e8e4dc', marginBottom: 3 }}>{d.name || '이름 없음'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{new Date(d.created_at).toLocaleDateString('ko-KR')} 임시저장</div>
                    </div>
                    <span style={{ fontSize: 12, color: '#c4a7e7', flexShrink: 0 }}>이어서 작업 →</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 하단 액션바 */}
          <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.08)', padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{tmpSavedAt && `${tmpSavedAt} 임시저장됨`}</div>
            <ActionBar />
          </div>
        </div>

        <div style={{ position: 'sticky', top: 56, height: 'fit-content', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>고객 화면 미리보기</div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {thumbImages[0] ? <img src={thumbImages[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 32, color: 'rgba(255,255,255,0.1)' }}>📷</span>}
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{brands.find(b => b.id === brandId)?.name || '브랜드'}</div>
              <div style={{ fontSize: 13, color: '#e8e4dc', marginBottom: 6, lineHeight: 1.4 }}>{name || '상품명'}</div>
              <div style={{ fontSize: 16, color: '#c9a96e', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{retailPrice ? `${Number(retailPrice).toLocaleString()}원` : '가격'}</div>
              <div>
                {hormoneStages.map(t => <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: '0.5px solid rgba(201,169,110,0.2)', display: 'inline-block', margin: '2px 2px 0 0' }}>{t}</span>)}
                {skinConcerns.slice(0, 3).map(t => <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: '0.5px solid rgba(201,169,110,0.2)', display: 'inline-block', margin: '2px 2px 0 0' }}>{t}</span>)}
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>섹션 바로가기</div>
            {['기본 정보', '가격 / 재고', '포인트 / 토스트', '상품 이미지', '상세 설명', '성분 정보', '함께 쓰기 좋은 제품', '태그 / 호르몬', '판매 설정', '이벤트 배너'].map(label => (
              <div key={label} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '4px 0', cursor: 'pointer' }}>{label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
