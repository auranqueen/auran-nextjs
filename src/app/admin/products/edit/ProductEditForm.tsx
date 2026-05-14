'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { compressImage } from '@/lib/imageUpload'

const TABS = ['기본정보', '옵션정보', '가격및재고', '포인트설정', '배송비', '상품이미지', '태그관리'] as const

const ORIGINS = ['프랑스', '이탈리아', '독일', '스페인', '영국', '스위스', '이스라엘', '기타유럽', '한국', '일본', '기타'] as const
const UNIT_TYPE_OPTIONS = ['ml당', 'g당', '100ml당', '100g당', '1개당'] as const

type SaleUi = 'active' | 'sold_out' | 'discontinued' | 'paused'
type QtyUi = 'unlimited' | 'limited'
type PointMode = 'percent' | 'point' | 'won'

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
}

function parseAdminMeta(rows: string[] | null | undefined): { options: string; shippingFee: string; shippingMemo: string; skinTags: string[] } {
  const raw = rows?.find(r => typeof r === 'string' && r.startsWith('__AURAN_ADMIN__'))
  if (!raw) return { options: '', shippingFee: '', shippingMemo: '', skinTags: [] }
  try {
    const j = JSON.parse(raw.slice('__AURAN_ADMIN__'.length)) as {
      options?: string
      shipping?: { fee?: string; memo?: string }
      skinTags?: string[]
    }
    return {
      options: j.options ?? '',
      shippingFee: j.shipping?.fee ?? '',
      shippingMemo: j.shipping?.memo ?? '',
      skinTags: Array.isArray(j.skinTags) ? j.skinTags.map(x => String(x)).filter(Boolean) : [],
    }
  } catch {
    return { options: '', shippingFee: '', shippingMemo: '', skinTags: [] }
  }
}

function encodeAdminMeta(
  options: string,
  shippingFee: string,
  shippingMemo: string,
  skinTags: string[],
  existing: string[] | null | undefined
): string[] {
  const payload =
    '__AURAN_ADMIN__' +
    JSON.stringify({
      v: 1,
      options,
      shipping: { fee: shippingFee, memo: shippingMemo },
      skinTags,
    })
  const rest = (existing || []).filter(r => typeof r !== 'string' || !r.startsWith('__AURAN_ADMIN__'))
  return [payload, ...rest]
}

function statusFromUi(s: SaleUi, stockLimited: number): { status: string; stock: number } {
  if (s === 'sold_out') return { status: 'active', stock: 0 }
  if (s === 'discontinued') return { status: 'discontinued', stock: Math.max(0, Math.floor(stockLimited || 0)) }
  if (s === 'paused') return { status: 'discontinued', stock: Math.max(0, Math.floor(stockLimited || 0)) }
  return { status: 'active', stock: Math.max(0, Math.floor(stockLimited || 0)) }
}

function uiFromRow(p: Record<string, unknown>): { sale: SaleUi; qty: QtyUi; stockNum: number } {
  const st = String(p.status || '')
  const stNum = Number(p.stock ?? 0)
  if (st === 'discontinued') return { sale: 'discontinued', qty: stNum >= 999999 ? 'unlimited' : 'limited', stockNum: stNum }
  if (st === 'active' && stNum === 0) return { sale: 'sold_out', qty: 'limited', stockNum: 0 }
  if (st === 'active') {
    const unlim = stNum >= 999999
    return { sale: 'active', qty: unlim ? 'unlimited' : 'limited', stockNum: unlim ? 0 : stNum }
  }
  return { sale: 'active', qty: stNum >= 999999 ? 'unlimited' : 'limited', stockNum: stNum >= 999999 ? 0 : stNum }
}

export type ProductEditFormProps = {
  /** 있으면 수정, 없거나 `new`면 신규 */
  id?: string | null
  /** 신규 시: 일반 제품 vs 공구/이벤트(플래시) */
  productKind?: 'normal' | 'event'
}

