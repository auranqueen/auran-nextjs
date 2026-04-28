'use client'

import { createClient } from '@/lib/supabase/client'
import { useAdminOptions } from '@/hooks/useAdminOptions'
import { Editor } from '@toast-ui/react-editor'
import '@toast-ui/editor/dist/toastui-editor.css'
import '@toast-ui/editor/dist/i18n/ko-kr'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const BG = '#0f0d14'
const ACC = '#7B5EA7'
const DRAFT_KEY_PREFIX = 'auran_brand_product_form_v1_'

type Cat = { id: string; name: string; parent_id: string | null; level: number; sort_order: number | null }
type OptRow = { id: string; optName: string; optValue: string; priceAdj: string }
type KeyIng = { id: string; emoji: string; name: string; effect: string }

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function buildLeafLabels(rows: Cat[]) {
  const byId = new Map(rows.map(c => [c.id, c]))
  const hasChild = new Set(rows.map(c => c.parent_id).filter(Boolean) as string[])
  const leaves = rows.filter(c => !hasChild.has(c.id))
  return leaves.map(c => {
    const parts: string[] = []
    let cur: Cat | undefined = c
    let g = 0
    while (cur && g++ < 12) {
      parts.unshift(cur.name)
      const pk: string = cur.parent_id != null && String(cur.parent_id) !== '' ? String(cur.parent_id) : ''
      const next: Cat | undefined = pk ? byId.get(pk) : undefined
      cur = next
    }
    return { id: c.id, label: parts.join(' > ') }
  })
}

export type BrandProductFormProps = {
  open: boolean
  onClose: () => void
  authUserId: string
  brandId: string
  brandName: string
  onSubmitted?: () => void
  initialData?: { ingredient_analyzed?: boolean | null; ingredient_photo_url?: string | null }
}

