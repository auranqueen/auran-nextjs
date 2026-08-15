'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { buildEventBanner, parseEventBanner } from '@/lib/brand/brandProductTypes'
import BrandProductPriceSection from './BrandProductPriceSection'
import BrandProductMediaSection from './BrandProductMediaSection'
import BrandProductMetadataSection from './BrandProductMetadataSection'

const SAVE_API = '/api/brand/brand-products/save'

interface BrandProductFormV2Props {
  brandId: string
  brandName: string
  myBrands: Array<{ id: string; name: string }>
  authUserId?: string
  staffId?: string | null
  productId?: string
  onSaved?: (savedBrandId: string) => void
  onClose?: () => void
}

export default function BrandProductFormV2({ brandId: propBrandId, brandName, myBrands, authUserId, staffId, productId: propProductId, onSaved, onClose }: BrandProductFormV2Props) {
  const supabase = createClient()
  const editId = propProductId || null
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
  const [brandId, setBrandId] = useState(propBrandId)
  const [supplyPrice, setSupplyPrice] = useState('')
  const [consumerPrice, setConsumerPrice] = useState('')
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
  const [isExclusive, setIsExclusive] = useState(false)
  const [isSamplePouch, setIsSamplePouch] = useState(false)

  const [thumbImages, setThumbImages] = useState<(string | null)[]>([null, null, null, null, null])
  const [videoUrl, setVideoUrl] = useState('')
  const [detailImages, setDetailImages] = useState<string[]>([])

  const [detailContent, setDetailContent] = useState('')

  const [keyIngredients, setKeyIngredients] = useState('')
  const [ingredientText, setIngredientText] = useState('')
  const [clinicalResult, setClinicalResult] = useState('')
  const [certifications, setCertifications] = useState('')

  const [ptInput, setPtInput] = useState('')
  const [ptResults, setPtResults] = useState<{ id: string; name: string }[]>([])
  const [ptSelected, setPtSelected] = useState<{ id: string; name: string }[]>([])

  const [skinConcerns, setSkinConcerns] = useState<string[]>([])
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

  useEffect(() => {
    if (!editId) return
    setLoading(true)
    supabase.from('brand_products').select('*').eq('id', editId).single().then(({ data }) => {
      if (!data) {
        setLoading(false)
        return
      }
      setName(data.name || '')
      setShortDesc(data.description || '')
      setKeywords(data.tag || '')
      setSupplyPrice(String(data.supply_price ?? 0))
      setConsumerPrice(String(data.consumer_price ?? 0))
      setCategoryText(data.category || '')
      if (data.category_id) setProductCategoryLeafId(data.category_id)

      const imgs = Array.isArray(data.images) ? data.images : []
      setThumbImages(
        imgs.length
          ? [...imgs, ...Array(Math.max(0, 5 - imgs.length)).fill(null)].slice(0, 5)
          : data.thumb_img
            ? [data.thumb_img, null, null, null, null]
            : [null, null, null, null, null],
      )

      setDetailContent(data.detail_content || '')
      setDetailImages(Array.isArray(data.detail_images) ? data.detail_images : [])
      setKeyIngredients(data.ingredient_main || '')
      setIngredientText(data.ingredient_full || '')
      setSkinConcerns(Array.isArray(data.skin_concern) ? data.skin_concern : [])
      setSkinTypes(Array.isArray(data.skin_type) ? data.skin_type : [])

      const ev = parseEventBanner(data.event_banner)
      setEventEmoji(ev?.emoji || '')
      setEventTitle(ev?.title || '')
      setEventDesc(ev?.desc || '')
      setEventStartsAt(ev?.starts_at?.slice(0, 10) || '')
      setEventEndsAt(ev?.ends_at?.slice(0, 10) || '')

      setIsActive(data.status === 'active')
      setIsSamplePouch(data.is_sample_pouch ?? false)
      workingIdRef.current = editId
      setLoading(false)
    })
  }, [editId, supabase])

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

  const brandOptions = useMemo(() => {
    if (myBrands.some((brand) => brand.id === propBrandId)) {
      return myBrands
    }
    return [{ id: propBrandId, name: brandName || '현재 브랜드' }, ...myBrands]
  }, [myBrands, propBrandId, brandName])

  const selectedBrandName =
    brandOptions.find((brand) => brand.id === brandId)?.name ||
    brandName ||
    '—'

  const S = {
    pg: { background: '#0D0B09', color: '#e8e4dc', fontFamily: 'var(--font-sans)', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: 16 } as CSSProperties,
    topbar: { background: '#0D0B09', borderBottom: '0.5px solid rgba(255,255,255,0.08)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky' as const, top: 0, zIndex: 10 } as CSSProperties,
    body: { display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, padding: '20px 24px', maxWidth: 1200, margin: '0 auto' } as CSSProperties,
    inp: { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', color: '#e8e4dc', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const } as CSSProperties,
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

  const buildSaveBody = useCallback((statusOverride?: string) => {
    const imgs = thumbImages.filter(Boolean) as string[]
    return {
      id: editId || workingIdRef.current || undefined,
      brand_id: brandId,
      staff_id: staffId ?? null,
      name: name.trim().slice(0, 100) || '신규 상품',
      supply_price: Math.max(0, Math.trunc(Number(supplyPrice) || 0)),
      consumer_price: Math.max(0, Math.trunc(Number(consumerPrice) || 0)),
      description: shortDesc.trim() || null,
      tag: keywords.trim() || null,
      category_id: catL5 || catL4 || catL3 || catL2 || catL1 || null,
      category: categoryText.trim() || categoryBreadcrumb || null,
      thumb_img: imgs[0] ?? null,
      images: imgs,
      event_banner: buildEventBanner({
        emoji: eventEmoji,
        title: eventTitle,
        desc: eventDesc,
        starts_at: eventStartsAt || undefined,
        ends_at: eventEndsAt || undefined,
      }),
      ingredient_main: keyIngredients.trim() || null,
      ingredient_full: ingredientText.trim() || null,
      detail_content: detailContent || null,
      detail_images: detailImages,
      skin_concern: skinConcerns,
      skin_type: skinTypes,
      is_sample_pouch: isSamplePouch,
      status: statusOverride ?? (isActive ? 'active' : 'hidden'),
    }
  }, [
    editId,
    brandId,
    staffId,
    name,
    supplyPrice,
    consumerPrice,
    shortDesc,
    keywords,
    catL1,
    catL2,
    catL3,
    catL4,
    catL5,
    categoryText,
    categoryBreadcrumb,
    thumbImages,
    eventEmoji,
    eventTitle,
    eventDesc,
    eventStartsAt,
    eventEndsAt,
    keyIngredients,
    ingredientText,
    detailContent,
    detailImages,
    skinConcerns,
    skinTypes,
    isSamplePouch,
    isActive,
  ])

  const persistViaApi = useCallback(async (statusOverride?: string) => {
    const res = await fetch(SAVE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(buildSaveBody(statusOverride)),
    })
    const json = await res.json().catch(() => ({}))
    if (!json?.ok) throw new Error(json?.error || '저장 실패')
    if (json.product?.id) workingIdRef.current = json.product.id
    return json.product
  }, [buildSaveBody])

  const ensureWorkingProduct = useCallback(async () => {
    if (workingIdRef.current) return workingIdRef.current
    if (!brandId) { alert('브랜드 정보가 없습니다'); return null }
    try {
      await persistViaApi('pending')
      const now = new Date()
      setTmpSavedAt(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
      return workingIdRef.current
    } catch (e) {
      alert(e instanceof Error ? e.message : '임시 저장 실패')
      return null
    }
  }, [brandId, persistViaApi])

  const onSave = async () => {
    setMsg('')
    if (!brandId) {
      setMsg('브랜드를 선택해 주세요')
      return
    }
    setSaving(true)
    try {
      await persistViaApi(isActive ? 'active' : 'hidden')
      setMsg('저장 완료 ✓')
      setTimeout(() => setMsg(''), 3000)
      onSaved?.(brandId)
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setSaving(false)
    }
  }

  const onTmpSave = async () => {
    if (!brandId) { alert('브랜드 정보가 없습니다'); return }
    setSaving(true)
    try {
      await persistViaApi('pending')
      const now = new Date()
      setTmpSavedAt(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '임시저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const loadDrafts = async () => {
    const { data } = await supabase
      .from('brand_products')
      .select('id, name, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20)
    setDraftList(data || [])
    setShowDraftPicker(true)
  }

  const ActionBar = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {msg && <span style={{ fontSize: 12, color: msg.includes('완료') ? '#4cad7e' : '#e08080' }}>{msg}</span>}
      <button type="button" onClick={() => void onTmpSave()} style={{ padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>임시저장</button>
      {!editId && <button type="button" onClick={() => void loadDrafts()} style={{ padding: '7px 12px', borderRadius: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer' }}>📋 불러오기</button>}
      <button type="button" onClick={() => void onSave()} disabled={saving} style={{ padding: '7px 18px', borderRadius: 8, background: '#7b5ea7', border: 'none', color: '#fff', fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? '저장 중...' : '저장'}</button>
      <button type="button" onClick={() => onClose?.()} style={{ padding: '7px 14px', borderRadius: 8, background: 'transparent', border: '0.5px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>닫기</button>
    </div>
  )

  if (loading) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>불러오는 중...</div>

  return (
    <div style={S.pg}>
      <div style={S.topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14 }}>{editId ? '브랜드 상품 수정' : '브랜드 상품 등록'}</span>
          {tmpSavedAt && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{tmpSavedAt} 임시저장됨</span>}
        </div>
        <ActionBar />
      </div>
      <div style={S.body}>
        <div>
          <BrandProductPriceSection
            editId={editId} name={name} setName={setName}
            shortDesc={shortDesc} setShortDesc={setShortDesc}
            keywords={keywords} setKeywords={setKeywords}
            brandId={brandId} setBrandId={setBrandId} brandOptions={brandOptions}
            selectedBrandName={selectedBrandName}
            supplyPrice={supplyPrice} setSupplyPrice={setSupplyPrice}
            consumerPrice={consumerPrice} setConsumerPrice={setConsumerPrice}
            categoryBreadcrumb={categoryBreadcrumb}
            onOpenCategory={() => { setCategoryPickerTab('select'); setShowCategoryPicker(true) }}
            manufacturer={manufacturer} setManufacturer={setManufacturer}
            isExclusive={isExclusive} setIsExclusive={setIsExclusive}
            isSamplePouch={isSamplePouch} setIsSamplePouch={setIsSamplePouch}
          />

          <BrandProductMediaSection
            thumbImages={thumbImages}
            setThumbImages={setThumbImages}
            videoUrl={videoUrl}
            setVideoUrl={setVideoUrl}
            detailContent={detailContent}
            setDetailContent={setDetailContent}
            detailImages={detailImages}
            setDetailImages={setDetailImages}
            ensureWorkingProduct={ensureWorkingProduct}
          />

          <BrandProductMetadataSection
            keyIngredients={keyIngredients}
            setKeyIngredients={setKeyIngredients}
            ingredientText={ingredientText}
            setIngredientText={setIngredientText}
            clinicalResult={clinicalResult}
            setClinicalResult={setClinicalResult}
            certifications={certifications}
            setCertifications={setCertifications}
            ptInput={ptInput}
            setPtInput={setPtInput}
            ptResults={ptResults}
            setPtResults={setPtResults}
            ptSelected={ptSelected}
            setPtSelected={setPtSelected}
            skinConcerns={skinConcerns}
            setSkinConcerns={setSkinConcerns}
            stepTags={stepTags}
            setStepTags={setStepTags}
            skinTypes={skinTypes}
            setSkinTypes={setSkinTypes}
            seasonTags={seasonTags}
            setSeasonTags={setSeasonTags}
            ingredientTags={ingredientTags}
            setIngredientTags={setIngredientTags}
            isActive={isActive}
            setIsActive={setIsActive}
            isExclusive={isExclusive}
            setIsExclusive={setIsExclusive}
            eventEmoji={eventEmoji}
            setEventEmoji={setEventEmoji}
            eventTitle={eventTitle}
            setEventTitle={setEventTitle}
            eventDesc={eventDesc}
            setEventDesc={setEventDesc}
            eventStartsAt={eventStartsAt}
            setEventStartsAt={setEventStartsAt}
            eventEndsAt={eventEndsAt}
            setEventEndsAt={setEventEndsAt}
          />

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
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>{brandName}</div>
              <div style={{ fontSize: 13, color: '#e8e4dc', marginBottom: 6, lineHeight: 1.4 }}>{name || '상품명'}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                {Number(consumerPrice) > 0 ? `${Math.trunc(Number(consumerPrice)).toLocaleString()}원` : '가격은 승인 후 설정됩니다'}
              </div>
              <div>
                {skinConcerns.slice(0, 3).map(t => <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(201,169,110,0.12)', color: '#c9a96e', border: '0.5px solid rgba(201,169,110,0.2)', display: 'inline-block', margin: '2px 2px 0 0' }}>{t}</span>)}
              </div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>섹션 바로가기</div>
            {['기본 정보', '상품 이미지', '상세 설명', '성분 정보', '함께 쓰기 좋은 제품', '태그', '판매 설정', '이벤트 배너'].map(label => (
              <div key={label} style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '4px 0', cursor: 'pointer' }}>{label}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
