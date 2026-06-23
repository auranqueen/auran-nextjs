'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { uploadToStorage, uploadVideoToStorage, insertNewProduct, updateProduct } from '@/lib/product/productFormUtils'

export default function ProductEditFormV2({ id: idProp }: { id?: string }) {
  const supabase = createClient()
  const router = useRouter()
  const editId = idProp || null
  const workingIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(!!editId)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [tmpSavedAt, setTmpSavedAt] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [keywords, setKeywords] = useState('')
  const [brandId, setBrandId] = useState('')
  const [brands, setBrands] = useState<any[]>([])
  const [origin, setOrigin] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [isFlashSale, setIsFlashSale] = useState(false)
  const [isGroupbuy, setIsGroupbuy] = useState(false)
  const [isExclusive, setIsExclusive] = useState(false)

  const [retailPrice, setRetailPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [unitType, setUnitType] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [stockInput, setStockInput] = useState('')
  const [avgUsageDays, setAvgUsageDays] = useState('')
  const [shipFee, setShipFee] = useState('')
  const [shipMemo, setShipMemo] = useState('')

  const [earnPointsPercent, setEarnPointsPercent] = useState('')
  const [shareVal, setShareVal] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [reviewPhoto, setReviewPhoto] = useState('')
  const [reviewVideo, setReviewVideo] = useState('')

  const [thumbImages, setThumbImages] = useState<(string | null)[]>([null, null, null, null, null])
  const [videoUrl, setVideoUrl] = useState('')
  const [detailImages, setDetailImages] = useState<string[]>([])
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null])
  const videoRef = useRef<HTMLInputElement | null>(null)
  const detailFileRef = useRef<HTMLInputElement | null>(null)

  const [detailContent, setDetailContent] = useState('')

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
  const [isTimesale, setIsTimesale] = useState(false)

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
      setManufacturer(data.ingredient || '')
      setRetailPrice(String(data.retail_price || ''))
      setSalePrice(String(data.sale_price || ''))
      setUnitType(data.unit_type || '')
      setUnitPrice(String(data.unit_price || ''))
      setStockInput(String(data.stock || ''))
      setAvgUsageDays(String(data.avg_usage_days || ''))
      setShipFee(String(data.shipping_fee || ''))
      setShipMemo(data.shipping_memo || '')
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
      setIsActive(data.is_active ?? true)
      setIsTimesale(data.is_timesale ?? false)
      setIsGroupbuy(data.is_groupbuy ?? false)
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
      alert('먼저 임시저장해 주세요')
      return
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const url = await uploadToStorage(file, `edit/${workingIdRef.current}/${slot}-${Date.now()}.${ext}`)
    setThumbImages(prev => {
      const n = [...prev]
      n[slot] = url
      return n
    })
  }, [])

  const handleVideoPick = useCallback(async (file: File) => {
    if (!workingIdRef.current) {
      alert('먼저 임시저장해 주세요')
      return
    }
    const ext = file.name.split('.').pop() || 'mp4'
    const url = await uploadVideoToStorage(file, `edit/${workingIdRef.current}/video-${Date.now()}.${ext}`)
    setVideoUrl(url)
  }, [])

  const handleDetailImagePick = useCallback(async (file: File) => {
    if (!workingIdRef.current) {
      alert('먼저 임시저장해 주세요')
      return
    }
    const ext = file.name.split('.').pop() || 'jpg'
    const url = await uploadVideoToStorage(file, `edit/${workingIdRef.current}/detail-${Date.now()}.${ext}`)
    setDetailImages(prev => [...prev, url])
  }, [])

  const buildPayload = () => ({
    brand_id: brandId || null,
    name: name.trim().slice(0, 100) || '신규 상품',
    description: shortDesc.trim() || null,
    tag: keywords.trim() || null,
    category: origin.trim() || null,
    ingredient: manufacturer.trim() || null,
    retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)),
    sale_price: salePrice.trim() === '' ? null : Math.max(0, Math.floor(Number(salePrice))),
    unit_type: unitType || null,
    unit_price: unitPrice.trim() === '' ? null : Number(unitPrice),
    stock: stockInput.trim() === '' ? null : Math.max(0, Math.floor(Number(stockInput))),
    avg_usage_days: avgUsageDays.trim() === '' ? null : Math.max(1, Math.floor(Number(avgUsageDays))),
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
    is_timesale: isTimesale,
    is_groupbuy: isGroupbuy,
    is_exclusive: isExclusive,
    is_flash_sale: isFlashSale,
    skin_concerns: skinConcerns.length ? skinConcerns : null,
    hormone_tags: hormoneStages.length ? hormoneStages : null,
    step_tags: stepTags.length ? stepTags : null,
    skin_types: skinTypes.length ? skinTypes : null,
    season_tags: seasonTags.length ? seasonTags : null,
    ingredient_tags: ingredientTags.trim() ? ingredientTags.split(',').map(s => s.trim()).filter(Boolean) : null,
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

  const onTmpSave = () => {
    const now = new Date()
    setTmpSavedAt(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
    const key = editId ? `auran_product_draft_${editId}` : 'auran_product_draft_new'
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify({ name, shortDesc, retailPrice, salePrice }))
    }
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

  const ActionBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {msg && <span style={{ fontSize: 12, color: msg.includes('완료') ? '#4cad7e' : '#e08080' }}>{msg}</span>}
      <button type="button" onClick={onTmpSave} style={{ padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>임시저장</button>
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
              <div><span style={S.lbl}>카테고리</span><input style={S.inp} value={origin} onChange={e => setOrigin(e.target.value)} placeholder="카테고리 (예: 마스크팩)" /></div>
              <div><span style={S.lbl}>제조사</span><input style={S.inp} value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="제조사명" /></div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {([['플래시세일', isFlashSale, setIsFlashSale], ['공동구매', isGroupbuy, setIsGroupbuy], ['AURAN 독점', isExclusive, setIsExclusive]] as const).map(([label, val, set]) => (
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
            <div style={S.row2}>
              <div><span style={S.lbl}>배송비 (₩)</span><input style={S.inp} type="number" value={shipFee} onChange={e => setShipFee(e.target.value)} placeholder="3500" /></div>
              <div><span style={S.lbl}>배송 메모</span><input style={S.inp} value={shipMemo} onChange={e => setShipMemo(e.target.value)} placeholder="제주 +3,000원" /></div>
            </div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>포인트 / 토스트</div>
            <div style={S.row3}>
              <div><span style={S.lbl}>구매 적립 (%)</span><input style={S.inp} type="number" value={earnPointsPercent} onChange={e => setEarnPointsPercent(e.target.value)} placeholder="5" /></div>
              <div><span style={S.lbl}>공유 포인트</span><input style={S.inp} type="number" value={shareVal} onChange={e => setShareVal(e.target.value)} placeholder="100" /></div>
              <div><span style={S.lbl}>리뷰 토스트 (%)</span><input style={S.inp} type="number" placeholder="3" /></div>
            </div>
            <div style={S.row3}>
              <div><span style={S.lbl}>텍스트 리뷰 (T)</span><input style={S.inp} type="number" value={reviewText} onChange={e => setReviewText(e.target.value)} placeholder="100" /></div>
              <div><span style={S.lbl}>사진 리뷰 (T)</span><input style={S.inp} type="number" value={reviewPhoto} onChange={e => setReviewPhoto(e.target.value)} placeholder="300" /></div>
              <div><span style={S.lbl}>영상 리뷰 (T)</span><input style={S.inp} type="number" value={reviewVideo} onChange={e => setReviewVideo(e.target.value)} placeholder="500" /></div>
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
            <textarea style={{ ...S.inp, minHeight: 200, resize: 'vertical' as const }} value={detailContent} onChange={e => setDetailContent(e.target.value)} placeholder="상세 설명 (HTML 가능)" />
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
              { label: '호르몬 단계', items: ['달빛기', '황금기', '만개기', '물들기'], arr: hormoneStages, set: setHormoneStages, style: S.goldTag },
              { label: '루틴 단계', items: ['클렌징', '토너', '세럼', '크림', '선케어', '마스크팩'], arr: stepTags, set: setStepTags, style: S.tag },
              { label: '피부 타입', items: ['건성', '지성', '복합성', '민감성', '중성'], arr: skinTypes, set: setSkinTypes, style: S.tag },
              { label: '계절', items: ['봄', '여름', '가을', '겨울'], arr: seasonTags, set: setSeasonTags, style: S.tag },
            ].map(({ label, items, arr, set, style }) => (
              <div key={label} style={S.f}>
                <span style={S.lbl}>{label}</span>
                <div>{items.map(t => <span key={t} style={style(arr.includes(t))} onClick={() => toggleArr(arr, t, set)}>{t}</span>)}</div>
              </div>
            ))}
            <div><span style={S.lbl}>성분 태그 (콤마 구분)</span><input style={S.inp} value={ingredientTags} onChange={e => setIngredientTags(e.target.value)} placeholder="히알루론산, 나이아신아마이드" /></div>
          </div>

          <div style={S.sec}>
            <div style={S.secTitle}>판매 설정</div>
            {[
              { label: '판매 상태', val: isActive, set: setIsActive },
              { label: '타임세일', val: isTimesale, set: setIsTimesale },
              { label: '공동구매', val: isGroupbuy, set: setIsGroupbuy },
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
