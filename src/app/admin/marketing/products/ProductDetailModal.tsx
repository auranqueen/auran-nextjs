'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from '@toast-ui/react-editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import '@toast-ui/editor/dist/i18n/ko-kr'
import { compressImage } from '@/lib/imageUpload'

type TabKey = 'thumb' | 'basic' | 'detail' | 'points' | 'flash' | 'tags'

function debounce<A extends unknown[]>(fn: (...args: A) => void | Promise<void>, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      void fn(...args)
    }, ms)
  }
}

function tabLabel(t: TabKey, dirty: boolean) {
  const labels: Record<TabKey, string> = {
    thumb: '📷 썸네일',
    basic: '📝 기본정보',
    detail: '🖼 상세내용',
    points: '💰 토스트',
    flash: '⚡ 타임세일',
    tags: '🏷 태그관리',
  }
  return `${dirty ? '🔴 ' : ''}${labels[t]}`
}

export default function ProductDetailModal({
  product,
  tab: listTab,
  busyId,
  brands,
  onClose,
  onApprove,
  onReject,
  onToast,
  onProductUpdated,
  onSaveFlash: _onSaveFlash,
  hideApprovalFooter = false,
}: {
  product: any
  tab: 'pending' | 'active' | 'rejected'
  busyId: string | null
  brands: { id: string; name: string; origin_country?: string | null; default_earn_points?: number | null }[]
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onToast: (msg: string) => void
  onProductUpdated?: (p: any) => void
  hideApprovalFooter?: boolean
  onSaveFlash: (
    id: string,
    payload: {
      is_flash_sale: boolean
      flash_sale_price: number | null
      flash_sale_start: string | null
      flash_sale_end: string | null
    }
  ) => Promise<void>
}) {
  const supabase = createClient()

  const [modalTab, setModalTab] = useState<TabKey>('thumb')
  const [dirty, setDirty] = useState<Record<TabKey, boolean>>({
    thumb: false,
    basic: false,
    detail: false,
    points: false,
    flash: false,
    tags: false,
  })
  const mark = useCallback((k: TabKey, v: boolean) => {
    setDirty(d => ({ ...d, [k]: v }))
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const extraGalleryInputRef = useRef<HTMLInputElement>(null)
  const detailFilesRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<any>(null)

  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [thumbUploadedUrl, setThumbUploadedUrl] = useState<string | null>(null)
  const [thumbUploading, setThumbUploading] = useState(false)
  const [thumbHover, setThumbHover] = useState(false)
  const [galleryImgUrls, setGalleryImgUrls] = useState<string[]>([])
  const [galleryGifUrl, setGalleryGifUrl] = useState<string | null>(null)
  const [galleryVideoUrl, setGalleryVideoUrl] = useState<string | null>(null)
  const [galleryBusy, setGalleryBusy] = useState(false)

  const [nameDraft, setNameDraft] = useState(String(product.name || ''))
  const [priceDraft, setPriceDraft] = useState(String(product.retail_price ?? ''))
  const [unitTypeDraft, setUnitTypeDraft] = useState(String(product.unit_type || ''))
  const [unitPriceDraft, setUnitPriceDraft] = useState(
    product.unit_price != null && product.unit_price !== '' ? String(product.unit_price) : ''
  )
  const [brandId, setBrandId] = useState(String(product.brand_id || ''))
  const [descDraft, setDescDraft] = useState(String(product.description || ''))

  const [detailContent, setDetailContent] = useState(String(product.detail_html || product.detail_content || ''))
  const [blocks, setBlocks] = useState<any[]>(Array.isArray(product.detail_sections) ? product.detail_sections : [])
  const [detailImages, setDetailImages] = useState<string[]>(
    Array.isArray(product.detail_images) && product.detail_images.length
      ? product.detail_images
      : Array.isArray(product.detail_imgs)
        ? product.detail_imgs
        : []
  )
  const [detailPreview, setDetailPreview] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)

  const [keyIngredientsDraft, setKeyIngredientsDraft] = useState(String(product.key_ingredients ?? ''))
  const [clinicalResultDraft, setClinicalResultDraft] = useState(String(product.clinical_result ?? ''))
  const [keyIngredientsSaving, setKeyIngredientsSaving] = useState(false)
  const [clinicalResultSaving, setClinicalResultSaving] = useState(false)
  const [ptQuery, setPtQuery] = useState('')
  const [ptResults, setPtResults] = useState<{ id: string; name: string }[]>([])
  const [ptPicks, setPtPicks] = useState<{ id: string; name: string }[]>([])
  const [ptPickOpen, setPtPickOpen] = useState(false)
  const [ptSaving, setPtSaving] = useState(false)
  const [shareCopyPointsDraft, setShareCopyPointsDraft] = useState(
    Array.isArray(product.share_copy_points)
      ? (product.share_copy_points as unknown[]).map((x) => String(x)).join('\n')
      : ''
  )
  const [shareCopyPointsSaving, setShareCopyPointsSaving] = useState(false)
  const [hormoneDraft, setHormoneDraft] = useState(String(product.hormone_timing ?? ''))
  const [hormoneSaving, setHormoneSaving] = useState(false)

  const [earnPercent, setEarnPercent] = useState<number | ''>(product.earn_points == null ? '' : Number(product.earn_points))
  const [toastFixedAmount, setToastFixedAmount] = useState(Number(product.toast_fixed_amount ?? 0))
  const [sharePoints, setSharePoints] = useState(Number(product.share_points ?? 0))
  const [textReviewPts, setTextReviewPts] = useState(Number(product.review_points_text ?? 0))
  const [photoPoints, setPhotoPoints] = useState(Number(product.review_points_photo ?? 0))
  const [videoPoints, setVideoPoints] = useState(Number(product.review_points_video ?? 0))
  const [pointsSaving, setPointsSaving] = useState(false)

  const [isFlashSale, setIsFlashSale] = useState(
    !!(product.is_timesale ?? product.is_flash_sale)
  )
  const [flashSalePrice, setFlashSalePrice] = useState(
    String(product.sale_price ?? product.flash_sale_price ?? '')
  )
  const [flashSaleStart, setFlashSaleStart] = useState(
    product.timesale_starts_at
      ? new Date(product.timesale_starts_at).toISOString().slice(0, 16)
      : product.flash_sale_start
        ? new Date(product.flash_sale_start).toISOString().slice(0, 16)
        : ''
  )
  const [flashSaleEnd, setFlashSaleEnd] = useState(
    product.timesale_ends_at
      ? new Date(product.timesale_ends_at).toISOString().slice(0, 16)
      : product.flash_sale_end
        ? new Date(product.flash_sale_end).toISOString().slice(0, 16)
        : ''
  )
  const [timesaleSaving, setTimesaleSaving] = useState(false)
  const [isGroupBuy, setIsGroupBuy] = useState(!!product.is_groupbuy)
  const [groupbuySaving, setGroupbuySaving] = useState(false)

  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [tagForm, setTagForm] = useState<any>({
    step_tags: [],
    func_tags: [],
    hormone_tags: [],
    age_tag: [],
    weather_tags: [],
    season_tags: [],
    gender_tag: '',
    situation_tags: [],
    body_part_tags: [],
    lifestyle_tags: [],
    timing_tags: [],
    event_tags: [],
    ingredient_tags: [],
    medical_tags: [],
    skin_types: [],
    ai_tag_status: 'pending',
    // [원장 코멘트] AI owner_analysis 자동채움 → 원장 직접 수정 가능
    owner_comment: '',
  })
  const [ingredientImg, setIngredientImg] = useState<string | null>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiReason, setAiReason] = useState('')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user as { app_metadata?: { role?: string }; raw_app_meta_data?: { role?: string } }
      const role = user?.app_metadata?.role ?? user?.raw_app_meta_data?.role ?? ''
      setIsSuperAdmin(role === 'super_admin')
    })
  }, [supabase])

  const thumbDisplay = thumbPreview || product.thumb_img || product.storage_thumb_url || '/og-image.png'

  useEffect(() => {
    setThumbPreview(null)
    setThumbUploadedUrl(null)
    const ti = Array.isArray(product.thumb_images) ? ([...(product.thumb_images as string[])] as string[]) : []
    const g = ti.find(u => /\.gif($|\?)/i.test(String(u).trim())) || null
    const rest = ti.filter(u => u !== g)
    setGalleryImgUrls(rest.slice(0, 5))
    setGalleryGifUrl(g)
    setGalleryVideoUrl(typeof product.video_url === 'string' && product.video_url.trim() ? product.video_url.trim() : null)
    setNameDraft(String(product.name || ''))
    setPriceDraft(String(product.retail_price ?? ''))
    setUnitTypeDraft(String(product.unit_type || ''))
    setUnitPriceDraft(product.unit_price != null && product.unit_price !== '' ? String(product.unit_price) : '')
    setBrandId(String(product.brand_id || ''))
    setDescDraft(String(product.description || ''))
    setDetailContent(String(product.detail_html || product.detail_content || ''))
    setBlocks(Array.isArray(product.detail_sections) ? product.detail_sections : [])
    setDetailImages(
      Array.isArray(product.detail_images) && product.detail_images.length
        ? product.detail_images
        : Array.isArray(product.detail_imgs)
          ? product.detail_imgs
          : []
    )
    setEarnPercent(product.earn_points == null ? '' : Number(product.earn_points))
    setToastFixedAmount(Number(product.toast_fixed_amount ?? 0))
    setSharePoints(Number(product.share_points ?? 0))
    setTextReviewPts(Number(product.review_points_text ?? 0))
    setPhotoPoints(Number(product.review_points_photo ?? 0))
    setVideoPoints(Number(product.review_points_video ?? 0))
    setIsFlashSale(!!(product.is_timesale ?? product.is_flash_sale))
    setFlashSalePrice(String(product.sale_price ?? product.flash_sale_price ?? ''))
    setFlashSaleStart(
      product.timesale_starts_at
        ? new Date(product.timesale_starts_at).toISOString().slice(0, 16)
        : product.flash_sale_start
          ? new Date(product.flash_sale_start).toISOString().slice(0, 16)
          : ''
    )
    setFlashSaleEnd(
      product.timesale_ends_at
        ? new Date(product.timesale_ends_at).toISOString().slice(0, 16)
        : product.flash_sale_end
          ? new Date(product.flash_sale_end).toISOString().slice(0, 16)
          : ''
    )
    setIsGroupBuy(!!product.is_groupbuy)
    setGroupbuySaving(false)
    setTimesaleSaving(false)
    setKeyIngredientsDraft(String(product.key_ingredients ?? ''))
    setClinicalResultDraft(String(product.clinical_result ?? ''))
    setPtPicks([])
    void (async () => {
      const ids = Array.isArray(product.perfect_together)
        ? (product.perfect_together as unknown[]).map((x) => String(x).trim()).filter(Boolean)
        : []
      if (ids.length === 0) return
      const { data, error } = await supabase.from('products').select('id, name').in('id', ids)
      if (error || !data) {
        setPtPicks(ids.map((id) => ({ id, name: id })))
        return
      }
      const byId = new Map((data as { id: string; name: string }[]).map((r) => [r.id, r.name]))
      setPtPicks(ids.map((id) => ({ id, name: String(byId.get(id) || id) })))
    })()
    setPtQuery('')
    setPtResults([])
    setPtPickOpen(false)
    setKeyIngredientsSaving(false)
    setClinicalResultSaving(false)
    setPtSaving(false)
    setShareCopyPointsDraft(
      Array.isArray(product.share_copy_points)
        ? (product.share_copy_points as unknown[]).map((x) => String(x)).join('\n')
        : ''
    )
    setShareCopyPointsSaving(false)
    setHormoneDraft(String(product.hormone_timing ?? ''))
    setHormoneSaving(false)
    const strArr = (v: unknown) => (Array.isArray(v) ? v.map(x => String(x)) : [])
    setTagForm({
      step_tags: strArr(product.step_tags),
      func_tags: strArr(product.func_tags),
      hormone_tags: strArr(product.hormone_tags),
      age_tag: strArr((product as any).age_tag),
      weather_tags: strArr(product.weather_tags),
      season_tags: strArr(product.season_tags),
      gender_tag: String(product.gender_tag ?? ''),
      situation_tags: strArr(product.situation_tags),
      body_part_tags: strArr(product.body_part_tags),
      lifestyle_tags: strArr(product.lifestyle_tags),
      timing_tags: strArr(product.timing_tags),
      event_tags: strArr(product.event_tags),
      ingredient_tags: strArr(product.ingredient_tags),
      medical_tags: strArr(product.medical_tags),
      skin_types: Array.isArray(product.skin_types) ? (product.skin_types as unknown[]).map(x => String(x)) : [],
      ai_tag_status: String(product.ai_tag_status ?? 'pending'),
      // [원장 코멘트] DB에서 불러온 값 세팅
      owner_comment: product.owner_comment || '',
    })
    setDirty({ thumb: false, basic: false, detail: false, points: false, flash: false, tags: false })
    setModalTab('thumb')
  }, [product.id])

  const hasDirty = useMemo(() => Object.values(dirty).some(Boolean), [dirty])

  const productRef = useRef(product)
  const onToastRef = useRef(onToast)
  const onProductUpdatedRef = useRef(onProductUpdated)
  useEffect(() => {
    productRef.current = product
  }, [product])
  useEffect(() => {
    onToastRef.current = onToast
    onProductUpdatedRef.current = onProductUpdated
  }, [onToast, onProductUpdated])

  const debouncedPtSearch = useMemo(
    () =>
      debounce(async (q: string, pid: string) => {
        const t = q.trim()
        if (t.length < 1) {
          setPtResults([])
          return
        }
        const { data, error } = await supabase
          .from('products')
          .select('id, name')
          .ilike('name', `%${t}%`)
          .neq('id', pid)
          .limit(12)
        if (error) {
          setPtResults([])
          return
        }
        setPtResults((data as { id: string; name: string }[]) || [])
      }, 220),
    []
  )

  useEffect(() => {
    debouncedPtSearch(ptQuery, product.id)
  }, [ptQuery, product.id, debouncedPtSearch])

  const debouncedSaveNamePrice = useMemo(
    () =>
      debounce(
        async (field: 'name' | 'retail_price' | 'unit_type' | 'unit_price', value: string) => {
          const p = productRef.current
          const id = p.id
          const payload =
            field === 'name'
              ? { name: value.trim() }
              : field === 'retail_price'
                ? { retail_price: Math.max(0, Math.floor(Number(value) || 0)) }
                : field === 'unit_type'
                  ? { unit_type: value.trim() || null }
                  : {
                      unit_price:
                        value.trim() === ''
                          ? null
                          : (() => {
                              const n = Number(value.trim().replace(/,/g, ''))
                              return Number.isFinite(n) && n >= 0 ? n : null
                            })(),
                    }
          const { error } = await supabase.from('products').update(payload).eq('id', id)
          if (error) {
            onToastRef.current(error.message || '저장 실패')
            return
          }
          onToastRef.current('✅ 저장됨')
          onProductUpdatedRef.current?.({
            ...p,
            ...(field === 'name'
              ? { name: value.trim() }
              : field === 'retail_price'
                ? {
                    retail_price: Math.max(0, Math.floor(Number(value) || 0)),
                    price: Math.max(0, Math.floor(Number(value) || 0)),
                  }
                : field === 'unit_type'
                  ? { unit_type: value.trim() || null }
                  : {
                      unit_price:
                        value.trim() === ''
                          ? null
                          : (() => {
                              const n = Number(value.trim().replace(/,/g, ''))
                              return Number.isFinite(n) && n >= 0 ? n : null
                            })(),
                    }),
          })
        },
        1000
      ),
    []
  )

  const requestClose = () => {
    if (hasDirty) {
      if (!window.confirm('저장하지 않은 변경사항이 있어요. 닫을까요?')) return
    }
    onClose()
  }

  const saveBasic = async () => {
    const upStr = unitPriceDraft.trim().replace(/,/g, '')
    const upParsed = upStr === '' ? NaN : Number(upStr)
    const unitPriceVal =
      upStr === '' || !Number.isFinite(upParsed) || upParsed < 0 ? null : upParsed
    const { error } = await supabase
      .from('products')
      .update({
        name: nameDraft.trim(),
        retail_price: Math.max(0, Math.floor(Number(priceDraft) || 0)),
        unit_type: unitTypeDraft.trim() || null,
        unit_price: unitPriceVal,
        brand_id: brandId || null,
        description: descDraft.trim() || null,
      })
      .eq('id', product.id)
    if (error) {
      onToast(error.message || '저장 실패')
      return
    }
    mark('basic', false)
    onToast('✅ 기본정보 저장됨')
    onProductUpdated?.({
      ...product,
      name: nameDraft.trim(),
      retail_price: Math.max(0, Math.floor(Number(priceDraft) || 0)),
      unit_type: unitTypeDraft.trim() || null,
      unit_price: unitPriceVal,
      brand_id: brandId || null,
      description: descDraft.trim() || null,
      brands: brands.find(b => b.id === brandId) ? { name: brands.find(b => b.id === brandId)!.name } : product.brands,
    })
  }

  const saveDetail = async () => {
    setDetailSaving(true)
    try {
      const inst = editorRef.current?.getInstance?.()
      const html = inst?.getHTML?.() || ''
      const { error } = await supabase
        .from('products')
        .update({ detail_html: html.trim() || null })
        .eq('id', product.id)

      if (error) {
        onToast(error.message || '저장 실패')
        return
      }

      mark('detail', false)
      onToast('저장되었습니다')
      onProductUpdated?.({ ...product, detail_html: html.trim() || null })
    } finally {
      setDetailSaving(false)
    }
  }

  const savePoints = async () => {
    setPointsSaving(true)
    const { error } = await supabase
      .from('products')
      .update({
        earn_points: Math.max(0, Math.min(100, Math.floor(Number(earnPercent) || 0))),
        earn_points_percent: Math.max(0, Math.min(100, Math.floor(Number(earnPercent) || 0))),
        toast_fixed_amount: Math.max(0, Math.floor(Number(toastFixedAmount) || 0)),
        share_points: Math.max(0, Math.floor(sharePoints)),
        review_points_text: Math.max(0, Math.floor(textReviewPts)),
        review_points_photo: Math.max(0, Math.floor(photoPoints)),
        review_points_video: Math.max(0, Math.floor(videoPoints)),
      })
      .eq('id', product.id)
    setPointsSaving(false)
    if (error) {
      onToast(error.message || '저장 실패')
      return
    }
    mark('points', false)
    onToast('✅ 토스트 설정이 적용되었습니다')
    onProductUpdated?.({
      ...product,
      earn_points: Math.max(0, Math.min(100, Math.floor(Number(earnPercent) || 0))),
      earn_points_percent: Math.max(0, Math.min(100, Math.floor(Number(earnPercent) || 0))),
      toast_fixed_amount: Math.max(0, Math.floor(Number(toastFixedAmount) || 0)),
      share_points: Math.max(0, Math.floor(sharePoints)),
      review_points_text: Math.max(0, Math.floor(textReviewPts)),
      review_points_photo: Math.max(0, Math.floor(photoPoints)),
      review_points_video: Math.max(0, Math.floor(videoPoints)),
    })
  }

  const analyzeIngredients = async () => {
    const text = (product?.key_ingredients || '') + '\n' + (product?.ingredient || '')
    if (!text.trim() && !ingredientImg) {
      onToast('전성분 텍스트나 사진을 먼저 입력해주세요')
      return
    }
    setAiAnalyzing(true)
    try {
      const messages: any[] = []
      if (ingredientImg) {
        const base64 = ingredientImg.split(',')[1]
        const mimeMatch = ingredientImg.match(/data:(.*?);base64/)
        const mediaType = (mimeMatch?.[1] as any) || 'image/jpeg'
        messages.push({
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: text.trim()
                ? `이미지의 전성분표와 아래 텍스트를 함께 분석해줘:\n${text}`
                : '이 전성분표 이미지를 분석해줘.',
            },
          ],
        })
      } else {
        messages.push({
          role: 'user',
          content: text,
        })
      }

      const systemPrompt = `너는 화장품 전성분 분석 전문가야.
전성분표를 보고 아래 JSON 형식으로만 답해줘.
다른 텍스트 없이 JSON만 출력해.

{
  "step_tags": [],
  "func_tags": [],
  "hormone_tags": [],
  "skin_types": [],
  "situation_tags": [],
  "ingredient_tags": [],
  "medical_tags": [],
  "weather_tags": [],
  "age_tag": [],
  "reason": ""
}

선택 가능한 값:
step_tags: 클렌징|토너|앰플·세럼|크림|선케어|마스크·팩|바디케어|헤어케어
func_tags: 보습·수분|탄력·주름|미백·톤업|진정·민감|장벽·재생|모공·피지|아로마·릴렉스|트러블케어|노화케어
hormone_tags: 달빛기|황금기|만개기|물들기|갱년기|남성|전연령
skin_types: 건성|지성|복합성|민감성|중성|모든피부
situation_tags: 여드름·뾰루지|피지·모공|좁쌀|가려움|벌레물림|압출후|시술후|임신·수유중|산후|아토피|10대사춘기|체취케어
ingredient_tags: 비건|크루얼티프리|무향|무색소|천연·유기농|EWG그린|임산부안전|스테로이드프리|파라벤프리|레티놀함유|AHA함유|BHA함유|나이아신아마이드|세라마이드|히알루론산|펩타이드
medical_tags: 아토피|건선|지루성피부염|로사세아|색소침착|흉터케어|보톡스후|필러후|레이저후|박피후|항암중
weather_tags: 자외선높음|자외선매우높음|미세먼지나쁨|황사|건조한날|일교차큼|고온다습|전천후
age_tag: 10대|20대|30대|40대|50대이상|전연령
reason: 태그 선정 이유 한 줄

주의:
- 레티놀 포함 → hormone_tags에 달빛기 제외
- 향료/알코올 포함 → situation_tags에 달빛기 주의 추가
- AHA/BHA → situation_tags에 달빛기 주의 추가
- 임산부 금지 성분 → situation_tags에 임신·수유중 제외

갱년기 hormone_tags 추가 기준:
아래 성분 중 하나라도 포함 시
hormone_tags에 '갱년기' 추가:
이소플라본, 콜라겐 펩타이드,
CoQ10/코엔자임Q10, 레스베라트롤,
비타민E 고함량, 열감 진정 성분,
로즈/장미 추출물, 자스민/재스민 추출물,
네롤리 추출물, 일랑일랑,
클라리세이지, 제라늄,
라벤더 고함량, 달맞이꽃 오일,
블랙커런트 오일
브랜드명 이타카(ITHACA) 또는
르노벨(RENOBELL) 제품이면
hormone_tags에 '갱년기' 자동 추가

남성 hormone_tags·gender_tag 기준:
제품명에 '옴므'/'맨'/'남성' 포함
또는 징크/살리실산 고함량 시
hormone_tags에 '남성' 추가
gender_tag: '남성'

공용 제품:
위 조건 해당 없으면
hormone_tags에 '갱년기'·'남성' 넣지 마
해당 단계 없으면 '전연령' 추가
age_tag 기준:
- 여드름·트러블케어·살리실산·징크 → '10대' 포함
- 탄력·주름·펩타이드·콜라겐 → '40대','50대이상' 포함
- 갱년기 성분(위 기준) → '50대이상' 포함
- 데오도란트·체취케어·situation_tags에 체취케어 → age_tag '50대이상' + gender_tag '남성' or '공용' 검토
- 특정 연령 타겟 없으면 '전연령' 추가`

      const res = await fetch('/api/analyze-ingredients', {
        method: 'POST',
        body: JSON.stringify({
          messages,
          systemPrompt,
        }),
      })
      const data = await res.json()
      const raw = data.content?.map((c: any) => c.text || '').join('')
      const clean = raw.replace(/```json|```/g, '').trim()
      const result = JSON.parse(clean)

      setTagForm((f: any) => ({
        ...f,
        step_tags: result.step_tags?.length ? result.step_tags : f.step_tags,
        func_tags: result.func_tags?.length ? result.func_tags : f.func_tags,
        hormone_tags: result.hormone_tags?.length ? result.hormone_tags : f.hormone_tags,
        skin_types: result.skin_types?.length ? result.skin_types : f.skin_types,
        situation_tags: result.situation_tags?.length ? result.situation_tags : f.situation_tags,
        ingredient_tags: result.ingredient_tags?.length ? result.ingredient_tags : f.ingredient_tags,
        medical_tags: result.medical_tags?.length ? result.medical_tags : f.medical_tags,
        weather_tags: result.weather_tags?.length ? result.weather_tags : f.weather_tags,
        age_tag: result.age_tag?.length ? result.age_tag : f.age_tag,
        ai_tag_status: 'ai_suggested',
        // [AI 초안] owner_analysis → owner_comment 자동 채움 (원장이 이후 수정 가능)
        owner_comment: result.owner_analysis || f.owner_comment,
      }))
      setAiReason(result.reason || '')
      onToast('AI 분석 완료! 태그 확인 후 저장해주세요 ✦')
    } catch {
      onToast('AI 분석 실패. 다시 시도해주세요.')
    } finally {
      setAiAnalyzing(false)
    }
  }

  const saveTagForm = async () => {
    if (!product?.id) return
    const { error } = await supabase
      .from('products')
      .update({
        step_tags: tagForm.step_tags || [],
        func_tags: tagForm.func_tags || [],
        hormone_tags: tagForm.hormone_tags || [],
        weather_tags: tagForm.weather_tags || [],
        season_tags: tagForm.season_tags || [],
        gender_tag: tagForm.gender_tag || '',
        situation_tags: tagForm.situation_tags || [],
        body_part_tags: tagForm.body_part_tags || [],
        lifestyle_tags: tagForm.lifestyle_tags || [],
        timing_tags: tagForm.timing_tags || [],
        event_tags: tagForm.event_tags || [],
        ingredient_tags: tagForm.ingredient_tags || [],
        medical_tags: tagForm.medical_tags || [],
        skin_types: tagForm.skin_types?.length ? tagForm.skin_types : null,
        ai_tag_status: 'approved',
        age_tag: tagForm.age_tag || [],
        // [원장 코멘트] products.owner_comment 컬럼에 저장
        owner_comment: tagForm.owner_comment,
      })
      .eq('id', product.id)
    if (error) {
      onToast('태그 저장 실패: ' + (error.message || ''))
      return
    }
    setTagForm((f: any) => ({ ...f, ai_tag_status: 'approved' }))
    onProductUpdated?.({
      ...product,
      ...tagForm,
      ai_tag_status: 'approved',
    })
    alert('태그 저장됐어요! ✅')
  }

  const applyDefaults = () => {
    setEarnPercent(1)
    setSharePoints(50)
    setTextReviewPts(100)
    setPhotoPoints(300)
    setVideoPoints(500)
    mark('points', true)
  }

  const removeDetailImage = (idx: number) => {
    setDetailImages(arr => arr.filter((_, i) => i !== idx))
    mark('detail', true)
  }

  const exampleEarn = useMemo(() => {
    const p = Math.max(0, Math.floor(Number(priceDraft) || 0))
    const pct = Math.max(0, Math.min(100, Math.floor(Number(earnPercent) || 0)))
    return Math.floor((p * pct) / 100)
  }, [priceDraft, earnPercent])

  return (
    <div
      onClick={requestClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.80)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#181818',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 24,
          padding: 24,
          width: '100%',
          maxWidth: 640,
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 16,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: 12,
          }}
        >
          {(['thumb', 'basic', 'detail', 'points', 'flash', 'tags'] as TabKey[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setModalTab(t)}
              style={{
                background: modalTab === t ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.06)',
                border: modalTab === t ? '1px solid rgba(201,168,76,0.45)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 999,
                padding: '6px 12px',
                color: modalTab === t ? '#c9a84c' : 'rgba(255,255,255,0.65)',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {tabLabel(t, dirty[t])}
            </button>
          ))}
        </div>

        {modalTab === 'thumb' && (
          <div style={{ display: 'grid', gap: 14 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>대표 이미지 (1:1 · 클릭하여 선택)</span>
            <div
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={() => setThumbHover(true)}
              onMouseLeave={() => setThumbHover(false)}
              style={{
                position: 'relative',
                width: 300,
                height: 300,
                borderRadius: 16,
                overflow: 'hidden',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <ProductThumbnail
                src={thumbDisplay}
                alt={product.name || ''}
                fill
                objectFit="cover"
                style={{ borderRadius: 16 }}
              />
              {thumbHover ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                  }}
                >
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>📷 클릭해서 변경</span>
                </div>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              style={{ display: 'none' }}
              onChange={async e => {
                let file = e.target.files?.[0]
                const inputEl = e.target
                inputEl.value = ''
                if (!file) return
                if (file.size > 20 * 1024 * 1024) {
                  onToast('이미지는 20MB, 영상은 50MB 이하만 가능합니다')
                  return
                }
                const preview = URL.createObjectURL(file)
                setThumbPreview(preview)
                setThumbUploading(true)
                const safe = file.name.replace(/[^\w.\-가-힣]/g, '_')
                const path = `thumbnails/${product.id}/${Date.now()}_${safe}`
                file = await compressImage(file, 'product_thumb')
                const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                if (error) {
                  onToast(error.message || '업로드 실패')
                  setThumbUploading(false)
                  return
                }
                const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
                const newUrl = pub.publicUrl
                setThumbUploadedUrl(newUrl)
                const { error: upErr } = await supabase
                  .from('products')
                  .update({ thumb_img: newUrl, storage_thumb_url: newUrl })
                  .eq('id', product.id)
                setThumbUploading(false)
                if (upErr) {
                  onToast(upErr.message || 'DB 저장 실패')
                  return
                }
                mark('thumb', false)
                onToast('✅ 썸네일 저장됨')
                onProductUpdated?.({ ...product, thumb_img: newUrl, storage_thumb_url: newUrl })
              }}
            />
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                추가 미디어 (이미지 최대 5장 · GIF 1개 · 영상 1개, 영상 30초·50MB)
              </span>
              <button
                type="button"
                disabled={galleryBusy}
                onClick={() => extraGalleryInputRef.current?.click()}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: galleryBusy ? 'wait' : 'pointer',
                  opacity: galleryBusy ? 0.65 : 1,
                  justifySelf: 'start',
                }}
              >
                파일 선택 (이미지 / GIF / MP4)
              </button>
              <input
                ref={extraGalleryInputRef}
                type="file"
                accept="image/*,image/gif,video/mp4"
                multiple
                className="hidden"
                style={{ display: 'none' }}
                onChange={async e => {
                  const files = Array.from(e.target.files || [])
                  const inputEl = e.target
                  inputEl.value = ''
                  if (!files.length) return
                  setGalleryBusy(true)
                  const IMG_MAX = 20 * 1024 * 1024
                  const VID_MAX = 50 * 1024 * 1024
                  let imgs = [...galleryImgUrls]
                  let gif = galleryGifUrl
                  let vid = galleryVideoUrl
                  let anyOk = false
                  for (let file of files) {
                    const isVid = file.type.startsWith('video/') || /\.mp4$/i.test(file.name)
                    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name)
                    if (isVid) {
                      if (file.size > VID_MAX) {
                        onToast('이미지는 20MB, 영상은 50MB 이하만 가능합니다')
                        continue
                      }
                      let dur = 0
                      try {
                        dur = await new Promise<number>((resolve, reject) => {
                          const el = document.createElement('video')
                          el.preload = 'metadata'
                          el.onloadedmetadata = () => {
                            const d = el.duration
                            URL.revokeObjectURL(el.src)
                            resolve(Number.isFinite(d) ? d : 0)
                          }
                          el.onerror = () => {
                            URL.revokeObjectURL(el.src)
                            reject(new Error('meta'))
                          }
                          el.src = URL.createObjectURL(file)
                        })
                      } catch {
                        onToast('영상을 불러오지 못했습니다')
                        continue
                      }
                      if (dur > 30) {
                        onToast('영상은 30초 이내만 등록 가능합니다')
                        continue
                      }
                      const path = `thumbnails/${encodeURIComponent(product.id)}/${Date.now()}.mp4`
                      const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                      if (error) {
                        onToast(error.message || '업로드 실패')
                        continue
                      }
                      const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
                      vid = pub.publicUrl
                      const tArr = [...imgs, ...(gif ? [gif] : [])]
                      const { error: upErr } = await supabase
                        .from('products')
                        .update({ thumb_images: tArr, video_url: vid })
                        .eq('id', product.id)
                      if (upErr) {
                        onToast(upErr.message || 'DB 저장 실패')
                        continue
                      }
                      anyOk = true
                      onProductUpdated?.({ ...product, thumb_images: tArr, video_url: vid })
                      continue
                    }
                    if (isGif) {
                      if (file.size > IMG_MAX) {
                        onToast('이미지는 20MB, 영상은 50MB 이하만 가능합니다')
                        continue
                      }
                      if (gif) {
                        onToast('GIF는 1개만 등록할 수 있습니다')
                        continue
                      }
                      const safe = file.name.replace(/[^\w.\-가-힣]/g, '_')
                      const path = `thumbnails/${product.id}/${Date.now()}_${safe}`
                      file = await compressImage(file, 'product_detail')
                      const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                      if (error) {
                        onToast(error.message || '업로드 실패')
                        continue
                      }
                      const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
                      gif = pub.publicUrl
                      const tArr = [...imgs, gif]
                      const { error: upErr } = await supabase
                        .from('products')
                        .update({ thumb_images: tArr, video_url: vid || null })
                        .eq('id', product.id)
                      if (upErr) {
                        onToast(upErr.message || 'DB 저장 실패')
                        continue
                      }
                      anyOk = true
                      onProductUpdated?.({ ...product, thumb_images: tArr, video_url: vid || null })
                      continue
                    }
                    if (file.size > IMG_MAX) {
                      onToast('이미지는 20MB, 영상은 50MB 이하만 가능합니다')
                      continue
                    }
                    if (imgs.length >= 5) {
                      onToast('추가 이미지는 최대 5장입니다')
                      continue
                    }
                    const safe = file.name.replace(/[^\w.\-가-힣]/g, '_')
                    const path = `thumbnails/${product.id}/${Date.now()}_${safe}`
                    file = await compressImage(file, 'product_detail')
                    const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                    if (error) {
                      onToast(error.message || '업로드 실패')
                      continue
                    }
                    const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
                    imgs = [...imgs, pub.publicUrl]
                    const tArr = [...imgs, ...(gif ? [gif] : [])]
                    const { error: upErr } = await supabase
                      .from('products')
                      .update({ thumb_images: tArr, video_url: vid || null })
                      .eq('id', product.id)
                    if (upErr) {
                      onToast(upErr.message || 'DB 저장 실패')
                      continue
                    }
                    anyOk = true
                    onProductUpdated?.({ ...product, thumb_images: tArr, video_url: vid || null })
                  }
                  setGalleryImgUrls(imgs)
                  setGalleryGifUrl(gif)
                  setGalleryVideoUrl(vid)
                  setGalleryBusy(false)
                  if (anyOk) {
                    mark('thumb', false)
                    onToast('✅ 추가 미디어 반영됨')
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
              {galleryImgUrls.map((u, i) => (
                <div
                  key={`${u}-${i}`}
                  style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const next = galleryImgUrls.filter((_, j) => j !== i)
                        const tArr = [...next, ...(galleryGifUrl ? [galleryGifUrl] : [])]
                        setGalleryImgUrls(next)
                        setGalleryBusy(true)
                        const { error } = await supabase
                          .from('products')
                          .update({ thumb_images: tArr, video_url: galleryVideoUrl || null })
                          .eq('id', product.id)
                        setGalleryBusy(false)
                        if (error) {
                          onToast(error.message || '저장 실패')
                          setGalleryImgUrls(galleryImgUrls)
                          return
                        }
                        mark('thumb', false)
                        onProductUpdated?.({ ...product, thumb_images: tArr, video_url: galleryVideoUrl || null })
                        onToast('✅ 삭제 반영됨')
                      })()
                    }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: 'none',
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
              {galleryGifUrl ? (
                <div
                  style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={galleryGifUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const tArr = [...galleryImgUrls]
                        setGalleryGifUrl(null)
                        setGalleryBusy(true)
                        const { error } = await supabase
                          .from('products')
                          .update({ thumb_images: tArr, video_url: galleryVideoUrl || null })
                          .eq('id', product.id)
                        setGalleryBusy(false)
                        if (error) {
                          onToast(error.message || '저장 실패')
                          setGalleryGifUrl(galleryGifUrl)
                          return
                        }
                        mark('thumb', false)
                        onProductUpdated?.({ ...product, thumb_images: tArr, video_url: galleryVideoUrl || null })
                        onToast('✅ 삭제 반영됨')
                      })()
                    }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: 'none',
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
              ) : null}
              {galleryVideoUrl ? (
                <div
                  style={{ position: 'relative', width: 72, height: 72, borderRadius: 8, overflow: 'hidden' }}
                >
                  <video
                    src={galleryVideoUrl}
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void (async () => {
                        const tArr = [...galleryImgUrls, ...(galleryGifUrl ? [galleryGifUrl] : [])]
                        setGalleryVideoUrl(null)
                        setGalleryBusy(true)
                        const { error } = await supabase
                          .from('products')
                          .update({ thumb_images: tArr, video_url: null })
                          .eq('id', product.id)
                        setGalleryBusy(false)
                        if (error) {
                          onToast(error.message || '저장 실패')
                          setGalleryVideoUrl(galleryVideoUrl)
                          return
                        }
                        mark('thumb', false)
                        onProductUpdated?.({ ...product, thumb_images: tArr, video_url: null })
                        onToast('✅ 삭제 반영됨')
                      })()
                    }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: 'none',
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
              ) : null}
            </div>
            {thumbUploading || galleryBusy ? (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>업로드/처리 중...</div>
            ) : null}
          </div>
        )}

        {modalTab === 'basic' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>제품명</span>
              <input
                value={nameDraft}
                onChange={e => {
                  const v = e.target.value
                  setNameDraft(v)
                  mark('basic', true)
                  debouncedSaveNamePrice('name', v)
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>가격(원)</span>
              <input
                value={priceDraft}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9]/g, '')
                  setPriceDraft(v)
                  mark('basic', true)
                  debouncedSaveNamePrice('retail_price', v)
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                  boxSizing: 'border-box',
                }}
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
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>단위가격</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>기준</span>
                  <select
                    value={unitTypeDraft}
                    onChange={e => {
                      const v = e.target.value
                      setUnitTypeDraft(v)
                      mark('basic', true)
                      debouncedSaveNamePrice('unit_type', v)
                    }}
                    style={{
                      width: '100%',
                      background: '#121212',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: 13,
                    }}
                  >
                    <option value="" style={{ background: '#1a1a1a' }}>
                      — 선택 —
                    </option>
                    {(['ml당', 'g당', '100ml당', '100g당', '1개당'] as const).map(o => (
                      <option key={o} value={o} style={{ background: '#1a1a1a' }}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>가격 (원)</span>
                  <input
                    value={unitPriceDraft}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9.]/g, '')
                      setUnitPriceDraft(v)
                      mark('basic', true)
                      debouncedSaveNamePrice('unit_price', v)
                    }}
                    placeholder="예: 1250"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      color: '#fff',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </label>
              </div>
            </div>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>브랜드</span>
              <select
                value={brandId}
                onChange={e => {
                  setBrandId(e.target.value)
                  mark('basic', true)
                }}
                style={{
                  width: '100%',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                }}
              >
                <option value="">— 선택 —</option>
                {brands.map(b => (
                  <option key={b.id} value={b.id} style={{ background: '#1a1a1a' }}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>한줄 설명</span>
              <textarea
                value={descDraft}
                onChange={e => {
                  setDescDraft(e.target.value)
                  mark('basic', true)
                }}
                rows={4}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  color: '#fff',
                  fontSize: 13,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void saveBasic()}
              style={{
                background: 'rgba(201,168,76,0.2)',
                border: '1px solid rgba(201,168,76,0.45)',
                borderRadius: 10,
                padding: '12px 0',
                color: '#c9a84c',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              기본정보 저장
            </button>
          </div>
        )}

        {modalTab === 'detail' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ width: '100%', overflowX: 'hidden' }}>
              <div style={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
                <Editor
                  key={product.id}
                  ref={editorRef}
                  initialValue={detailContent || ''}
                  initialEditType="wysiwyg"
                  hideModeSwitch
                  height="400px"
                  language="ko-KR"
                  toolbarItems={[
                    ['heading', 'bold', 'italic'],
                    ['hr', 'image'],
                    ['ul', 'ol'],
                  ]}
                  hooks={{
                    addImageBlobHook: async (blob: any, callback: (url: string, alt: string) => void) => {
                      let file = blob
                      const ext = file?.name?.split?.('.')?.pop?.() || 'jpg'
                      const productId = product.id
                      const path = `detail/${productId}/${Date.now()}.${ext}`
                      file = await compressImage(file, 'product_detail')
                      const { error: upErr } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                      if (upErr) {
                        onToast(upErr.message || '이미지 업로드 실패')
                        return
                      }
                      const {
                        data: { publicUrl },
                      } = supabase.storage.from('products').getPublicUrl(path)
                      callback(publicUrl, '상세이미지')
                    },
                  }}
                  onChange={() => mark('detail', true)}
                />
              </div>
            </div>

            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 8 }}>호르몬 주기별 케어 타이밍</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8, lineHeight: 1.5 }}>
                JSON 형식 예){' '}
                {`{"menstrual":{"tip":"자극 없이 진정에 집중해요","recommend":"얇게 여러 번 레이어링"},"follicular":{"tip":"영양 흡수가 잘 되는 준비 기간이에요","recommend":"아침저녁 규칙적으로"},"ovulation":{"tip":"지금 쓰면 효과가 드라마틱해요","recommend":"평소보다 2겹 덧발라 보호"},"luteal":{"tip":"예비 트러블을 미리 잡아줘요","recommend":"저녁 루틴에 집중 도포"}}`}
              </div>
              <textarea
                value={hormoneDraft}
                onChange={(e) => setHormoneDraft(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 12,
                  resize: 'vertical' as const,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  disabled={hormoneSaving}
                  onClick={() => {
                    void (async () => {
                      setHormoneSaving(true)
                      const { error } = await supabase
                        .from('products')
                        .update({ hormone_timing: hormoneDraft })
                        .eq('id', product.id)
                      setHormoneSaving(false)
                      if (error) {
                        onToast('저장 실패: ' + error.message)
                        return
                      }
                      onToast('✅ 호르몬 타이밍 저장됨')
                      onProductUpdated?.({ ...product, hormone_timing: hormoneDraft })
                    })()
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(201,168,76,0.2)',
                    border: '1px solid rgba(201,168,76,0.45)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: '#c9a84c',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: hormoneSaving ? 0.6 : 1,
                  }}
                >
                  {hormoneSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={hormoneSaving}
                  onClick={() => setHormoneDraft(String(productRef.current.hormone_timing ?? ''))}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: hormoneSaving ? 0.6 : 1,
                  }}
                >
                  취소
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>주요 성분 (KEY INGREDIENTS)</div>
              <textarea
                value={keyIngredientsDraft}
                onChange={e => setKeyIngredientsDraft(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 12,
                  resize: 'vertical' as const,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  disabled={keyIngredientsSaving}
                  onClick={() => {
                    void (async () => {
                      setKeyIngredientsSaving(true)
                      const { error } = await supabase.from('products').update({ key_ingredients: keyIngredientsDraft }).eq('id', product.id)
                      setKeyIngredientsSaving(false)
                      if (error) {
                        onToast('저장 실패: ' + error.message)
                        return
                      }
                      onToast('✅ 주요 성분 저장됨')
                      onProductUpdated?.({ ...product, key_ingredients: keyIngredientsDraft })
                    })()
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(201,168,76,0.2)',
                    border: '1px solid rgba(201,168,76,0.45)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: '#c9a84c',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: keyIngredientsSaving ? 0.6 : 1,
                  }}
                >
                  {keyIngredientsSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={keyIngredientsSaving}
                  onClick={() => setKeyIngredientsDraft(String(productRef.current.key_ingredients ?? ''))}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: keyIngredientsSaving ? 0.6 : 1,
                  }}
                >
                  취소
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 8 }}>임상 결과 (CLINICAL RESULT)</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8, lineHeight: 1.5 }}>
                라벨 숫자% 형식, 줄바꿈 구분 예) 피부 수분도 개선 94%
              </div>
              <textarea
                value={clinicalResultDraft}
                onChange={e => setClinicalResultDraft(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 12,
                  resize: 'vertical' as const,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  disabled={clinicalResultSaving}
                  onClick={() => {
                    void (async () => {
                      setClinicalResultSaving(true)
                      const { error } = await supabase.from('products').update({ clinical_result: clinicalResultDraft }).eq('id', product.id)
                      setClinicalResultSaving(false)
                      if (error) {
                        onToast('저장 실패: ' + error.message)
                        return
                      }
                      onToast('✅ 임상 결과 저장됨')
                      onProductUpdated?.({ ...product, clinical_result: clinicalResultDraft })
                    })()
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(201,168,76,0.2)',
                    border: '1px solid rgba(201,168,76,0.45)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: '#c9a84c',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: clinicalResultSaving ? 0.6 : 1,
                  }}
                >
                  {clinicalResultSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={clinicalResultSaving}
                  onClick={() => setClinicalResultDraft(String(productRef.current.clinical_result ?? ''))}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: clinicalResultSaving ? 0.6 : 1,
                  }}
                >
                  취소
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.03)', position: 'relative' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>같이 쓰면 좋아요 (PERFECT TOGETHER)</div>
              <input
                value={ptQuery}
                onChange={e => {
                  setPtQuery(e.target.value)
                  setPtPickOpen(true)
                }}
                onFocus={() => setPtPickOpen(true)}
                placeholder="제품명 검색"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              />
              {ptPickOpen && ptResults.length > 0 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    zIndex: 20,
                    marginTop: 4,
                    maxHeight: 200,
                    overflowY: 'auto',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  {ptResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPtPicks(prev => (prev.some(x => x.id === p.id) ? prev : [...prev, { id: p.id, name: p.name }]))
                        setPtPickOpen(false)
                        setPtQuery('')
                        setPtResults([])
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: 'transparent',
                        color: '#e8e4dc',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {ptPicks.map(({ id, name }) => (
                  <span
                    key={id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: 'rgba(201,168,76,0.12)',
                      border: '1px solid rgba(201,168,76,0.35)',
                      fontSize: 11,
                      color: '#c9a84c',
                    }}
                  >
                    <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
                      {name}
                    </span>
                    <button
                      type="button"
                      aria-label="제거"
                      onClick={() => setPtPicks(prev => prev.filter(x => x.id !== id))}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#c9a84c',
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  disabled={ptSaving}
                  onClick={() => {
                    void (async () => {
                      setPtSaving(true)
                      const { error } = await supabase.from('products').update({ perfect_together: ptPicks.map(x => x.id) }).eq('id', product.id)
                      setPtSaving(false)
                      if (error) {
                        onToast('저장 실패: ' + error.message)
                        return
                      }
                      onToast('✅ 같이 쓰면 좋아요 저장됨')
                      onProductUpdated?.({ ...product, perfect_together: ptPicks.map(x => x.id) })
                    })()
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(201,168,76,0.2)',
                    border: '1px solid rgba(201,168,76,0.45)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: '#c9a84c',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: ptSaving ? 0.6 : 1,
                  }}
                >
                  {ptSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={ptSaving}
                  onClick={() => {
                    setPtPicks([])
                    void (async () => {
                      const raw = productRef.current.perfect_together
                      const ids = Array.isArray(raw)
                        ? (raw as unknown[]).map((x) => String(x).trim()).filter(Boolean)
                        : []
                      if (ids.length === 0) return
                      const { data, error } = await supabase.from('products').select('id, name').in('id', ids)
                      if (error || !data) {
                        setPtPicks(ids.map((id) => ({ id, name: id })))
                        return
                      }
                      const byId = new Map((data as { id: string; name: string }[]).map((r) => [r.id, r.name]))
                      setPtPicks(ids.map((id) => ({ id, name: String(byId.get(id) || id) })))
                    })()
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: ptSaving ? 0.6 : 1,
                  }}
                >
                  취소
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 8 }}>공유 카피포인트</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 8, lineHeight: 1.5 }}>
                한 줄에 하나씩 입력하면 배열로 저장돼요.
              </div>
              <textarea
                value={shareCopyPointsDraft}
                onChange={(e) => setShareCopyPointsDraft(e.target.value)}
                rows={5}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 12,
                  resize: 'vertical' as const,
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  disabled={shareCopyPointsSaving}
                  onClick={() => {
                    void (async () => {
                      setShareCopyPointsSaving(true)
                      const lines = shareCopyPointsDraft
                        .split(/\r?\n/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                      const { error } = await supabase.from('products').update({ share_copy_points: lines }).eq('id', product.id)
                      setShareCopyPointsSaving(false)
                      if (error) {
                        onToast('저장 실패: ' + error.message)
                        return
                      }
                      onToast('✅ 공유 카피포인트 저장됨')
                      onProductUpdated?.({ ...product, share_copy_points: lines })
                    })()
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(201,168,76,0.2)',
                    border: '1px solid rgba(201,168,76,0.45)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: '#c9a84c',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: shareCopyPointsSaving ? 0.6 : 1,
                  }}
                >
                  {shareCopyPointsSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  disabled={shareCopyPointsSaving}
                  onClick={() =>
                    setShareCopyPointsDraft(
                      Array.isArray(productRef.current.share_copy_points)
                        ? (productRef.current.share_copy_points as unknown[]).map((x) => String(x)).join('\n')
                        : ''
                    )
                  }
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '12px 0',
                    color: 'rgba(255,255,255,0.75)',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    opacity: shareCopyPointsSaving ? 0.6 : 1,
                  }}
                >
                  취소
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={detailSaving}
              onClick={() => void saveDetail()}
              style={{
                background: 'rgba(201,168,76,0.2)',
                border: '1px solid rgba(201,168,76,0.45)',
                borderRadius: 10,
                padding: '12px 0',
                color: '#c9a84c',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                opacity: detailSaving ? 0.6 : 1,
              }}
            >
              {detailSaving ? '저장 중...' : '상세내용 저장'}
            </button>
          </div>
        )}

        {modalTab === 'points' && (
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              padding: 16,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 14 }}>🍞 토스트 설정</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
              브랜드 기본값: {brands.find((x) => x.id === brandId)?.default_earn_points ?? 0}% (미입력시 자동 적용)
            </div>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              구매 적립 토스트 — 구매금액의{' '}
              <input
                type="number"
                min={0}
                max={100}
                value={earnPercent}
                placeholder="0"
                onChange={e => {
                  const v = e.target.value
                  setEarnPercent(v === '' ? '' : Number(v))
                  mark('points', true)
                }}
                style={{
                  width: 48,
                  margin: '0 4px',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: '#fff',
                  fontSize: 13,
                }}
              />{' '}
              %
            </label>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>
              예) ₩{Math.max(0, Math.floor(Number(priceDraft) || 0)).toLocaleString()} 구매 시 약 {exampleEarn.toLocaleString()}T 적립
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              고정 토스트 (타임세일·공구 전용)
              <input
                type="number"
                min={0}
                step={1}
                value={toastFixedAmount}
                onChange={e => {
                  setToastFixedAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  mark('points', true)
                }}
                style={{
                  width: 72,
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: '#fff',
                  fontSize: 13,
                }}
              />{' '}
              T
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              공유 토스트 (표시용)
              <input
                type="number"
                min={0}
                value={sharePoints}
                onChange={e => {
                  setSharePoints(Number(e.target.value))
                  mark('points', true)
                }}
                style={{
                  width: 72,
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: '#fff',
                  fontSize: 13,
                }}
              />{' '}
              T
            </label>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 8 }}>리뷰 토스트</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              텍스트 리뷰
              <input
                type="number"
                min={0}
                value={textReviewPts}
                onChange={e => {
                  setTextReviewPts(Number(e.target.value))
                  mark('points', true)
                }}
                style={{
                  width: 72,
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: '#fff',
                  fontSize: 13,
                }}
              />{' '}
              T
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              📷 포토 리뷰
              <input
                type="number"
                min={0}
                value={photoPoints}
                onChange={e => {
                  setPhotoPoints(Number(e.target.value))
                  mark('points', true)
                }}
                style={{
                  width: 72,
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: '#fff',
                  fontSize: 13,
                }}
              />{' '}
              T
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              🎬 영상 리뷰
              <input
                type="number"
                min={0}
                value={videoPoints}
                onChange={e => {
                  setVideoPoints(Number(e.target.value))
                  mark('points', true)
                }}
                style={{
                  width: 72,
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8,
                  padding: '4px 6px',
                  color: '#fff',
                  fontSize: 13,
                }}
              />{' '}
              T
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={applyDefaults}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 0',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                기본값 적용
              </button>
              <button
                type="button"
                disabled={pointsSaving}
                onClick={() => void savePoints()}
                style={{
                  flex: 1,
                  background: 'rgba(201,168,76,0.2)',
                  border: '1px solid rgba(201,168,76,0.45)',
                  borderRadius: 10,
                  padding: '10px 0',
                  color: '#c9a84c',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                  opacity: pointsSaving ? 0.6 : 1,
                }}
              >
                {pointsSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {modalTab === 'flash' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: '#fff', fontWeight: 900, marginBottom: 10 }}>타임세일 설정</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: '#fff' }}>
              <input
                type="checkbox"
                checked={isFlashSale}
                onChange={e => {
                  setIsFlashSale(e.target.checked)
                  mark('flash', true)
                }}
              />
              타임세일 적용
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12, color: '#fff' }}>
              <input
                type="checkbox"
                checked={isGroupBuy}
                disabled={groupbuySaving}
                onChange={async e => {
                  const next = e.target.checked
                  setGroupbuySaving(true)
                  const { error } = await supabase.from('products').update({ is_groupbuy: next }).eq('id', product.id)
                  setGroupbuySaving(false)
                  if (error) {
                    onToast('공구 표시 저장 실패: ' + error.message)
                    return
                  }
                  setIsGroupBuy(next)
                  onProductUpdated?.({ ...product, is_groupbuy: next })
                }}
              />
              상품 공동구매 표시
            </label>
            {isFlashSale && (
              <div style={{ display: 'grid', gap: 8 }}>
                <input
                  value={flashSalePrice}
                  onChange={e => {
                    setFlashSalePrice(e.target.value.replace(/[^0-9]/g, ''))
                    mark('flash', true)
                  }}
                  placeholder="세일가(원)"
                  style={{
                    width: '100%',
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
                <input
                  type="datetime-local"
                  value={flashSaleStart}
                  onChange={e => {
                    setFlashSaleStart(e.target.value)
                    mark('flash', true)
                  }}
                  style={{
                    width: '100%',
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
                <input
                  type="datetime-local"
                  value={flashSaleEnd}
                  onChange={e => {
                    setFlashSaleEnd(e.target.value)
                    mark('flash', true)
                  }}
                  style={{
                    width: '100%',
                    background: '#121212',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={timesaleSaving}
                onClick={async () => {
                  if (!isFlashSale) {
                    onToast('타임세일 적용을 켜주세요')
                    return
                  }
                  const salePrice = Math.max(0, Math.floor(Number(flashSalePrice || 0)))
                  const timesaleStart = flashSaleStart ? new Date(flashSaleStart).toISOString() : null
                  const timesaleEnd = flashSaleEnd ? new Date(flashSaleEnd).toISOString() : null
                  setTimesaleSaving(true)
                  const { error } = await supabase
                    .from('products')
                    .update({
                      is_timesale: true,
                      sale_price: salePrice,
                      timesale_starts_at: timesaleStart,
                      timesale_ends_at: timesaleEnd,
                    })
                    .eq('id', product.id)
                  setTimesaleSaving(false)
                  if (error) {
                    onToast('저장 실패: ' + error.message)
                    return
                  }
                  onToast('✅ 타임세일 설정됨 — 홈에 즉시 노출')
                  onProductUpdated?.({
                    ...product,
                    is_timesale: true,
                    sale_price: salePrice,
                    timesale_starts_at: timesaleStart,
                    timesale_ends_at: timesaleEnd,
                  })
                  mark('flash', false)
                }}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: 'rgba(201,168,76,0.15)',
                  border: '1px solid rgba(201,168,76,0.35)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  color: '#c9a84c',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: timesaleSaving ? 0.6 : 1,
                }}
              >
                {timesaleSaving ? '저장 중…' : '타임세일 저장'}
              </button>
              <button
                type="button"
                disabled={timesaleSaving}
                onClick={async () => {
                  setTimesaleSaving(true)
                  const { error } = await supabase
                    .from('products')
                    .update({
                      is_timesale: false,
                      sale_price: null,
                      timesale_starts_at: null,
                      timesale_ends_at: null,
                    })
                    .eq('id', product.id)
                  setTimesaleSaving(false)
                  if (error) {
                    onToast('저장 실패: ' + error.message)
                    return
                  }
                  onToast('✅ 타임세일 해제됨')
                  setIsFlashSale(false)
                  setFlashSalePrice('')
                  setFlashSaleStart('')
                  setFlashSaleEnd('')
                  onProductUpdated?.({
                    ...product,
                    is_timesale: false,
                    sale_price: null,
                    timesale_starts_at: null,
                    timesale_ends_at: null,
                  })
                  mark('flash', false)
                }}
                style={{
                  flex: 1,
                  minWidth: 120,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: timesaleSaving ? 0.6 : 1,
                }}
              >
                해제
              </button>
            </div>
          </div>
        )}

        {modalTab === 'tags' && (
          <div style={{ padding: '16px 0 40px' }}>
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
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 8,
                    }}
                  >
                    전성분 사진 업로드 (선택)
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <label
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 11,
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.5)',
                        border: '0.5px solid rgba(255,255,255,0.15)',
                        fontFamily: 'inherit',
                      }}
                    >
                      사진 선택
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = ev => {
                            const img = new Image()
                            img.onload = () => {
                              const canvas =
                                document.createElement('canvas')
                              const MAX = 1200
                              let w = img.width
                              let h = img.height
                              if (w > MAX || h > MAX) {
                                if (w > h) {
                                  h = Math.round(h * MAX / w)
                                  w = MAX
                                } else {
                                  w = Math.round(w * MAX / h)
                                  h = MAX
                                }
                              }
                              canvas.width = w
                              canvas.height = h
                              const ctx = canvas.getContext('2d')
                              ctx?.drawImage(img, 0, 0, w, h)
                              setIngredientImg(
                                canvas.toDataURL('image/jpeg', 0.8)
                              )
                            }
                            img.src = ev.target?.result as string
                          }
                          reader.readAsDataURL(file)
                        }}
                      />
                    </label>
                    {ingredientImg && (
                      <span
                        style={{
                          fontSize: 11,
                          color: '#5adb8a',
                        }}
                      >
                        사진 업로드됨 ✓
                      </span>
                    )}
                    {ingredientImg && (
                      <button
                        type="button"
                        onClick={() => setIngredientImg(null)}
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.3)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={aiAnalyzing}
                    onClick={() => void analyzeIngredients()}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: aiAnalyzing ? 'not-allowed' : 'pointer',
                      border: '1px solid rgba(123,94,167,0.4)',
                      fontFamily: 'inherit',
                      background: aiAnalyzing ? 'rgba(123,94,167,0.2)' : '#3a2060',
                      color: aiAnalyzing ? 'rgba(255,255,255,0.3)' : '#c4a8ff',
                    }}
                  >
                    {aiAnalyzing ? 'AI 분석 중...' : '✦ AI 전성분 분석 · 태그 자동 제안'}
                  </button>
                  {/* ===== [원장 코멘트 입력창] ===== */}
                  {/* AI owner_analysis 자동채움 → 원장 직접 수정 → owner_comment 컬럼 저장 */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                      원장 코멘트 (AI 초안 자동입력 · 직접 수정 가능)
                    </div>
                    <textarea
                      value={tagForm.owner_comment || ''}
                      onChange={e => setTagForm((f: any) => ({
                        ...f,
                        // [원장 코멘트] 직접 수정 시 반영
                        owner_comment: e.target.value
                      }))}
                      placeholder="맑원장 코멘트를 입력해주세요 (AI 분석 후 자동으로 채워져요)"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: 12,
                        border: '1px solid rgba(123,94,167,0.4)',
                        background: 'rgba(123,94,167,0.1)',
                        color: '#fff',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                  {aiReason && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '8px 10px',
                        background: 'rgba(123,94,167,0.1)',
                        borderRadius: 8,
                        fontSize: 11,
                        color: '#c4a8ff',
                        borderLeft: '2px solid #7B5EA7',
                      }}
                    >
                      {aiReason}
                    </div>
                  )}
                </div>
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['pending', 'ai_suggested', 'needs_review', 'approved'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTagForm((f: any) => ({ ...f, ai_tag_status: s }))}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 10,
                          fontSize: 11,
                          cursor: 'pointer',
                          border: 'none',
                          fontFamily: 'inherit',
                          background: tagForm.ai_tag_status === s ? '#7B5EA7' : 'rgba(255,255,255,0.08)',
                          color: tagForm.ai_tag_status === s ? '#fff' : 'rgba(255,255,255,0.4)',
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
                    key: 'step_tags',
                    options: ['클렌징', '토너', '앰플·세럼', '크림', '선케어', '마스크·팩', '바디케어', '헤어케어'],
                  },
                  {
                    label: '기능',
                    key: 'func_tags',
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
                    key: 'hormone_tags',
                    options: ['달빛기', '황금기', '만개기', '물들기', '갱년기', '남성', '전연령'],
                  },
                  {
                    label: '피부타입',
                    key: 'skin_types',
                    options: ['건성', '지성', '복합성', '민감성', '중성', '모든피부'],
                  },
                  {
                    label: '연령대',
                    key: 'age_tag',
                    options: ['10대', '20대', '30대', '40대', '50대이상', '전연령'],
                  },
                  {
                    label: '날씨',
                    key: 'weather_tags',
                    options: ['자외선높음', '자외선매우높음', '미세먼지나쁨', '황사', '건조한날', '일교차큼', '고온다습', '전천후'],
                  },
                  {
                    label: '계절',
                    key: 'season_tags',
                    options: ['봄', '여름', '가을', '겨울', '전계절'],
                  },
                  { label: '성별', key: 'gender_tag', options: ['여성', '남성', '공용'], single: true },
                  {
                    label: '상황',
                    key: 'situation_tags',
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
                    key: 'body_part_tags',
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
                    key: 'event_tags',
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
                    key: 'ingredient_tags',
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
                    key: 'medical_tags',
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
                        const val = (tagForm as any)[key]
                        const isSelected = single ? val === opt : Array.isArray(val) && val.includes(opt)
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              if (single) {
                                setTagForm((f: any) => ({
                                  ...f,
                                  [key]: isSelected ? '' : opt,
                                }))
                              } else {
                                setTagForm((f: any) => ({
                                  ...f,
                                  [key]: isSelected
                                    ? (f[key] || []).filter((v: string) => v !== opt)
                                    : [...(f[key] || []), opt],
                                }))
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
                  onClick={() => void saveTagForm()}
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

        {modalTab === 'thumb' && (
          <div style={{ marginTop: 14, marginBottom: -4 }}>
            <button
              type="button"
              onClick={async () => {
                const rep = thumbUploadedUrl || product.thumb_img || product.storage_thumb_url || null
                const imgs = [...galleryImgUrls, ...(galleryGifUrl ? [galleryGifUrl] : [])]
                const vid = galleryVideoUrl || null

                const { error } = await supabase
                  .from('products')
                  .update({
                    thumb_img: rep,
                    storage_thumb_url: rep,
                    thumb_images: imgs,
                    video_url: vid,
                  })
                  .eq('id', product.id)

                if (error) {
                  onToast('썸네일 저장 실패: ' + (error.message || '알 수 없는 오류'))
                  return
                }

                setThumbUploadedUrl(null)
                setThumbPreview(null)
                mark('thumb', false)
                onToast('저장되었습니다')
                onProductUpdated?.({
                  ...product,
                  thumb_img: rep,
                  storage_thumb_url: rep,
                  thumb_images: imgs,
                  video_url: vid,
                })
              }}
              style={{
                width: '100%',
                background: 'var(--gold, #c9a84c)',
                border: 'none',
                borderRadius: 12,
                padding: '13px 0',
                color: '#000',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              썸네일 저장
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={requestClose}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.07)',
              border: 'none',
              borderRadius: 12,
              padding: '13px 0',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
          {!hideApprovalFooter && listTab === 'pending' && (
            <>
              <button
                onClick={() => void onReject(product.id)}
                disabled={busyId === product.id}
                style={{
                  flex: 1,
                  background: 'rgba(229,57,53,0.15)',
                  border: '1px solid rgba(229,57,53,0.4)',
                  borderRadius: 12,
                  padding: '13px 0',
                  color: '#e57373',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                거절
              </button>
              <button
                onClick={() => void onApprove(product.id)}
                disabled={busyId === product.id}
                style={{
                  flex: 1,
                  background: 'var(--gold, #c9a84c)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '13px 0',
                  color: '#000',
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                승인
              </button>
            </>
          )}
          {!hideApprovalFooter && listTab === 'rejected' && (
            <button
              onClick={() => void onApprove(product.id)}
              disabled={busyId === product.id}
              style={{
                flex: 2,
                background: 'var(--gold, #c9a84c)',
                border: 'none',
                borderRadius: 12,
                padding: '13px 0',
                color: '#000',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              다시 승인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