export default function ProductEditForm({ id: idProp, productKind = 'normal' }: ProductEditFormProps) {
  const supabase = createClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const router = useRouter()

  const editId = typeof idProp === 'string' && idProp !== 'new' && isUuid(idProp) ? idProp : null

  const [tabIdx, setTabIdx] = useState(0)
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [brands, setBrands] = useState<{ id: string; name: string; origin_country?: string | null }[]>([])
  const [allCategories, setAllCategories] = useState<
    { id: string; name: string; parent_id: string | null; level: number; sort_order: number | null }[]
  >([])
  const [catL1, setCatL1] = useState('')
  const [catL2, setCatL2] = useState('')
  const [catL3, setCatL3] = useState('')
  const [catL4, setCatL4] = useState('')
  const [catL5, setCatL5] = useState('')
  const [productCategoryLeafId, setProductCategoryLeafId] = useState('')
  const [showNewBrand, setShowNewBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandOriginCountry, setNewBrandOriginCountry] = useState('')

  const [name, setName] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [keywords, setKeywords] = useState('')
  const [brandId, setBrandId] = useState('')
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>('한국')
  const [manufacturer, setManufacturer] = useState('')
  const [saleUi, setSaleUi] = useState<SaleUi>('active')
  const [isExclusiveProduct, setIsExclusiveProduct] = useState(false)

  const [optionsText, setOptionsText] = useState('')

  const [retailPrice, setRetailPrice] = useState('')
  const [unitType, setUnitType] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [avgUsageDays, setAvgUsageDays] = useState('')
  const [qtyUi, setQtyUi] = useState<QtyUi>('unlimited')
  const [stockInput, setStockInput] = useState('0')
  const [timesaleStart, setTimesaleStart] = useState('')
  const [timesaleEnd, setTimesaleEnd] = useState('')

  const [purchaseMode, setPurchaseMode] = useState<PointMode>('percent')
  const [purchaseVal, setPurchaseVal] = useState('')
  const [shareVal, setShareVal] = useState('')
  const [isFlashSaleState, setIsFlashSaleState] = useState(productKind === 'event')

  const [reviewText, setReviewText] = useState('100')
  const [reviewPhoto, setReviewPhoto] = useState('300')
  const [reviewVideo, setReviewVideo] = useState('500')

  const [shipFee, setShipFee] = useState('')
  const [shipMemo, setShipMemo] = useState('')

  const [thumbImages, setThumbImages] = useState<string[]>(['', '', '', '', ''])
  const [videoUrl, setVideoUrl] = useState('')
  const [detailContent, setDetailContent] = useState('')
  const [keyIngredients, setKeyIngredients] = useState('')
  const [skinTypesProduct, setSkinTypesProduct] = useState<string[]>([])
  const [skinConcernsProduct, setSkinConcernsProduct] = useState<string[]>([])
  const [hormoneTimingProduct, setHormoneTimingProduct] = useState('')
  const [ingredientAnalyzeLoading, setIngredientAnalyzeLoading] = useState(false)
  const [ingredientAnalyzeDone, setIngredientAnalyzeDone] = useState(false)
  const [clinicalResult, setClinicalResult] = useState('')
  const [certificationsText, setCertificationsText] = useState('')
  const [perfectTogetherInput, setPerfectTogetherInput] = useState('')
  const [detailImages, setDetailImages] = useState<string[]>([])
  const [selectedSkinTagIds, setSelectedSkinTagIds] = useState<string[]>([])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [categoryPickerTab, setCategoryPickerTab] = useState<'search' | 'select'>('select')
  const [categorySearch, setCategorySearch] = useState('')
  const [hasDraft, setHasDraft] = useState(false)
  const [isMobileSheet, setIsMobileSheet] = useState(false)

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [form, setForm] = useState({
    ai_tag_status: 'pending',
    step_tags: [] as string[],
    func_tags: [] as string[],
    hormone_tags: [] as string[],
    weather_tags: [] as string[],
    season_tags: [] as string[],
    gender_tag: '',
    situation_tags: [] as string[],
    body_part_tags: [] as string[],
    lifestyle_tags: [] as string[],
    timing_tags: [] as string[],
    event_tags: [] as string[],
    ingredient_tags: [] as string[],
    medical_tags: [] as string[],
    skin_types: [] as string[],
  })

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user as { app_metadata?: { role?: string }; raw_app_meta_data?: { role?: string } }
      const role = user?.app_metadata?.role ?? user?.raw_app_meta_data?.role ?? ''
      setIsSuperAdmin(role === 'super_admin')
    })
  }, [supabase])

  const fileRefs = useRef<(HTMLInputElement | null)[]>([])
  const videoRef = useRef<HTMLInputElement | null>(null)
  const detailFileRef = useRef<HTMLInputElement | null>(null)
  const ingredientPhotoRef = useRef<HTMLInputElement | null>(null)
  const ingredientPhotoFileRef = useRef<File | null>(null)
  const workingIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabase
      .from('brands')
      .select('id,name,origin_country')
      .order('name')
      .then(({ data }) => setBrands((data || []) as { id: string; name: string; origin_country?: string | null }[]))
  }, [])

  useEffect(() => {
    if (!brandId) return
    const b = brands.find(x => x.id === brandId)
    const oc = String(b?.origin_country || '').trim()
    if (oc) {
      const normalized = (ORIGINS as readonly string[]).includes(oc) ? oc : '기타'
      setOrigin(normalized as (typeof ORIGINS)[number])
    }
  }, [brandId, brands])

  useEffect(() => {
    supabase
      .from('categories')
      .select('id,name,parent_id,level,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .then(({ data }) =>
        setAllCategories(
          (data || []) as { id: string; name: string; parent_id: string | null; level: number; sort_order: number | null }[]
        )
      )
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const apply = () => setIsMobileSheet(window.innerWidth <= 840)
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = editId ? `auran_product_draft_${editId}` : 'auran_product_draft_new'
    setHasDraft(Boolean(localStorage.getItem(key)))
  }, [editId])

  useEffect(() => {
    if (!editId) {
      setProductCategoryLeafId('')
      setCatL1('')
      setCatL2('')
      setCatL3('')
      setCatL4('')
      setCatL5('')
    }
  }, [editId])

  useEffect(() => {
    const leaf = productCategoryLeafId
    if (!leaf || allCategories.length === 0) return
    const byId = new Map(allCategories.map(c => [c.id, c]))
    const chain: string[] = []
    let cur = byId.get(leaf)
    let guard = 0
    while (cur && guard++ < 24) {
      chain.unshift(cur.id)
      const pid = cur.parent_id != null && String(cur.parent_id) !== '' ? String(cur.parent_id) : ''
      cur = pid ? byId.get(pid) : undefined
    }
    setCatL1(chain[0] || '')
    setCatL2(chain[1] || '')
    setCatL3(chain[2] || '')
    setCatL4(chain[3] || '')
    setCatL5(chain[4] || '')
    setProductCategoryLeafId('')
  }, [productCategoryLeafId, allCategories])

  useEffect(() => {
    if (!editId) setIsFlashSaleState(productKind === 'event')
  }, [productKind, editId])

  useEffect(() => {
    if (!editId) {
      setLoading(false)
      workingIdRef.current = null
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.from('products').select('*').eq('id', editId).maybeSingle()
      if (cancelled) return
      if (error || !data) {
        setMsg(error?.message || '상품을 불러오지 못했습니다')
        setLoading(false)
        return
      }
      const p = data as Record<string, unknown>
      workingIdRef.current = editId
      setName(String(p.name || '').slice(0, 100))
      setShortDesc(String(p.description || ''))
      setKeywords(String(p.tag || ''))
      setBrandId(p.brand_id ? String(p.brand_id) : '')
      setProductCategoryLeafId(p.category_id ? String(p.category_id) : '')
      const catRaw = String(p.category || '')
      const cat = catRaw === '국산' ? '한국' : catRaw
      setOrigin((ORIGINS as readonly string[]).includes(cat) ? (cat as (typeof ORIGINS)[number]) : '기타')
      setManufacturer(String(p.ingredient || ''))

      const { sale, qty, stockNum } = uiFromRow(p)
      setSaleUi(sale)
      setIsExclusiveProduct(p.is_exclusive === true)
      setQtyUi(qty)
      setStockInput(String(stockNum))

      setRetailPrice(String(p.retail_price ?? ''))
      setUnitType(String(p.unit_type || ''))
      setUnitPrice(p.unit_price != null && p.unit_price !== '' ? String(p.unit_price) : '')
      setSalePrice(p.sale_price != null && p.sale_price !== '' ? String(p.sale_price) : '')
      setAvgUsageDays(p.avg_usage_days != null && p.avg_usage_days !== '' ? String(p.avg_usage_days) : '')

      const ts = !!p.is_timesale
      setTimesaleStart(
        ts && p.timesale_starts_at ? new Date(String(p.timesale_starts_at)).toISOString().slice(0, 16) : ''
      )
      setTimesaleEnd(ts && p.timesale_ends_at ? new Date(String(p.timesale_ends_at)).toISOString().slice(0, 16) : '')

      {
        const ep = Number(p.earn_points ?? 0)
        const epp = Number(p.earn_points_percent ?? 0)
        if (epp > 0 && ep === 0) {
          setPurchaseMode('point')
          setPurchaseVal(String(epp))
        } else {
          setPurchaseMode('percent')
          setPurchaseVal(String(ep))
        }
      }
      setShareVal(String(p.share_points ?? ''))
      setIsFlashSaleState(!!p.is_flash_sale)

      setReviewText(String(p.review_points_text ?? '100'))
      setReviewPhoto(String(p.review_points_photo ?? '300'))
      setReviewVideo(String(p.review_points_video ?? '500'))

      const qm = Array.isArray(p.quiz_match) ? (p.quiz_match as string[]) : []
      const meta = parseAdminMeta(qm)
      setOptionsText(meta.options)
      setShipFee(meta.shippingFee)
      setShipMemo(meta.shippingMemo)
      setSelectedSkinTagIds(meta.skinTags)

      const thumbs = Array.isArray(p.thumb_images) && (p.thumb_images as string[]).length
        ? [...(p.thumb_images as string[])]
        : []
      while (thumbs.length < 5) thumbs.push('')
      setThumbImages(thumbs.slice(0, 5))
      setVideoUrl(String(p.video_url || ''))
      setDetailContent(String(p.detail_content || ''))
      setKeyIngredients(String(p.key_ingredients || ''))
      setSkinTypesProduct(Array.isArray(p.skin_types) ? (p.skin_types as unknown[]).map(x => String(x)) : [])
      setSkinConcernsProduct(Array.isArray(p.skin_concerns) ? (p.skin_concerns as unknown[]).map(x => String(x)) : [])
      setHormoneTimingProduct(p.hormone_timing != null && String(p.hormone_timing).trim() ? String(p.hormone_timing) : '')
      setClinicalResult(String(p.clinical_result || ''))
      setCertificationsText(String(p.certifications || ''))
      setPerfectTogetherInput(
        Array.isArray(p.perfect_together) && (p.perfect_together as string[]).length
          ? (p.perfect_together as string[]).join(', ')
          : ''
      )
      setDetailImages(
        Array.isArray(p.detail_images) && (p.detail_images as string[]).length
          ? [...(p.detail_images as string[])]
          : []
      )

      const strArr = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x)) : [])
      setForm({
        step_tags: strArr(p.step_tags),
        func_tags: strArr(p.func_tags),
        hormone_tags: strArr(p.hormone_tags),
        weather_tags: strArr(p.weather_tags),
        season_tags: strArr(p.season_tags),
        gender_tag: String(p.gender_tag ?? ''),
        situation_tags: strArr(p.situation_tags),
        body_part_tags: strArr(p.body_part_tags),
        lifestyle_tags: strArr(p.lifestyle_tags),
        timing_tags: strArr(p.timing_tags),
        event_tags: strArr(p.event_tags),
        ingredient_tags: strArr(p.ingredient_tags),
        medical_tags: strArr(p.medical_tags),
        ai_tag_status: String(p.ai_tag_status ?? 'pending'),
        skin_types: Array.isArray(p.skin_types) ? (p.skin_types as unknown[]).map(x => String(x)) : [],
      })

      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [editId])

  const inputStyle = useMemo(
    () => ({
      width: '100%',
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 10,
      padding: '10px 14px',
      color: '#fff',
      fontSize: 13,
      boxSizing: 'border-box' as const,
    }),
    []
  )

  const labelStyle = { fontSize: 11, color: 'rgba(255,255,255,0.45)' }

  const selectedBrandOc = brandId ? String(brands.find(b => b.id === brandId)?.origin_country || '').trim() : ''
  const originLocked = Boolean(brandId && selectedBrandOc)

  const catOpts1 = useMemo(
    () => allCategories.filter(c => c.parent_id == null || c.parent_id === ''),
    [allCategories]
  )
  const catOpts2 = useMemo(
    () => (catL1 ? allCategories.filter(c => String(c.parent_id || '') === catL1) : []),
    [allCategories, catL1]
  )
  const catOpts3 = useMemo(
    () => (catL2 ? allCategories.filter(c => String(c.parent_id || '') === catL2) : []),
    [allCategories, catL2]
  )
  const catOpts4 = useMemo(
    () => (catL3 ? allCategories.filter(c => String(c.parent_id || '') === catL3) : []),
    [allCategories, catL3]
  )
  const catOpts5 = useMemo(
    () => (catL4 ? allCategories.filter(c => String(c.parent_id || '') === catL4) : []),
    [allCategories, catL4]
  )
  const skinTagOptions = useMemo(
    () => allCategories.filter(c => Number(c.level || 0) === 5 && (c.parent_id == null || c.parent_id === '')),
    [allCategories]
  )
  const categorySearchRows = useMemo(() => {
    const q = categorySearch.trim().toLowerCase()
    if (!q) return []
    return allCategories.filter(c => String(c.name || '').toLowerCase().includes(q)).slice(0, 80)
  }, [allCategories, categorySearch])
  const categoryBreadcrumb = useMemo(() => {
    const byId = new Map(allCategories.map(c => [c.id, c]))
    const leaf = catL5 || catL4 || catL3 || catL2 || catL1 || ''
    if (!leaf) return ''
    const names: string[] = []
    let cur = byId.get(leaf)
    let guard = 0
    while (cur && guard++ < 24) {
      names.unshift(cur.name)
      const pid = cur.parent_id != null && String(cur.parent_id) !== '' ? String(cur.parent_id) : ''
      cur = pid ? byId.get(pid) : undefined
    }
    return names.join(' > ')
  }, [allCategories, catL1, catL2, catL3, catL4, catL5])

  const uploadToStorage = useCallback(
    async (file: File, path: string) => {
      file = await compressImage(file, 'product_detail')
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
    },
    [supabaseUrl]
  )

  const handleImagePick = async (slot: number, file: File | undefined) => {
    if (!file) return
    const pid = workingIdRef.current
    if (!pid) {
      setMsg('먼저 상품을 저장해 ID를 만든 뒤 이미지를 올려주세요 (저장 버튼)')
      return
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const safe = `${slot + 1}-${Date.now()}.${ext}`
    const path = `edit/${pid}/${safe}`
    try {
      const url = await uploadToStorage(file, path)
      setThumbImages(prev => {
        const next = [...prev]
        next[slot] = url
        return next
      })
      setMsg('이미지 업로드됨 · 저장으로 반영하세요')
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '이미지 업로드 실패')
    }
  }

  const handleVideoPick = async (file: File | undefined) => {
    if (!file) return
    const pid = workingIdRef.current
    if (!pid) {
      setMsg('먼저 상품을 저장해 ID를 만든 뒤 영상을 올려주세요')
      return
    }
    const ext = file.name.split('.').pop() || 'mp4'
    const path = `edit/${pid}/video-${Date.now()}.${ext}`
    try {
      const url = await uploadToStorage(file, path)
      setVideoUrl(url)
      setMsg('영상 업로드됨 · 저장으로 반영하세요')
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '영상 업로드 실패')
    }
  }

  const handleDetailImagePick = async (file: File | undefined) => {
    if (!file) return
    const pid = workingIdRef.current
    if (!pid) {
      setMsg('먼저 상품을 저장해 ID를 만든 뒤 이미지를 올려주세요 (저장 버튼)')
      return
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `edit/${pid}/detail-${Date.now()}.${ext}`
    try {
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const url = `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
      setDetailImages(prev => [...prev, url])
      setMsg('상세 이미지 업로드됨 · 저장으로 반영하세요')
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '상세 이미지 업로드 실패')
    }
  }

  const buildPayload = (
    pid: string,
    quizExisting: string[] | null | undefined,
    tagOverride?: Partial<typeof form>
  ) => {
    const t = { ...form, ...tagOverride }
    const nameTrim = name.trim().slice(0, 100)
    const limited = qtyUi === 'limited' ? Math.max(0, Math.floor(Number(stockInput) || 0)) : 999999
    const { status, stock } = statusFromUi(saleUi, limited)

    const retail = Math.max(0, Math.floor(Number(retailPrice) || 0))
    const saleP = salePrice.trim() === '' ? null : Math.max(0, Number(salePrice))
    const hasTs = Boolean(timesaleStart && timesaleEnd)
    const tsStart = hasTs ? new Date(timesaleStart).toISOString() : null
    const tsEnd = hasTs ? new Date(timesaleEnd).toISOString() : null

    let earnPoints = 0
    let earnPointsPercent: number | null = null
    const pv = Number(purchaseVal)
    if (purchaseMode === 'percent' && Number.isFinite(pv)) {
      earnPoints = Math.floor(Math.max(0, pv))
      earnPointsPercent = null
    } else if ((purchaseMode === 'point' || purchaseMode === 'won') && Number.isFinite(pv)) {
      earnPoints = 0
      earnPointsPercent = Math.max(0, pv)
    }

    const sharePts = Math.max(0, Math.floor(Number(shareVal) || 0))

    const rText = Math.max(0, Math.floor(Number(reviewText) || 0))
    const rPhoto = Math.max(0, Math.floor(Number(reviewPhoto) || 0))
    const rVideo = Math.max(0, Math.floor(Number(reviewVideo) || 0))

    const thumbsClean = thumbImages.map(s => s.trim()).filter(Boolean)
    const quiz = encodeAdminMeta(optionsText, shipFee, shipMemo, selectedSkinTagIds, quizExisting)
    const perfectIds = perfectTogetherInput
      .split(',')
      .map(s => s.trim())
      .filter(s => isUuid(s))
    const detailImgsClean = detailImages.map(s => s.trim()).filter(Boolean)

    const resolvedCategoryId = catL5 || catL4 || catL3 || catL2 || catL1 || ''

    return {
      brand_id: brandId || null,
      category_id: resolvedCategoryId || null,
      name: nameTrim || '이름 없음',
      description: shortDesc.trim() || null,
      tag: keywords.trim() || null,
      category: origin,
      ingredient: manufacturer.trim() || null,
      status,
      stock,
      retail_price: retail,
      unit_type: unitType.trim() || null,
      unit_price:
        unitPrice.trim() === ''
          ? null
          : (() => {
              const n = Number(unitPrice.trim().replace(/,/g, ''))
              return Number.isFinite(n) && n >= 0 ? n : null
            })(),
      sale_price: saleP,
      is_timesale: hasTs,
      timesale_starts_at: tsStart,
      timesale_ends_at: tsEnd,
      earn_points: earnPoints,
      earn_points_percent: earnPointsPercent,
      share_points: sharePts,
      avg_usage_days: avgUsageDays.trim() === '' ? null : Math.max(1, Math.min(365, Math.floor(Number(avgUsageDays) || 0))),
      review_points_text: rText,
      review_points_photo: rPhoto,
      review_points_video: rVideo,
      quiz_match: quiz,
      thumb_images: thumbsClean,
      thumb_img: thumbsClean[0] || null,
      storage_thumb_url: thumbsClean[0] || null,
      video_url: videoUrl.trim() || null,
      detail_content: detailContent.trim() || null,
      key_ingredients: keyIngredients.trim() || null,
      skin_types:
        t.skin_types.length > 0
          ? t.skin_types
          : skinTypesProduct.length
            ? skinTypesProduct
            : null,
      skin_concerns: skinConcernsProduct.length ? skinConcernsProduct : null,
      hormone_timing: hormoneTimingProduct.trim() || null,
      clinical_result: clinicalResult.trim() || null,
      certifications: certificationsText.trim() || null,
      perfect_together: perfectIds,
      detail_images: detailImgsClean,
      detail_imgs: detailImgsClean,
      is_flash_sale: isFlashSaleState,
      is_exclusive: isExclusiveProduct,
      step_tags: t.step_tags || [],
      func_tags: t.func_tags || [],
      hormone_tags: t.hormone_tags || [],
      weather_tags: t.weather_tags || [],
      season_tags: t.season_tags || [],
      gender_tag: t.gender_tag || '',
      situation_tags: t.situation_tags || [],
      body_part_tags: t.body_part_tags || [],
      lifestyle_tags: t.lifestyle_tags || [],
      timing_tags: t.timing_tags || [],
      event_tags: t.event_tags || [],
      ingredient_tags: t.ingredient_tags || [],
      medical_tags: t.medical_tags || [],
      ai_tag_status: t.ai_tag_status || 'pending',
      updated_at: new Date().toISOString(),
    }
  }

  const onSave = async (tagOverride?: Partial<typeof form>) => {
    setMsg('')
    if (!brandId) {
      setMsg('브랜드를 선택하세요')
      return
    }
    setSaving(true)
    try {
      let pid = editId
      let existingQuiz: string[] | null = null

      if (!pid) {
        const resolvedCategoryId = catL5 || catL4 || catL3 || catL2 || catL1 || ''
        const insertRow = {
          brand_id: brandId,
          category_id: resolvedCategoryId || null,
          name: name.trim().slice(0, 100) || '신규 상품',
          description: shortDesc.trim() || null,
          tag: keywords.trim() || null,
          category: origin,
          ingredient: manufacturer.trim() || null,
          status: 'pending' as const,
          stock: 0,
          retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)),
          avg_usage_days: avgUsageDays.trim() === '' ? null : Math.max(1, Math.min(365, Math.floor(Number(avgUsageDays) || 0))),
          skin_types: null,
          skin_concerns: null,
          hormone_timing: null,
          thumb_img: null,
          is_flash_sale: isFlashSaleState,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        const { data: created, error: insErr } = await supabase.from('products').insert(insertRow).select('id,quiz_match').single()
        if (insErr || !created?.id) {
          setMsg(insErr?.message || '생성 실패')
          setSaving(false)
          return
        }
        pid = created.id
        workingIdRef.current = pid
        existingQuiz = (created as { quiz_match?: string[] }).quiz_match || null
      } else {
        const { data: cur } = await supabase.from('products').select('quiz_match').eq('id', pid).maybeSingle()
        existingQuiz = (cur as { quiz_match?: string[] } | null)?.quiz_match || null
        workingIdRef.current = pid
      }

      const payload = buildPayload(pid!, existingQuiz, tagOverride)
      const { error: upErr } = await supabase.from('products').update(payload).eq('id', pid!)
      if (upErr) {
        setMsg(upErr.message || '저장 실패')
        setSaving(false)
        return
      }
      if (typeof window !== 'undefined') {
        const key = editId ? `auran_product_draft_${editId}` : 'auran_product_draft_new'
        localStorage.removeItem(key)
      }
      router.push('/admin/marketing/products')
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
        불러오는 중…
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 720, margin: '0 auto' }}>
      {msg ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(255,80,80,0.12)',
            border: '1px solid rgba(255,120,120,0.35)',
            color: '#ffb4b4',
            fontSize: 13,
          }}
        >
          {msg}
        </div>
      ) : null}
      {hasDraft ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(123,94,167,0.12)',
            border: '1px solid rgba(123,94,167,0.35)',
            color: '#d7c4f2',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span>임시저장된 내용 불러오기</span>
          <button
            type="button"
            onClick={() => {
              if (typeof window === 'undefined') return
              const key = editId ? `auran_product_draft_${editId}` : 'auran_product_draft_new'
              const raw = localStorage.getItem(key)
              if (!raw) return
              try {
                const d = JSON.parse(raw) as any
                setName(String(d.name || ''))
                setShortDesc(String(d.shortDesc || ''))
                setKeywords(String(d.keywords || ''))
                setBrandId(String(d.brandId || ''))
                setOrigin((ORIGINS as readonly string[]).includes(String(d.origin || '')) ? (String(d.origin) as (typeof ORIGINS)[number]) : '한국')
                setManufacturer(String(d.manufacturer || ''))
                setSaleUi((String(d.saleUi || 'active') as SaleUi))
                setOptionsText(String(d.optionsText || ''))
                setRetailPrice(String(d.retailPrice || ''))
                setUnitType(String(d.unitType || ''))
                setUnitPrice(String(d.unitPrice || ''))
                setSalePrice(String(d.salePrice || ''))
                setAvgUsageDays(String(d.avgUsageDays || ''))
                setQtyUi((String(d.qtyUi || 'unlimited') as QtyUi))
                setStockInput(String(d.stockInput || '0'))
                setTimesaleStart(String(d.timesaleStart || ''))
                setTimesaleEnd(String(d.timesaleEnd || ''))
                setPurchaseMode((String(d.purchaseMode || 'percent') as PointMode))
                setPurchaseVal(String(d.purchaseVal || ''))
                setShareVal(String(d.shareVal || ''))
                setReviewText(String(d.reviewText || '100'))
                setReviewPhoto(String(d.reviewPhoto || '300'))
                setReviewVideo(String(d.reviewVideo || '500'))
                setShipFee(String(d.shipFee || ''))
                setShipMemo(String(d.shipMemo || ''))
                setThumbImages(Array.isArray(d.thumbImages) ? d.thumbImages.slice(0, 5) : ['', '', '', '', ''])
                setVideoUrl(String(d.videoUrl || ''))
                setDetailContent(String(d.detailContent || ''))
                setKeyIngredients(String(d.keyIngredients || ''))
                setSkinTypesProduct(Array.isArray(d.skinTypesProduct) ? d.skinTypesProduct.map((x: unknown) => String(x)) : [])
                setSkinConcernsProduct(Array.isArray(d.skinConcernsProduct) ? d.skinConcernsProduct.map((x: unknown) => String(x)) : [])
                setHormoneTimingProduct(String(d.hormoneTimingProduct || ''))
                setClinicalResult(String(d.clinicalResult || ''))
                setCertificationsText(String(d.certificationsText || ''))
                setPerfectTogetherInput(String(d.perfectTogetherInput || ''))
                setDetailImages(Array.isArray(d.detailImages) ? d.detailImages : [])
                setCatL1(String(d.catL1 || ''))
                setCatL2(String(d.catL2 || ''))
                setCatL3(String(d.catL3 || ''))
                setCatL4(String(d.catL4 || ''))
                setCatL5(String(d.catL5 || ''))
                setSelectedSkinTagIds(Array.isArray(d.selectedSkinTagIds) ? d.selectedSkinTagIds.map((x: unknown) => String(x)) : [])
                setMsg('임시저장 내용을 불러왔습니다')
              } catch {
                setMsg('임시저장 복원 실패')
              }
            }}
            style={{
              borderRadius: 8,
              border: '1px solid rgba(123,94,167,0.45)',
              background: 'rgba(123,94,167,0.22)',
              color: '#e8d9ff',
              fontSize: 11,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            불러오기
          </button>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setTabIdx(i)}
            style={{
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              border: '1px solid',
              background: tabIdx === i ? 'rgba(201,168,76,0.22)' : 'rgba(255,255,255,0.06)',
              borderColor: tabIdx === i ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.12)',
              color: tabIdx === i ? '#c9a84c' : 'rgba(255,255,255,0.75)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tabIdx === 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>상품명 (최대 100자)</span>
            <input value={name} maxLength={100} onChange={e => setName(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>짧은 설명</span>
            <input value={shortDesc} onChange={e => setShortDesc(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>검색 키워드 (콤마 구분)</span>
            <input value={keywords} onChange={e => setKeywords(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>브랜드</span>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <select
                  value={brandId}
                  onChange={e => {
                    const id = e.target.value
                    setBrandId(id)
                    const nb = brands.find(x => x.id === id)
                    const oc = String(nb?.origin_country || '').trim()
                    if (oc) {
                      const normalized = (ORIGINS as readonly string[]).includes(oc) ? oc : '기타'
                      setOrigin(normalized as (typeof ORIGINS)[number])
                    }
                  }}
                  style={{ ...inputStyle, background: '#121212' }}
                >
                  <option value="">— 선택 —</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewBrand(v => !v)}
                  style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, padding: '0 12px', cursor: 'pointer' }}
                >
                  + 새 브랜드
                </button>
              </div>
              {showNewBrand ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                    <input
                      value={newBrandName}
                      onChange={e => setNewBrandName(e.target.value)}
                      placeholder="브랜드명 입력"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const nm = newBrandName.trim()
                        if (!nm) return
                        const oc = newBrandOriginCountry.trim()
                        if (!oc) {
                          setMsg('새 브랜드 등록 시 원산지를 선택하세요')
                          return
                        }
                        const { data, error } = await supabase
                          .from('brands')
                          .insert({ name: nm, status: 'active', origin_country: oc } as any)
                          .select('id,name,origin_country')
                          .single()
                        if (error) {
                          setMsg(error.message)
                          return
                        }
                        if (data) {
                          setBrands(prev =>
                            [...prev, data as { id: string; name: string; origin_country?: string | null }].sort((a, b) =>
                              a.name.localeCompare(b.name)
                            )
                          )
                          setBrandId((data as { id: string }).id)
                          setNewBrandName('')
                          setNewBrandOriginCountry('')
                          setShowNewBrand(false)
                          setOrigin((ORIGINS as readonly string[]).includes(oc) ? (oc as (typeof ORIGINS)[number]) : '기타')
                        }
                      }}
                    style={{ borderRadius: 10, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.2)', color: '#c9a84c', fontSize: 12, padding: '0 12px', cursor: 'pointer', fontWeight: 800 }}
                  >
                    등록
                  </button>
                  </div>
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={labelStyle}>브랜드 원산지 (필수)</span>
                    <select
                      value={newBrandOriginCountry}
                      onChange={e => setNewBrandOriginCountry(e.target.value)}
                      style={{ ...inputStyle, background: '#121212' }}
                    >
                      <option value="" style={{ background: '#1a1a1a' }}>
                        — 선택 —
                      </option>
                      {ORIGINS.map(o => (
                        <option key={o} value={o} style={{ background: '#1a1a1a' }}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
            </div>
          </label>
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={labelStyle}>카테고리 · 스킨태그</span>
            <button
              type="button"
              onClick={() => {
                setCategoryPickerTab('select')
                setShowCategoryPicker(true)
              }}
              style={{
                ...inputStyle,
                textAlign: 'left',
                background: '#121212',
                cursor: 'pointer',
              }}
            >
              {categoryBreadcrumb || '카테고리 선택'}
            </button>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>선택 경로: {categoryBreadcrumb || '미선택'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {skinTagOptions.map(t => {
                const on = selectedSkinTagIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setSelectedSkinTagIds(prev => (on ? prev.filter(x => x !== t.id) : [...prev, t.id]))
                    }
                    style={{
                      padding: '5px 9px',
                      borderRadius: 999,
                      border: on ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.15)',
                      background: on ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
                      color: on ? '#e8d4a8' : 'rgba(255,255,255,0.7)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>
              원산지
              {originLocked ? (
                <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}> · 브랜드 원산지 연동 (읽기 전용)</span>
              ) : null}
            </span>
            <select
              value={origin}
              onChange={e => setOrigin(e.target.value as (typeof ORIGINS)[number])}
              disabled={originLocked}
              style={{
                ...inputStyle,
                background: '#121212',
                opacity: originLocked ? 0.75 : 1,
                cursor: originLocked ? 'not-allowed' : undefined,
              }}
            >
              {ORIGINS.map(o => (
                <option key={o} value={o} style={{ background: '#1a1a1a' }}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>제조사</span>
            <input value={manufacturer} onChange={e => setManufacturer(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#fff' }}>
            <input
              type="checkbox"
              checked={isFlashSaleState}
              onChange={e => setIsFlashSaleState(e.target.checked)}
            />
            공구 · 이벤트(플래시) 상품
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={labelStyle}>판매 여부</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {(
                [
                  ['active', '진열'],
                  ['sold_out', '품절'],
                  ['discontinued', '단종'],
                  ['paused', '중지'],
                ] as const
              ).map(([k, lab]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#fff' }}>
                  <input
                    type="radio"
                    name="saleUi"
                    checked={saleUi === k}
                    onChange={() => setSaleUi(k)}
                  />
                  {lab}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {tabIdx === 1 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <span style={labelStyle}>옵션 (자유 입력 · 저장 시 메타로 보관)</span>
          <textarea
            value={optionsText}
            onChange={e => setOptionsText(e.target.value)}
            rows={10}
            placeholder="예: 색상=화이트/블랙&#10;사이즈=S/M/L"
            style={{ ...inputStyle, minHeight: 160, resize: 'vertical' }}
          />
        </div>
      )}

      {tabIdx === 2 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>시중가 (원)</span>
            <input
              value={retailPrice}
              onChange={e => setRetailPrice(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              style={inputStyle}
            />
          </label>
          <div
            style={{
              display: 'grid',
              gap: 10,
              padding: 14,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <span style={labelStyle}>단위가격 (고객 상세에 노출)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={labelStyle}>기준</span>
                <select
                  value={unitType}
                  onChange={e => setUnitType(e.target.value)}
                  style={{ ...inputStyle, background: '#121212' }}
                >
                  <option value="" style={{ background: '#1a1a1a' }}>
                    — 선택 —
                  </option>
                  {UNIT_TYPE_OPTIONS.map(o => (
                    <option key={o} value={o} style={{ background: '#1a1a1a' }}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={labelStyle}>가격 (원)</span>
                <input
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                  inputMode="decimal"
                  placeholder="예: 1250"
                  style={inputStyle}
                />
              </label>
            </div>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>판매가 (원)</span>
            <input
              value={salePrice}
              onChange={e => setSalePrice(e.target.value.replace(/[^0-9.]/g, ''))}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>평균 소진 기간 (일)</span>
            <input
              type="number"
              min={1}
              max={365}
              placeholder="60"
              value={avgUsageDays}
              onChange={e => setAvgUsageDays(e.target.value.replace(/[^0-9]/g, ''))}
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={labelStyle}>수량</span>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#fff' }}>
                <input type="radio" name="qty" checked={qtyUi === 'unlimited'} onChange={() => setQtyUi('unlimited')} />
                무제한
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#fff' }}>
                <input type="radio" name="qty" checked={qtyUi === 'limited'} onChange={() => setQtyUi('limited')} />
                한정
              </label>
            </div>
            {qtyUi === 'limited' ? (
              <input
                value={stockInput}
                onChange={e => setStockInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="재고 수량"
                style={inputStyle}
              />
            ) : null}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={labelStyle}>판매 기간 (타임세일)</span>
            <input type="datetime-local" value={timesaleStart} onChange={e => setTimesaleStart(e.target.value)} style={inputStyle} />
            <input type="datetime-local" value={timesaleEnd} onChange={e => setTimesaleEnd(e.target.value)} style={inputStyle} />
          </div>
        </div>
      )}

      {tabIdx === 3 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>구매 포인트 (P / % / 원)</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['percent', 'point', 'won'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPurchaseMode(m)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: purchaseMode === m ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {m === 'percent' ? '%' : m === 'point' ? 'P' : '원'}
                </button>
              ))}
              <input
                value={purchaseVal}
                onChange={e => setPurchaseVal(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="값"
                style={{ ...inputStyle, maxWidth: 200 }}
              />
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
              % → earn_points · P/원 → earn_points_percent(숫자)
            </span>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>리뷰 포인트 (텍스트 / 포토 / 영상)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <input value={reviewText} onChange={e => setReviewText(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="텍스트" />
              <input value={reviewPhoto} onChange={e => setReviewPhoto(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="포토" />
              <input value={reviewVideo} onChange={e => setReviewVideo(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} placeholder="영상" />
            </div>
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>공유 포인트 (P)</span>
            <input
              value={shareVal}
              onChange={e => setShareVal(e.target.value.replace(/[^0-9]/g, ''))}
              style={inputStyle}
            />
          </label>
        </div>
      )}

      {tabIdx === 4 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>배송비 (원)</span>
            <input value={shipFee} onChange={e => setShipFee(e.target.value.replace(/[^0-9]/g, ''))} style={inputStyle} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>배송 메모</span>
            <textarea value={shipMemo} onChange={e => setShipMemo(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
        </div>
      )}

      {tabIdx === 5 && (
        <div style={{ display: 'grid', gap: 14 }}>
          <span style={labelStyle}>이미지 1 ~ 5 (Supabase Storage)</span>
          <div style={{ display: 'grid', gap: 10 }}>
            {[0, 1, 2, 3, 4].map(slot => (
              <div key={slot} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ width: 56, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>이미지 {slot + 1}</span>
                <input
                  ref={el => {
                    fileRefs.current[slot] = el
                  }}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => void handleImagePick(slot, e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileRefs.current[slot]?.click()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  파일 선택
                </button>
                {thumbImages[slot] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbImages[slot]} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }} />
                ) : null}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>짧은 영상</span>
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={e => void handleVideoPick(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => videoRef.current?.click()}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              영상 업로드
            </button>
            {videoUrl ? (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all' }}>{videoUrl}</span>
            ) : null}
          </div>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>상세 설명</span>
            <textarea
              value={detailContent}
              onChange={e => setDetailContent(e.target.value)}
              rows={12}
              style={{ ...inputStyle, minHeight: 200, resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>KEY INGREDIENTS</span>
            <textarea
              value={keyIngredients}
              onChange={e => setKeyIngredients(e.target.value)}
              rows={5}
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            />
            <input
              ref={ingredientPhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => {
                ingredientPhotoFileRef.current = e.target.files?.[0] ?? null
                setIngredientAnalyzeDone(false)
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, width: '100%' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => ingredientPhotoRef.current?.click()}
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  전성분 사진
                </button>
                <button
                  type="button"
                  disabled={ingredientAnalyzeLoading}
                  onClick={() =>
                    void (async () => {
                      setIngredientAnalyzeLoading(true)
                      setIngredientAnalyzeDone(false)
                      setMsg('')
                      try {
                        const SKIN_TYPES = ['건성', '지성', '복합성', '민감성', '중성', '모든피부']
                        const SKIN_CONCERNS = ['수분부족', '트러블', '미백/톤업', '안티에이징', '모공', '각질', '민감', '탄력저하']
                        const MAP_CONCERN: Record<string, string> = {
                          트러블: '트러블',
                          건조: '수분부족',
                          탄력: '탄력저하',
                          미백: '미백/톤업',
                          홍조: '민감',
                          진정: '민감',
                          호르몬케어: '안티에이징',
                        }
                        const file = ingredientPhotoFileRef.current
                        let content: unknown
                        if (file) {
                          const dataUrl = await new Promise<string>((resolve, reject) => {
                            const fr = new FileReader()
                            fr.onload = () => resolve(String(fr.result || ''))
                            fr.onerror = () => reject(new Error('이미지를 읽지 못했습니다'))
                            fr.readAsDataURL(file)
                          })
                          const comma = dataUrl.indexOf(',')
                          const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
                          const mediaType =
                            file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
                          content = [
                            {
                              type: 'image',
                              source: { type: 'base64', media_type: mediaType, data: base64 },
                            },
                            {
                              type: 'text',
                              text:
                                '전성분을 읽고 아래 JSON만 반환해. 설명 없이.\nconcern_tags: 트러블/건조/탄력/미백/홍조/진정/호르몬케어 중 해당만.\nskin_tags: #건성 #지성 #복합성 #민감성 #탄력 #미백 #수분 #트러블 #모공 #홍조 #재생 #각질 #갱년기 #열감 #호르몬밸런스 #30대 #40대 #50대 #장벽강화 #펩타이드 #레티놀 #비타민C 중 해당만.\nhormone_timing: 달빛기(생리기)/황금기(여포기)/만개기(배란기)/물들기(황체기) 중 해당만.\n{"concern_tags":[],"skin_tags":[],"hormone_timing":[]}',
                            },
                          ]
                        } else {
                          const text = keyIngredients.trim()
                          if (!text) {
                            setMsg('전성분 텍스트를 입력하거나 사진을 선택하세요')
                            setIngredientAnalyzeLoading(false)
                            return
                          }
                          content = `전성분: ${text}\n아래 JSON만 반환해. 설명 없이.\n{"concern_tags":["트러블/건조/탄력/미백/홍조/진정/호르몬케어 중 해당"],"skin_tags":["#건성 #지성 #복합성 #민감성 #탄력 #미백 #수분 #트러블 #모공 #홍조 #재생 #각질 #갱년기 #열감 #호르몬밸런스 #30대 #40대 #50대 #장벽강화 #펩타이드 #레티놀 #비타민C 중 해당"],"hormone_timing":["달빛기(생리기)/황금기(여포기)/만개기(배란기)/물들기(황체기) 중 해당"]}`
                        }
                        const res = await fetch('/api/analyze-ingredients', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ content, name: name || '' }),
                        })
                        const data = (await res.json()) as {
                          concern_tags?: unknown
                          skin_tags?: unknown
                          hormone_timing?: unknown
                          error?: string
                        }
                        if (!res.ok) throw new Error(data.error || '분석 실패')
                        const rawC = Array.isArray(data.concern_tags) ? data.concern_tags : []
                        const FROM_TAG: Record<string, string> = {
                          탄력: '탄력저하',
                          미백: '미백/톤업',
                          수분: '수분부족',
                          트러블: '트러블',
                          모공: '모공',
                          홍조: '민감',
                          재생: '안티에이징',
                          각질: '각질',
                          갱년기: '안티에이징',
                          열감: '민감',
                          호르몬밸런스: '안티에이징',
                          장벽강화: '민감',
                          펩타이드: '안티에이징',
                          레티놀: '안티에이징',
                          비타민C: '미백/톤업',
                          '30대': '안티에이징',
                          '40대': '안티에이징',
                          '50대': '안티에이징',
                        }
                        const rawS = Array.isArray(data.skin_tags) ? data.skin_tags : []
                        const nextS = [
                          ...Array.from(new Set(
                            rawS.flatMap((x: unknown) => {
                              const raw = String(x)
                                .trim()
                                .replace(/^#+/, '')
                              return SKIN_TYPES.filter(t => raw === t || raw.includes(t) || t.includes(raw))
                            })
                          )),
                        ]
                        const nextC = [
                          ...Array.from(new Set(
                            [
                              ...rawC
                                .map((x: unknown) => {
                                  const s = String(x).trim()
                                  if (SKIN_CONCERNS.includes(s)) return s
                                  return MAP_CONCERN[s] || ''
                                })
                                .filter(Boolean),
                              ...rawS.flatMap((x: unknown) => {
                                const raw = String(x)
                                  .trim()
                                  .replace(/^#+/, '')
                                const m = FROM_TAG[raw]
                                return m && SKIN_CONCERNS.includes(m) ? [m] : []
                              }),
                            ]
                          )),
                        ]
                        const h = data.hormone_timing
                        const htStr = Array.isArray(h)
                          ? JSON.stringify(h.map((x: unknown) => String(x)))
                          : h != null && String(h).trim()
                            ? String(h)
                            : ''
                        setSkinConcernsProduct(nextC)
                        setSkinTypesProduct(nextS)
                        if (htStr) setHormoneTimingProduct(htStr)
                        setIngredientAnalyzeDone(true)
                      } catch (e: unknown) {
                        setMsg(e instanceof Error ? e.message : '분석 오류')
                      } finally {
                        setIngredientAnalyzeLoading(false)
                      }
                    })()
                  }
                  style={{
                    minHeight: 44,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(201,168,76,0.45)',
                    background: ingredientAnalyzeLoading ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.22)',
                    color: '#e8d4a8',
                    fontSize: 12,
                    cursor: ingredientAnalyzeLoading ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {ingredientAnalyzeLoading ? '분석 중…' : 'AI 자동 분석'}
                </button>
                {ingredientAnalyzeLoading ? (
                  <>
                    <style dangerouslySetInnerHTML={{ __html: '@keyframes auranIngSpin{to{transform:rotate(360deg)}}' }} />
                    <span
                      aria-hidden
                      style={{
                        display: 'inline-block',
                        width: 18,
                        height: 18,
                        border: '2px solid rgba(255,255,255,0.15)',
                        borderTopColor: 'rgba(201,168,76,0.85)',
                        borderRadius: '50%',
                        animation: 'auranIngSpin 0.75s linear infinite',
                        flexShrink: 0,
                      }}
                    />
                  </>
                ) : null}
                {ingredientAnalyzeDone ? (
                  <span style={{ fontSize: 12, color: 'rgba(201,168,76,0.95)' }}>✓ 분석 완료</span>
                ) : null}
              </div>
            </div>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>CLINICAL RESULT</span>
            <textarea
              value={clinicalResult}
              onChange={e => setClinicalResult(e.target.value)}
              rows={5}
              style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>CERTIFICATIONS</span>
            <textarea
              value={certificationsText}
              onChange={e => setCertificationsText(e.target.value)}
              rows={4}
              placeholder="한 줄에 한 항목 (줄바꿈 구분)"
              style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>PERFECT TOGETHER (제품 UUID, 쉼표 구분)</span>
            <input
              value={perfectTogetherInput}
              onChange={e => setPerfectTogetherInput(e.target.value)}
              placeholder="uuid, uuid, ..."
              style={inputStyle}
            />
          </label>
          <div style={{ display: 'grid', gap: 8 }}>
            <span style={labelStyle}>상세 이미지 (detail_images)</span>
            <input
              ref={detailFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => void handleDetailImagePick(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => detailFileRef.current?.click()}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              상세 이미지 추가
            </button>
            {detailImages.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {detailImages.map((url, i) => (
                  <div key={url + i} style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      type="button"
                      onClick={() => setDetailImages(prev => prev.filter((_, j) => j !== i))}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.2)',
                        background: 'rgba(0,0,0,0.65)',
                        color: '#fff',
                        fontSize: 12,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tabIdx === 6 && (
        <div style={{ padding: '0 0 40px' }}>
          {!isSuperAdmin ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 0',
                color: 'rgba(255,255,255,0.3)',
                fontSize: 13,
              }}
            >
              슈퍼어드민만 접근할 수 있어요
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.4)',
                    marginBottom: 8,
                  }}
                >
                  AI 태깅 상태
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['pending', 'ai_suggested', 'needs_review', 'approved'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setForm((f: typeof form) => ({
                          ...f,
                          ai_tag_status: s,
                        }))
                      }
                      style={{
                        padding: '5px 12px',
                        borderRadius: 10,
                        fontSize: 11,
                        cursor: 'pointer',
                        border: 'none',
                        fontFamily: 'inherit',
                        background: form.ai_tag_status === s ? '#7B5EA7' : 'rgba(255,255,255,0.08)',
                        color: form.ai_tag_status === s ? '#fff' : 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {s === 'pending'
                        ? '미태깅'
                        : s === 'ai_suggested'
                          ? 'AI제안'
                          : s === 'needs_review'
                            ? '검수필요'
                            : '승인완료'}
                    </button>
                  ))}
                </div>
              </div>

              {[
                {
                  label: '루틴 단계',
                  key: 'step_tags' as const,
                  options: ['클렌징', '토너', '앰플·세럼', '크림', '선케어', '마스크·팩', '바디케어', '헤어케어'],
                },
                {
                  label: '기능',
                  key: 'func_tags' as const,
                  options: [
                    '보습·수분',
                    '탄력·주름',
                    '미백·톤업',
                    '진정·민감',
                    '장벽·재생',
                    '모공·피지',
                    '아로마·릴렉스',
                    '트러블케어',
                    '노화케어',
                  ],
                },
                {
                  label: '호르몬 단계',
                  key: 'hormone_tags' as const,
                  options: ['달빛기', '황금기', '만개기', '물들기', '갱년기', '남성', '전연령'],
                },
                {
                  label: '피부타입',
                  key: 'skin_types' as const,
                  options: ['건성', '지성', '복합성', '민감성', '중성', '모든피부'],
                },
                {
                  label: '날씨',
                  key: 'weather_tags' as const,
                  options: ['자외선높음', '자외선매우높음', '미세먼지나쁨', '황사', '건조한날', '일교차큼', '고온다습', '전천후'],
                },
                {
                  label: '계절',
                  key: 'season_tags' as const,
                  options: ['봄', '여름', '가을', '겨울', '전계절'],
                },
                { label: '성별', key: 'gender_tag' as const, options: ['여성', '남성', '공용'], single: true },
                {
                  label: '상황',
                  key: 'situation_tags' as const,
                  options: [
                    '여드름·뾰루지',
                    '피지·모공',
                    '좁쌀',
                    '가려움',
                    '벌레물림',
                    '압출후',
                    '시술후',
                    '음주후',
                    '수면부족',
                    '스트레스',
                    '반신욕용',
                    '족욕용',
                    '체취케어',
                    '마스크후',
                    '운동후',
                    '비행기탑승',
                    '임신·수유중',
                    '산후',
                    '아토피',
                    '10대사춘기',
                  ],
                },
                {
                  label: '신체 부위',
                  key: 'body_part_tags' as const,
                  options: [
                    '이마',
                    '코·T존',
                    '볼·U존',
                    '눈가',
                    '입술',
                    '턱라인',
                    '목·데콜테',
                    '등',
                    '팔닭살',
                    '겨드랑이',
                    '발뒤꿈치',
                    '복부',
                    '무릎·팔꿈치',
                  ],
                },
                {
                  label: '이벤트',
                  key: 'event_tags' as const,
                  options: [
                    '웨딩신부',
                    '웨딩신랑',
                    '웨딩D-100',
                    '웨딩D-60',
                    '웨딩D-30',
                    '웨딩D-14',
                    '웨딩D-7',
                    '웨딩D-3',
                    '웨딩D-1',
                    '웨딩당일',
                    '웨딩후',
                    '졸업사진',
                    '소개팅',
                    '면접',
                    '해외여행',
                    '출산예정',
                    '선물용',
                  ],
                },
                {
                  label: '성분',
                  key: 'ingredient_tags' as const,
                  options: [
                    '비건',
                    '크루얼티프리',
                    '무향',
                    '무색소',
                    '천연·유기농',
                    'EWG그린',
                    '임산부안전',
                    '스테로이드프리',
                    '파라벤프리',
                    '레티놀함유',
                    'AHA함유',
                    'BHA함유',
                    '나이아신아마이드',
                    '세라마이드',
                    '히알루론산',
                    '펩타이드',
                  ],
                },
                {
                  label: '의료·피부질환',
                  key: 'medical_tags' as const,
                  options: [
                    '아토피',
                    '건선',
                    '지루성피부염',
                    '로사세아',
                    '색소침착',
                    '흉터케어',
                    '보톡스후',
                    '필러후',
                    '레이저후',
                    '박피후',
                    '항암중',
                  ],
                },
              ].map(({ label, key, options, single }) => (
                <div key={key}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 8,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    {options.map(opt => {
                      const val = (form as Record<string, string | string[]>)[key]
                      const isSelected = single ? val === opt : Array.isArray(val) && val.includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            if (single) {
                              setForm(f => ({
                                ...f,
                                [key]: isSelected ? '' : opt,
                              }))
                            } else {
                              setForm(f => {
                                const cur = (f[key as keyof typeof f] as string[]) || []
                                return {
                                  ...f,
                                  [key]: isSelected ? cur.filter((v: string) => v !== opt) : [...cur, opt],
                                }
                              })
                            }
                          }}
                          style={{
                            padding: '5px 11px',
                            borderRadius: 10,
                            fontSize: 11,
                            cursor: 'pointer',
                            border: 'none',
                            fontFamily: 'inherit',
                            background: isSelected ? '#7B5EA7' : 'rgba(255,255,255,0.08)',
                            color: isSelected ? '#fff' : 'rgba(255,255,255,0.45)',
                          }}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  setForm(f => ({ ...f, ai_tag_status: 'approved' }))
                  void onSave({ ai_tag_status: 'approved' })
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  fontFamily: 'inherit',
                  background: '#7B5EA7',
                  color: '#fff',
                }}
              >
                태그 저장 · 승인
              </button>
            </div>
          )}
        </div>
      )}

      {showCategoryPicker ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 120 }}>
          <button
            type="button"
            onClick={() => setShowCategoryPicker(false)}
            style={{ position: 'absolute', inset: 0, border: 'none', background: 'rgba(0,0,0,0.55)', cursor: 'pointer' }}
            aria-label="닫기"
          />
          <div
            style={{
              position: 'absolute',
              left: isMobileSheet ? 0 : '50%',
              right: isMobileSheet ? 0 : undefined,
              top: isMobileSheet ? 'auto' : '8%',
              bottom: isMobileSheet ? 0 : 'auto',
              transform: isMobileSheet ? 'none' : 'translateX(-50%)',
              width: isMobileSheet ? '100%' : 'min(980px, 92vw)',
              maxHeight: isMobileSheet ? '86vh' : '84vh',
              overflow: 'auto',
              borderRadius: isMobileSheet ? '18px 18px 0 0' : 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: '#121212',
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => setCategoryPickerTab('search')}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: categoryPickerTab === 'search' ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.15)',
                  background: categoryPickerTab === 'search' ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
                  color: categoryPickerTab === 'search' ? '#e8d4a8' : '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                카테고리명 검색
              </button>
              <button
                type="button"
                onClick={() => setCategoryPickerTab('select')}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid',
                  borderColor: categoryPickerTab === 'select' ? 'rgba(201,168,76,0.55)' : 'rgba(255,255,255,0.15)',
                  background: categoryPickerTab === 'select' ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
                  color: categoryPickerTab === 'select' ? '#e8d4a8' : '#fff',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                카테고리명 선택
              </button>
            </div>
            {categoryPickerTab === 'search' ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  placeholder="카테고리명 검색"
                  style={inputStyle}
                />
                <div style={{ display: 'grid', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {categorySearchRows.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setProductCategoryLeafId(c.id)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      L{c.level} · {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(150px, 1fr))', gap: 8 }}>
                {[
                  { list: catOpts1, value: catL1, set: setCatL1, reset: () => { setCatL2(''); setCatL3(''); setCatL4(''); setCatL5('') } },
                  { list: catOpts2, value: catL2, set: setCatL2, reset: () => { setCatL3(''); setCatL4(''); setCatL5('') } },
                  { list: catOpts3, value: catL3, set: setCatL3, reset: () => { setCatL4(''); setCatL5('') } },
                  { list: catOpts4, value: catL4, set: setCatL4, reset: () => { setCatL5('') } },
                  { list: catOpts5, value: catL5, set: setCatL5, reset: () => {} },
                ].map((col, idx) => (
                  <div key={idx} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, minHeight: 250, padding: 8 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>{idx + 1}단계</div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {col.list.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { col.set(c.id); col.reset() }}
                          style={{
                            textAlign: 'left',
                            padding: '7px 8px',
                            borderRadius: 8,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: col.value === c.id ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.04)',
                            color: '#fff',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 12, color: '#e8d4a8' }}>선택 경로: {categoryBreadcrumb || '미선택'}</div>
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {skinTagOptions.map(t => {
                const on = selectedSkinTagIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedSkinTagIds(prev => (on ? prev.filter(x => x !== t.id) : [...prev, t.id]))}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 999,
                      border: on ? '1px solid rgba(201,168,76,0.55)' : '1px solid rgba(255,255,255,0.16)',
                      background: on ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)',
                      color: on ? '#e8d4a8' : '#fff',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {t.name}
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(false)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', cursor: 'pointer' }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(false)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.2)', color: '#e8d4a8', cursor: 'pointer' }}
              >
                선택 완료
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {tabIdx === 0 ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#fff' }}>
              <input
                type="checkbox"
                checked={isExclusiveProduct}
                onChange={e => setIsExclusiveProduct(e.target.checked)}
              />
              🔒 AURAN 독점 브랜드 (첫구매 전 비노출)
            </label>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (typeof window === 'undefined') return
            const key = editId ? `auran_product_draft_${editId}` : 'auran_product_draft_new'
            localStorage.setItem(
              key,
              JSON.stringify({
                name, shortDesc, keywords, brandId, origin, manufacturer, saleUi, optionsText, retailPrice, unitType, unitPrice, salePrice,
                avgUsageDays, qtyUi, stockInput, timesaleStart, timesaleEnd, purchaseMode, purchaseVal, shareVal, reviewText, reviewPhoto,
                reviewVideo, shipFee, shipMemo, thumbImages, videoUrl, detailContent, keyIngredients, skinTypesProduct, skinConcernsProduct,
                hormoneTimingProduct, clinicalResult, certificationsText,
                perfectTogetherInput, detailImages, catL1, catL2, catL3, catL4, catL5, selectedSkinTagIds,
              })
            )
            setHasDraft(true)
            setMsg('임시저장되었습니다')
          }}
          style={{
            padding: '12px 0',
            borderRadius: 12,
            border: '1px solid rgba(123,94,167,0.45)',
            background: 'rgba(123,94,167,0.2)',
            color: '#d7c4f2',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          임시저장
        </button>
        <button
          type="button"
          onClick={() => {
            if (!editId) {
              setMsg('미리보기는 저장 후 사용할 수 있습니다')
              return
            }
            if (typeof window !== 'undefined') window.open(`/products/${editId}`, '_blank', 'noopener,noreferrer')
          }}
          style={{
            padding: '12px 0',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.06)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          미리보기
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          style={{
            padding: '12px 0',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #c9a84c 0%, #a8863a 100%)',
            color: '#000',
            fontSize: 14,
            fontWeight: 900,
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.75 : 1,
          }}
        >
          {saving ? '저장 중…' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