export default function BrandProductForm({ open, onClose, authUserId, brandId, brandName, onSubmitted, initialData }: BrandProductFormProps) {
  const supabase = createClient()
  const draftIdRef = useRef<string>(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uid())
  const editorRef = useRef<any>(null)
  const ingredientPhotoRef = useRef<HTMLInputElement | null>(null)
  const ingredientPhotoFileRef = useRef<File | null>(null)
  const adminOpts = useAdminOptions(supabase)

  const [tab, setTab] = useState(0)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [categories, setCategories] = useState<Cat[]>([])
  const [categoryId, setCategoryId] = useState('')

  const [name, setName] = useState('')
  const [modelName, setModelName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [originPick, setOriginPick] = useState('')
  const [originCustom, setOriginCustom] = useState('')
  const [hookPhrase, setHookPhrase] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [keywords, setKeywords] = useState('')
  const [skinTypesPick, setSkinTypesPick] = useState<string[]>([])
  const [skinConcernsPick, setSkinConcernsPick] = useState<string[]>([])
  const [skinStage, setSkinStage] = useState('')
  const [useTiming, setUseTiming] = useState('')
  const [hormoneTimingProduct, setHormoneTimingProduct] = useState('')

  const [supplyPrice, setSupplyPrice] = useState('')
  const [retailPrice, setRetailPrice] = useState('')
  const [unitPriceNum, setUnitPriceNum] = useState('')
  const [unitTypePick, setUnitTypePick] = useState('ml')
  const [stockQty, setStockQty] = useState('0')
  const [stockMode, setStockMode] = useState<'unlimited' | 'limited'>('limited')
  const [minOrder, setMinOrder] = useState('1')
  const [maxOrder, setMaxOrder] = useState('')
  const [saleStatusChip, setSaleStatusChip] = useState('')
  const [optionRows, setOptionRows] = useState<OptRow[]>([])

  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState('')
  const [extraFiles, setExtraFiles] = useState<{ id: string; file: File; preview: string }[]>([])
  const [gifFile, setGifFile] = useState<File | null>(null)
  const [gifPreview, setGifPreview] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState('')

  const [detailHtml, setDetailHtml] = useState('')

  const [fullIngredient, setFullIngredient] = useState('')
  const [ingredientAnalyzeLoading, setIngredientAnalyzeLoading] = useState(false)
  const [ingredientAnalyzeDone, setIngredientAnalyzeDone] = useState(false)
  const [ingredientPhotoUrl, setIngredientPhotoUrl] = useState<string>('')
  const [keyIngs, setKeyIngs] = useState<KeyIng[]>([])
  const [clinical, setClinical] = useState('')
  const [allergyNote, setAllergyNote] = useState('')
  const [certImageFiles, setCertImageFiles] = useState<{ id: string; file: File; preview: string }[]>([])

  const [productGroup, setProductGroup] = useState('')
  const [summaryName, setSummaryName] = useState('')
  const [summaryCountry, setSummaryCountry] = useState('')
  const [useByDate, setUseByDate] = useState('')
  const [importer, setImporter] = useState('')
  const [asContact, setAsContact] = useState('')
  const [certTypesPick, setCertTypesPick] = useState<string[]>([])
  const [certCustom, setCertCustom] = useState('')

  const leafCats = useMemo(() => buildLeafLabels(categories), [categories])

  useEffect(() => {
    if (!open) return
    supabase
      .from('categories')
      .select('id,name,parent_id,level,sort_order')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .then(({ data }) => setCategories((data || []) as Cat[]))
  }, [open])

  useEffect(() => {
    if (!open) return
    setMsg('')
    setTab(0)
    draftIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uid()
    if (initialData?.ingredient_analyzed) setIngredientAnalyzeDone(true)
    if (initialData?.ingredient_photo_url) setIngredientPhotoUrl(initialData.ingredient_photo_url)
  }, [open, initialData])

  useEffect(() => {
    if (saleStatusChip === '' && adminOpts.productStatus.length) setSaleStatusChip(adminOpts.productStatus[0])
  }, [adminOpts.productStatus, saleStatusChip])

  const persistDraft = useCallback(() => {
    const payload = {
      categoryId,
      name,
      modelName,
      manufacturer,
      originPick,
      originCustom,
      hookPhrase,
      shortDesc,
      keywords,
      skinTypesPick,
      skinConcernsPick,
      skinStage,
      useTiming,
      hormoneTimingProduct,
      supplyPrice,
      retailPrice,
      unitPriceNum,
      unitTypePick,
      stockQty,
      stockMode,
      minOrder,
      maxOrder,
      saleStatusChip,
      optionRows,
      detailHtml,
      fullIngredient,
      keyIngs,
      clinical,
      allergyNote,
      productGroup,
      summaryName,
      summaryCountry,
      useByDate,
      importer,
      asContact,
      certTypesPick,
      certCustom,
    }
    try {
      localStorage.setItem(DRAFT_KEY_PREFIX + brandId, JSON.stringify(payload))
      setMsg('임시저장했습니다.')
    } catch {
      setMsg('임시저장에 실패했습니다.')
    }
  }, [
    allergyNote,
    brandId,
    categoryId,
    certCustom,
    certTypesPick,
    clinical,
    detailHtml,
    fullIngredient,
    hookPhrase,
    importer,
    keyIngs,
    keywords,
    manufacturer,
    maxOrder,
    minOrder,
    modelName,
    name,
    optionRows,
    originCustom,
    originPick,
    productGroup,
    retailPrice,
    saleStatusChip,
    shortDesc,
    skinConcernsPick,
    skinStage,
    skinTypesPick,
    stockMode,
    stockQty,
    summaryCountry,
    summaryName,
    supplyPrice,
    unitPriceNum,
    unitTypePick,
    useByDate,
    useTiming,
    hormoneTimingProduct,
    asContact,
  ])

  const loadDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY_PREFIX + brandId)
      if (!raw) return
      const d = JSON.parse(raw) as Record<string, unknown>
      setCategoryId(String(d.categoryId || ''))
      setName(String(d.name || ''))
      setModelName(String(d.modelName || ''))
      setManufacturer(String(d.manufacturer || ''))
      setOriginPick(String(d.originPick || ''))
      setOriginCustom(String(d.originCustom || ''))
      setHookPhrase(String(d.hookPhrase || ''))
      setShortDesc(String(d.shortDesc || ''))
      setKeywords(String(d.keywords || ''))
      setSkinTypesPick(Array.isArray(d.skinTypesPick) ? d.skinTypesPick.map(String) : [])
      setSkinConcernsPick(Array.isArray(d.skinConcernsPick) ? d.skinConcernsPick.map(String) : [])
      setSkinStage(String(d.skinStage || ''))
      setUseTiming(String(d.useTiming || ''))
      setHormoneTimingProduct(String(d.hormoneTimingProduct || ''))
      setSupplyPrice(String(d.supplyPrice || ''))
      setRetailPrice(String(d.retailPrice || ''))
      setUnitPriceNum(String(d.unitPriceNum || ''))
      setUnitTypePick(String(d.unitTypePick || 'ml'))
      setStockQty(String(d.stockQty || '0'))
      setStockMode(d.stockMode === 'unlimited' ? 'unlimited' : 'limited')
      setMinOrder(String(d.minOrder || '1'))
      setMaxOrder(String(d.maxOrder || ''))
      setSaleStatusChip(String(d.saleStatusChip || ''))
      setOptionRows(Array.isArray(d.optionRows) ? (d.optionRows as OptRow[]) : [])
      setDetailHtml(String(d.detailHtml || ''))
      setFullIngredient(String(d.fullIngredient || ''))
      setKeyIngs(Array.isArray(d.keyIngs) ? (d.keyIngs as KeyIng[]) : [])
      setClinical(String(d.clinical || ''))
      setAllergyNote(String(d.allergyNote || ''))
      setProductGroup(String(d.productGroup || ''))
      setSummaryName(String(d.summaryName || ''))
      setSummaryCountry(String(d.summaryCountry || ''))
      setUseByDate(String(d.useByDate || ''))
      setImporter(String(d.importer || ''))
      setAsContact(String(d.asContact || ''))
      setCertTypesPick(Array.isArray(d.certTypesPick) ? d.certTypesPick.map(String) : [])
      setCertCustom(String(d.certCustom || ''))
      setMsg('임시저장을 불러왔습니다.')
    } catch {
      setMsg('임시저장 불러오기 실패')
    }
  }, [brandId])

  const uploadPublic = async (bucket: string, path: string, file: File) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: true,
      contentType: file.type || undefined,
    })
    if (error) throw error
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl as string
  }

  const toggleStr = (arr: string[], v: string, set: (n: string[]) => void) => {
    const s = new Set(arr)
    if (s.has(v)) s.delete(v)
    else s.add(v)
    set(Array.from(s))
  }

  const hookPreview = hookPhrase.slice(0, 40)

  const requiredOk = useMemo(() => {
    const supOk = supplyPrice.trim() !== '' && Number.isFinite(Number(supplyPrice)) && Number(supplyPrice) >= 0
    return (
      name.trim().length > 0 &&
      !!categoryId &&
      !!thumbFile &&
      supOk &&
      summaryCountry.trim().length > 0
    )
  }, [categoryId, name, summaryCountry, supplyPrice, thumbFile])

  const checklist = useMemo(
    () => [
      { k: '제품명', ok: name.trim().length > 0, level: 'req' as const },
      { k: '카테고리', ok: !!categoryId, level: 'req' as const },
      { k: '대표 썸네일', ok: !!thumbFile, level: 'req' as const },
      { k: '납품가', ok: supplyPrice.trim() !== '' && Number.isFinite(Number(supplyPrice)), level: 'req' as const },
      { k: '제조국(요약)', ok: summaryCountry.trim().length > 0, level: 'req' as const },
      { k: '상세 HTML', ok: detailHtml.trim().length > 0, level: 'opt' as const },
      { k: '시중가', ok: retailPrice.trim() !== '', level: 'opt' as const },
    ],
    [categoryId, detailHtml, name, retailPrice, summaryCountry, supplyPrice, thumbFile]
  )

  const onReorderExtra = (from: number, to: number) => {
    setExtraFiles(prev => {
      const n = [...prev]
      const [x] = n.splice(from, 1)
      n.splice(to, 0, x)
      return n
    })
  }

  const submitFinal = async () => {
    setMsg('')
    if (!requiredOk) {
      setMsg('필수 항목을 확인해 주세요.')
      return
    }
    setBusy(true)
    try {
      let htmlOut = detailHtml
      try {
        htmlOut = editorRef.current?.getInstance?.()?.getHTML?.() || detailHtml
      } catch {
        /* keep detailHtml */
      }

      const did = draftIdRef.current
      const ext = {
        v: 1,
        hookPhrase: hookPreview,
        modelName,
        manufacturer,
        skinStage,
        useTiming,
        saleStatusChip,
        minOrder: minOrder.trim(),
        maxOrder: maxOrder.trim(),
        productGroup,
        summaryName,
        summaryManufacturingCountry: summaryCountry,
        useByDate,
        importer,
        asContact,
        certTypes: certTypesPick,
        certCustom,
        options: optionRows,
        allergyNote,
        gifIncluded: !!gifFile,
      }
      const keyIngLines = keyIngs
        .filter(k => k.name.trim())
        .map(k => `${k.emoji || '·'} ${k.name.trim()} — ${k.effect.trim()}`)
        .join('\n')

      let thumbUrl = ''
      if (thumbFile) {
        const extn = (thumbFile.name.split('.').pop() || 'jpg').toLowerCase()
        thumbUrl = await uploadPublic('product-images', `brand-form/${did}/thumb.${extn}`, thumbFile)
      }

      const galleryUrls: string[] = []
      for (let i = 0; i < extraFiles.length; i++) {
        const f = extraFiles[i].file
        const extn = (f.name.split('.').pop() || 'jpg').toLowerCase()
        galleryUrls.push(await uploadPublic('product-images', `brand-form/${did}/gallery_${i}.${extn}`, f))
      }

      let gifUrl: string | null = null
      if (gifFile) {
        const extn = (gifFile.name.split('.').pop() || 'gif').toLowerCase()
        gifUrl = await uploadPublic('product-images', `brand-form/${did}/anim.${extn}`, gifFile)
      }

      let videoUrl: string | null = null
      if (videoFile) {
        if (videoFile.size > 50 * 1024 * 1024) throw new Error('영상은 50MB 이하만 가능합니다.')
        const extn = (videoFile.name.split('.').pop() || 'mp4').toLowerCase()
        videoUrl = await uploadPublic('product-videos', `brand-form/${did}/video.${extn}`, videoFile)
      }

      const certUrls: string[] = []
      for (let i = 0; i < certImageFiles.length; i++) {
        const f = certImageFiles[i].file
        const extn = (f.name.split('.').pop() || 'jpg').toLowerCase()
        certUrls.push(await uploadPublic('product-images', `brand-form/${did}/cert_${i}.${extn}`, f))
      }

      const originVal = originCustom.trim() || originPick || ''
      const stockNum = stockMode === 'unlimited' ? 999999 : Math.max(0, Math.floor(Number(stockQty) || 0))
      const unitPrice =
        unitPriceNum.trim() === ''
          ? null
          : (() => {
              const n = Number(unitPriceNum)
              return Number.isFinite(n) && n >= 0 ? n : null
            })()
      const unitType = unitPrice != null ? `${unitTypePick}당` : null

      const thumbImages = [thumbUrl, ...galleryUrls].filter(Boolean)
      const certificationsBody = [certTypesPick.join(', '), certCustom.trim(), allergyNote.trim()].filter(Boolean).join('\n')

      const insertRow: Record<string, unknown> = {
        brand_id: brandId,
        brand_user_id: authUserId,
        category_id: categoryId || null,
        name: name.trim().slice(0, 200),
        description: shortDesc.trim() || null,
        tag: keywords.trim() || null,
        category: originVal || null,
        ingredient: [manufacturer.trim() && `제조사: ${manufacturer.trim()}`, fullIngredient.trim()].filter(Boolean).join('\n\n') || null,
        key_ingredients: keyIngLines || null,
        clinical_result: clinical.trim() || null,
        certifications: certificationsBody || null,
        detail_html: htmlOut.trim() || null,
        retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)),
        supply_price: Math.max(0, Math.floor(Number(supplyPrice) || 0)),
        stock: stockNum,
        status: 'pending',
        thumb_img: thumbUrl,
        thumb_images: thumbImages,
        detail_imgs: galleryUrls,
        detail_images: [...galleryUrls, ...certUrls],
        video_url: videoUrl,
        skin_types: skinTypesPick.length ? skinTypesPick : null,
        skin_concerns: skinConcernsPick.length ? skinConcernsPick : null,
        hormone_timing: hormoneTimingProduct.trim() || null,
        ingredient_analyzed: ingredientAnalyzeDone,
        ingredient_photo_url: ingredientPhotoUrl || null,
        unit_type: unitType,
        unit_price: unitPrice,
        quiz_match: [`__BRAND_EXT__${JSON.stringify({ ...ext, gifUrl })}`],
        perfect_together: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: created, error: insErr } = await supabase.from('products').insert(insertRow as any).select('id').single()
      if (insErr || !created?.id) throw new Error(insErr?.message || '등록 실패')

      const { data: admins } = await supabase.from('users').select('id').in('role', ['admin', 'master'])
      const rows = (admins || []).map((a: { id: string }) => ({
        user_id: a.id,
        title: '브랜드 신제품 승인 요청',
        body: `${brandName} · ${name.trim()}`,
        type: 'system',
        is_read: false,
      }))
      if (rows.length) {
        const { error: nErr } = await supabase.from('notifications').insert(rows as any)
        if (nErr) console.warn('[brand form] admin notify', nErr.message)
      }

      try {
        localStorage.removeItem(DRAFT_KEY_PREFIX + brandId)
      } catch {
        /* ignore */
      }
      onSubmitted?.()
      onClose()
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const chip = (active: boolean) => ({
    display: 'inline-block',
    margin: 4,
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 12,
    cursor: 'pointer',
    border: `1px solid ${active ? ACC : 'rgba(255,255,255,0.12)'}`,
    background: active ? 'rgba(123,94,167,0.22)' : 'rgba(255,255,255,0.04)',
    color: active ? '#e4daf5' : 'rgba(255,255,255,0.55)',
  })

  const labelStyle = { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginBottom: 6, display: 'block' as const }
  const inputStyle: CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#fff',
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          background: BG,
          borderRadius: 14,
          border: `1px solid rgba(123,94,167,0.35)`,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '100%',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            position: 'sticky',
            top: 0,
            background: BG,
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 16, color: '#e8e0f2' }}>새 제품 등록</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={busy}
              onClick={() => loadDraft()}
              style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACC}`, background: 'transparent', color: '#d8c8ef', cursor: 'pointer' }}
            >
              임시저장 불러오기
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => persistDraft()}
              style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, border: `1px solid ${ACC}`, background: 'rgba(123,94,167,0.2)', color: '#e8dff9', cursor: 'pointer' }}
            >
              임시저장
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onClose()}
              style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
            >
              닫기
            </button>
          </div>
        </div>

        {msg ? (
          <div style={{ padding: '8px 14px', fontSize: 12, color: '#c9b8e8', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{msg}</div>
        ) : null}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['① 기본', '② 가격/재고', '③ 이미지', '④ 상세', '⑤ 성분', '⑥ 요약', '⑦ 승인'].map((t, i) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(i)}
              style={{
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 8,
                border: tab === i ? `1px solid ${ACC}` : '1px solid rgba(255,255,255,0.1)',
                background: tab === i ? 'rgba(123,94,167,0.15)' : 'transparent',
                color: tab === i ? '#e4daf5' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: 14 }}>
          {tab === 0 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <span style={labelStyle}>카테고리</span>
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={inputStyle}>
                  <option value="">선택</option>
                  {leafCats.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#1a1522' }}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span style={labelStyle}>제품명 (필수)</span>
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="제품명" />
              </div>
              <div>
                <span style={labelStyle}>브랜드명</span>
                <input value={brandName} readOnly style={{ ...inputStyle, opacity: 0.7 }} />
              </div>
              <div>
                <span style={labelStyle}>모델명</span>
                <input value={modelName} onChange={e => setModelName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>제조사</span>
                <input value={manufacturer} onChange={e => setManufacturer(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>원산지</span>
                <select value={originPick} onChange={e => setOriginPick(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
                  <option value="">선택</option>
                  {adminOpts.origin.map(o => (
                    <option key={o} value={o} style={{ background: '#1a1522' }}>
                      {o}
                    </option>
                  ))}
                </select>
                <input value={originCustom} onChange={e => setOriginCustom(e.target.value)} style={inputStyle} placeholder="직접 입력" />
              </div>
              <div>
                <span style={labelStyle}>후킹 문구 (최대 40자)</span>
                <input value={hookPhrase} maxLength={40} onChange={e => setHookPhrase(e.target.value)} style={inputStyle} />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>미리보기: {hookPreview || '—'}</div>
              </div>
              <div>
                <span style={labelStyle}>간단설명 (200자)</span>
                <textarea value={shortDesc} maxLength={200} onChange={e => setShortDesc(e.target.value)} style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }} />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{shortDesc.length}/200</div>
              </div>
              <div>
                <span style={labelStyle}>검색 키워드</span>
                <input value={keywords} onChange={e => setKeywords(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>피부타입</span>
                <div>
                  {adminOpts.skinType.map(s => (
                    <span key={s} role="button" tabIndex={0} style={chip(skinTypesPick.includes(s))} onClick={() => toggleStr(skinTypesPick, s, setSkinTypesPick)}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span style={labelStyle}>피부고민</span>
                <div>
                  {adminOpts.skinConcern.map(s => (
                    <span key={s} role="button" tabIndex={0} style={chip(skinConcernsPick.includes(s))} onClick={() => toggleStr(skinConcernsPick, s, setSkinConcernsPick)}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span style={labelStyle}>피부단계</span>
                <select value={skinStage} onChange={e => setSkinStage(e.target.value)} style={inputStyle}>
                  <option value="">선택</option>
                  {adminOpts.skinStage.map(s => (
                    <option key={s} value={s} style={{ background: '#1a1522' }}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span style={labelStyle}>사용시기</span>
                <select value={useTiming} onChange={e => setUseTiming(e.target.value)} style={inputStyle}>
                  <option value="">선택</option>
                  {adminOpts.useTiming.map(s => (
                    <option key={s} value={s} style={{ background: '#1a1522' }}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 1 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', padding: 10, borderRadius: 10, border: '1px solid rgba(123,94,167,0.25)' }}>
                납품가는 관리자만 상세 열람·검수 시 확인합니다.
              </div>
              <div>
                <span style={labelStyle}>납품가 (필수)</span>
                <input value={supplyPrice} inputMode="numeric" onChange={e => setSupplyPrice(e.target.value)} style={inputStyle} placeholder="숫자" />
              </div>
              <div>
                <span style={labelStyle}>시중가</span>
                <input value={retailPrice} inputMode="numeric" onChange={e => setRetailPrice(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
                <div>
                  <span style={labelStyle}>단위가격 (숫자)</span>
                  <input value={unitPriceNum} inputMode="decimal" onChange={e => setUnitPriceNum(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <span style={labelStyle}>단위</span>
                  <select value={unitTypePick} onChange={e => setUnitTypePick(e.target.value)} style={inputStyle}>
                    {['ml', 'g', 'ea', '정', '매'].map(u => (
                      <option key={u} value={u} style={{ background: '#1a1522' }}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <span style={labelStyle}>재고</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
                    <input type="radio" checked={stockMode === 'unlimited'} onChange={() => setStockMode('unlimited')} style={{ marginRight: 6 }} />
                    무제한
                  </label>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', cursor: 'pointer' }}>
                    <input type="radio" checked={stockMode === 'limited'} onChange={() => setStockMode('limited')} style={{ marginRight: 6 }} />
                    한정
                  </label>
                </div>
                {stockMode === 'limited' ? (
                  <input value={stockQty} inputMode="numeric" onChange={e => setStockQty(e.target.value)} style={inputStyle} />
                ) : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <span style={labelStyle}>최소 주문</span>
                  <input value={minOrder} inputMode="numeric" onChange={e => setMinOrder(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <span style={labelStyle}>최대 주문 (빈 값 무제한)</span>
                  <input value={maxOrder} inputMode="numeric" onChange={e => setMaxOrder(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <span style={labelStyle}>판매 상태 (표시용)</span>
                <div>
                  {adminOpts.productStatus.map(s => (
                    <span key={s} role="button" tabIndex={0} style={chip(saleStatusChip === s)} onClick={() => setSaleStatusChip(s)}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span style={labelStyle}>옵션</span>
                {optionRows.map(row => (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 56px', gap: 6, marginBottom: 8 }}>
                    <input placeholder="옵션명" value={row.optName} onChange={e => setOptionRows(prev => prev.map(r => (r.id === row.id ? { ...r, optName: e.target.value } : r)))} style={inputStyle} />
                    <input placeholder="값" value={row.optValue} onChange={e => setOptionRows(prev => prev.map(r => (r.id === row.id ? { ...r, optValue: e.target.value } : r)))} style={inputStyle} />
                    <input placeholder="추가금" value={row.priceAdj} onChange={e => setOptionRows(prev => prev.map(r => (r.id === row.id ? { ...r, priceAdj: e.target.value } : r)))} style={inputStyle} />
                    <button
                      type="button"
                      onClick={() => setOptionRows(prev => prev.filter(r => r.id !== row.id))}
                      style={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptionRows(prev => [...prev, { id: uid(), optName: '', optValue: '', priceAdj: '' }])}
                  style={{ fontSize: 12, marginTop: 6, padding: '8px 12px', borderRadius: 8, border: `1px dashed ${ACC}`, background: 'transparent', color: '#c4b0e6', cursor: 'pointer' }}
                >
                  + 옵션 추가
                </button>
              </div>
            </div>
          )}

          {tab === 2 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <span style={labelStyle}>대표 썸네일 (필수, product-images)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (thumbPreview) URL.revokeObjectURL(thumbPreview)
                    setThumbFile(f)
                    setThumbPreview(URL.createObjectURL(f))
                  }}
                />
                {thumbPreview ? <img src={thumbPreview} alt="" style={{ marginTop: 8, maxWidth: 160, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }} /> : null}
              </div>
              <div>
                <span style={labelStyle}>추가 이미지 (최대 6, 드래그로 순서 변경)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => {
                    const arr = Array.from(e.target.files || []).slice(0, 6 - extraFiles.length)
                    setExtraFiles(prev => {
                      const next = [...prev]
                      for (const file of arr) {
                        if (next.length >= 6) break
                        next.push({ id: uid(), file, preview: URL.createObjectURL(file) })
                      }
                      return next
                    })
                  }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {extraFiles.map((x, idx) => (
                    <div
                      key={x.id}
                      draggable
                      onDragStart={() => {
                        ;(window as unknown as { __bf_drag: number }).__bf_drag = idx
                      }}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        const from = (window as unknown as { __bf_drag?: number }).__bf_drag
                        if (typeof from === 'number') onReorderExtra(from, idx)
                      }}
                      style={{ width: 72, position: 'relative' }}
                    >
                      <img src={x.preview} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(x.preview)
                          setExtraFiles(prev => prev.filter(y => y.id !== x.id))
                        }}
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          border: 'none',
                          background: '#333',
                          color: '#fff',
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span style={labelStyle}>GIF (선택)</span>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>용량이 큰 GIF는 로딩이 느려질 수 있어요.</div>
                <input
                  type="file"
                  accept="image/gif"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (gifPreview) URL.revokeObjectURL(gifPreview)
                    setGifFile(f)
                    setGifPreview(URL.createObjectURL(f))
                  }}
                />
                {gifPreview ? <img src={gifPreview} alt="" style={{ marginTop: 8, maxWidth: 120 }} /> : null}
              </div>
              <div>
                <span style={labelStyle}>영상 (선택, product-videos, 50MB 이하 권장)</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    if (videoPreview) URL.revokeObjectURL(videoPreview)
                    setVideoFile(f)
                    setVideoPreview(URL.createObjectURL(f))
                  }}
                />
                {videoPreview ? <video src={videoPreview} controls style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200 }} /> : null}
              </div>
            </div>
          )}

          {tab === 3 && (
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>에디터에서 이미지를 넣으면 Storage `products` 버킷에 올라갑니다 (어드민 상세와 동일).</div>
              <Editor
                key={draftIdRef.current}
                ref={editorRef}
                initialValue={detailHtml.trim() ? detailHtml : '<p></p>'}
                initialEditType="wysiwyg"
                hideModeSwitch
                height="420px"
                language="ko-KR"
                toolbarItems={[
                  ['heading', 'bold', 'italic'],
                  ['hr', 'image'],
                  ['ul', 'ol'],
                ]}
                hooks={{
                  addImageBlobHook: async (blob: any, callback: (url: string, alt: string) => void) => {
                    const file = blob
                    const ext = file?.name?.split?.('.')?.pop?.() || 'jpg'
                    const path = `brand-detail/${draftIdRef.current}/${Date.now()}.${ext}`
                    const { error: upErr } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                    if (upErr) {
                      setMsg(upErr.message || '이미지 업로드 실패')
                      return
                    }
                    const {
                      data: { publicUrl },
                    } = supabase.storage.from('products').getPublicUrl(path)
                    callback(publicUrl, '상세')
                  },
                }}
                onChange={() => {
                  try {
                    const html = editorRef.current?.getInstance()?.getHTML?.() || ''
                    setDetailHtml(html)
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </div>
          )}

          {tab === 4 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <span style={labelStyle}>전성분</span>
                <textarea value={fullIngredient} onChange={e => setFullIngredient(e.target.value)} style={{ ...inputStyle, minHeight: 100 }} />
                <input
                  ref={ingredientPhotoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={e => {
                    ingredientPhotoFileRef.current = e.target.files?.[0] ?? null
                    setIngredientAnalyzeDone(false)
                    setIngredientPhotoUrl('')
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
                    {(ingredientPhotoFileRef.current || ingredientPhotoUrl) && (
                      <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', maxWidth: 200 }}>
                        <img
                          src={
                            ingredientPhotoFileRef.current
                              ? URL.createObjectURL(ingredientPhotoFileRef.current)
                              : ingredientPhotoUrl
                          }
                          alt="전성분 사진"
                          style={{ width: '100%', borderRadius: 8, opacity: 0.85 }}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={ingredientAnalyzeLoading || ingredientAnalyzeDone}
                      onClick={() =>
                        void (async () => {
                          setIngredientAnalyzeLoading(true)
                          setIngredientAnalyzeDone(false)
                          setMsg('')
                          try {
                            const SKIN_TYPES = adminOpts.skinType.length
                              ? adminOpts.skinType
                              : ['건성', '지성', '복합성', '민감성', '중성', '모든피부']
                            const SKIN_CONCERNS = adminOpts.skinConcern.length
                              ? adminOpts.skinConcern
                              : ['수분부족', '트러블', '미백/톤업', '안티에이징', '모공', '각질', '민감', '탄력저하']
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
                                    '전성분을 읽고 아래 JSON만 반환해. 설명 없이.\nconcern_tags: 트러블/건조/탄력/미백/홍조/진정/호르몬케어 중 해당만.\nskin_tags: #건성 #지성 #복합성 #민감성 #탄력 #미백 #수분 #트러블 #모공 #홍조 #재생 #각질 #갱년기 #열감 #호르몬밸런스 #30대 #40대 #50대 #장벽강화 #펩타이드 #레티놀 #비타민C 중 해당만.\nhormone_timing: 생리기/여포기/배란기/황체기 중 해당만.\n{"concern_tags":[],"skin_tags":[],"hormone_timing":[]}',
                                },
                              ]
                            } else {
                              const text = fullIngredient.trim()
                              if (!text) {
                                setMsg('전성분 텍스트를 입력하거나 사진을 선택하세요')
                                setIngredientAnalyzeLoading(false)
                                return
                              }
                              content = `전성분: ${text}\n아래 JSON만 반환해. 설명 없이.\n{"concern_tags":["트러블/건조/탄력/미백/홍조/진정/호르몬케어 중 해당"],"skin_tags":["#건성 #지성 #복합성 #민감성 #탄력 #미백 #수분 #트러블 #모공 #홍조 #재생 #각질 #갱년기 #열감 #호르몬밸런스 #30대 #40대 #50대 #장벽강화 #펩타이드 #레티놀 #비타민C 중 해당"],"hormone_timing":["생리기/여포기/배란기/황체기 중 해당"]}`
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
                            setSkinConcernsPick(nextC)
                            setSkinTypesPick(nextS)
                            if (htStr) setHormoneTimingProduct(htStr)
                            if (ingredientPhotoFileRef.current) {
                              const file = ingredientPhotoFileRef.current
                              const ext = file.name.split('.').pop()
                              const path = `ingredient-photos/${Date.now()}.${ext}`
                              const { data: upData } = await supabase.storage
                                .from('products')
                                .upload(path, file, { upsert: true })
                              if (upData) {
                                const { data: urlData } = supabase.storage.from('products').getPublicUrl(path)
                                setIngredientPhotoUrl(urlData.publicUrl)
                              }
                            }
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
                        border: `1px solid ${ACC}`,
                        background: ingredientAnalyzeLoading ? 'rgba(123,94,167,0.12)' : 'rgba(123,94,167,0.22)',
                        color: '#e4daf5',
                        fontSize: 12,
                        cursor: ingredientAnalyzeLoading ? 'wait' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {ingredientAnalyzeLoading ? '분석 중…' : ingredientAnalyzeDone ? '✓ 분석 완료' : 'AI 자동 분석'}
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
                            borderTopColor: 'rgba(123,94,167,0.85)',
                            borderRadius: '50%',
                            animation: 'auranIngSpin 0.75s linear infinite',
                            flexShrink: 0,
                          }}
                        />
                      </>
                    ) : null}
                    {ingredientAnalyzeDone ? (
                      <span style={{ fontSize: 12, color: '#c4b0e6' }}>✓ 분석 완료</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div>
                <span style={labelStyle}>KEY INGREDIENTS (최대 5)</span>
                {keyIngs.map(k => (
                  <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 1fr 48px', gap: 6, marginBottom: 8 }}>
                    <input value={k.emoji} onChange={e => setKeyIngs(prev => prev.map(x => (x.id === k.id ? { ...x, emoji: e.target.value } : x)))} style={inputStyle} placeholder="이모지" />
                    <input value={k.name} onChange={e => setKeyIngs(prev => prev.map(x => (x.id === k.id ? { ...x, name: e.target.value } : x)))} style={inputStyle} placeholder="성분명" />
                    <input value={k.effect} onChange={e => setKeyIngs(prev => prev.map(x => (x.id === k.id ? { ...x, effect: e.target.value } : x)))} style={inputStyle} placeholder="효능" />
                    <button
                      type="button"
                      onClick={() => setKeyIngs(prev => prev.filter(x => x.id !== k.id))}
                      style={{ fontSize: 11, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
                    >
                      삭제
                    </button>
                  </div>
                ))}
                {keyIngs.length < 5 ? (
                  <button
                    type="button"
                    onClick={() => setKeyIngs(prev => [...prev, { id: uid(), emoji: '', name: '', effect: '' }])}
                    style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, border: `1px dashed ${ACC}`, background: 'transparent', color: '#c4b0e6', cursor: 'pointer' }}
                  >
                    + 추가
                  </button>
                ) : null}
              </div>
              <div>
                <span style={labelStyle}>
                  임상결과 (선택){' '}
                  <span title="브랜드 내부 검증·클레임 문구를 정리해 주세요." style={{ cursor: 'help', color: ACC }}>
                    ?
                  </span>
                </span>
                <textarea value={clinical} onChange={e => setClinical(e.target.value)} style={{ ...inputStyle, minHeight: 72 }} />
              </div>
              <div>
                <span style={labelStyle}>
                  주의사항 / 알러지 (선택){' '}
                  <span title="알레르기 유발 성분·사용 제한 등을 적어 주세요." style={{ cursor: 'help', color: ACC }}>
                    ?
                  </span>
                </span>
                <textarea value={allergyNote} onChange={e => setAllergyNote(e.target.value)} style={{ ...inputStyle, minHeight: 72 }} />
              </div>
              <div>
                <span style={labelStyle}>
                  인증서 이미지 (선택, 최대 3){' '}
                  <span title="기능성 화장품 심사 등 관련 서류 스캔본." style={{ cursor: 'help', color: ACC }}>
                    ?
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => {
                    const arr = Array.from(e.target.files || []).slice(0, 3 - certImageFiles.length)
                    setCertImageFiles(prev => {
                      const n = [...prev]
                      for (const file of arr) {
                        if (n.length >= 3) break
                        n.push({ id: uid(), file, preview: URL.createObjectURL(file) })
                      }
                      return n
                    })
                  }}
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {certImageFiles.map(c => (
                    <div key={c.id} style={{ position: 'relative' }}>
                      <img src={c.preview} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(c.preview)
                          setCertImageFiles(prev => prev.filter(x => x.id !== c.id))
                        }}
                        style={{ position: 'absolute', top: -4, right: -4, border: 'none', background: '#333', color: '#fff', borderRadius: 999, width: 18, height: 18, cursor: 'pointer', fontSize: 10 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 5 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <span style={labelStyle}>상품군</span>
                <input value={productGroup} onChange={e => setProductGroup(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>품명</span>
                <input value={summaryName} onChange={e => setSummaryName(e.target.value)} style={inputStyle} placeholder="표기용 품명 (없으면 제품명과 동일 가능)" />
              </div>
              <div>
                <span style={labelStyle}>제조국 (필수)</span>
                <input value={summaryCountry} onChange={e => setSummaryCountry(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>사용기한</span>
                <input value={useByDate} onChange={e => setUseByDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>수입사</span>
                <input value={importer} onChange={e => setImporter(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>A/S 연락처</span>
                <input value={asContact} onChange={e => setAsContact(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <span style={labelStyle}>화장품법 인증</span>
                <div>
                  {adminOpts.certType.map(s => (
                    <span key={s} role="button" tabIndex={0} style={chip(certTypesPick.includes(s))} onClick={() => toggleStr(certTypesPick, s, setCertTypesPick)}>
                      {s}
                    </span>
                  ))}
                </div>
                <input value={certCustom} onChange={e => setCertCustom(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} placeholder="직접 추가" />
              </div>
            </div>
          )}

          {tab === 6 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                <div style={{ fontSize: 13, color: '#e0d8ef', marginBottom: 8 }}>입력 요약</div>
                <div>제품명: {name || '—'}</div>
                <div>브랜드: {brandName}</div>
                <div>납품가: {supplyPrice || '—'}</div>
                <div>시중가: {retailPrice || '—'}</div>
                <div>썸네일: {thumbFile ? '첨부됨' : '미첨부'}</div>
                <div>상세: {detailHtml.trim() ? '작성됨' : '비어 있음'}</div>
              </div>
              <div>
                <span style={{ ...labelStyle, fontSize: 13 }}>체크리스트</span>
                {checklist.map(c => (
                  <div key={c.k} style={{ fontSize: 12, color: c.ok ? '#9bd4a8' : c.level === 'req' ? '#e0a0a0' : 'rgba(255,255,255,0.45)', marginBottom: 4 }}>
                    [{c.level === 'req' ? '필수' : '선택'}] {c.k}: {c.ok ? '완료' : '미완료'}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={busy || !requiredOk}
                onClick={() => void submitFinal()}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `1px solid ${ACC}`,
                  background: requiredOk ? 'rgba(123,94,167,0.35)' : 'rgba(255,255,255,0.06)',
                  color: requiredOk ? '#f3ecff' : 'rgba(255,255,255,0.35)',
                  fontSize: 14,
                  cursor: requiredOk && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? '처리 중…' : '최종 승인 요청'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
