'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const TABS = ['기본정보', '옵션정보', '가격및재고', '포인트설정', '배송비', '상품이미지'] as const

const ORIGINS = ['프랑스', '이탈리아', '독일', '국산', '기타'] as const

type SaleUi = 'active' | 'sold_out' | 'discontinued' | 'paused'
type QtyUi = 'unlimited' | 'limited'
type PointMode = 'percent' | 'point' | 'won'

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
}

function parseAdminMeta(rows: string[] | null | undefined): { options: string; shippingFee: string; shippingMemo: string } {
  const raw = rows?.find(r => typeof r === 'string' && r.startsWith('__AURAN_ADMIN__'))
  if (!raw) return { options: '', shippingFee: '', shippingMemo: '' }
  try {
    const j = JSON.parse(raw.slice('__AURAN_ADMIN__'.length)) as {
      options?: string
      shipping?: { fee?: string; memo?: string }
    }
    return {
      options: j.options ?? '',
      shippingFee: j.shipping?.fee ?? '',
      shippingMemo: j.shipping?.memo ?? '',
    }
  } catch {
    return { options: '', shippingFee: '', shippingMemo: '' }
  }
}

function encodeAdminMeta(
  options: string,
  shippingFee: string,
  shippingMemo: string,
  existing: string[] | null | undefined
): string[] {
  const payload =
    '__AURAN_ADMIN__' +
    JSON.stringify({
      v: 1,
      options,
      shipping: { fee: shippingFee, memo: shippingMemo },
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

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([])

  const [name, setName] = useState('')
  const [shortDesc, setShortDesc] = useState('')
  const [keywords, setKeywords] = useState('')
  const [brandId, setBrandId] = useState('')
  const [origin, setOrigin] = useState<(typeof ORIGINS)[number]>('국산')
  const [manufacturer, setManufacturer] = useState('')
  const [saleUi, setSaleUi] = useState<SaleUi>('active')

  const [optionsText, setOptionsText] = useState('')

  const [retailPrice, setRetailPrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
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

  const fileRefs = useRef<(HTMLInputElement | null)[]>([])
  const videoRef = useRef<HTMLInputElement | null>(null)
  const workingIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabase
      .from('brands')
      .select('id,name')
      .order('name')
      .then(({ data }) => setBrands((data || []) as { id: string; name: string }[]))
  }, [supabase])

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
      const cat = String(p.category || '')
      setOrigin((ORIGINS as readonly string[]).includes(cat) ? (cat as (typeof ORIGINS)[number]) : '기타')
      setManufacturer(String(p.ingredient || ''))

      const { sale, qty, stockNum } = uiFromRow(p)
      setSaleUi(sale)
      setQtyUi(qty)
      setStockInput(String(stockNum))

      setRetailPrice(String(p.retail_price ?? ''))
      setSalePrice(p.sale_price != null && p.sale_price !== '' ? String(p.sale_price) : '')

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

      const thumbs = Array.isArray(p.thumb_images) && (p.thumb_images as string[]).length
        ? [...(p.thumb_images as string[])]
        : []
      while (thumbs.length < 5) thumbs.push('')
      setThumbImages(thumbs.slice(0, 5))
      setVideoUrl(String(p.video_url || ''))
      setDetailContent(String(p.detail_content || ''))

      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [editId, supabase])

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

  const uploadToStorage = useCallback(
    async (file: File, path: string) => {
      const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (error) throw error
      return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`
    },
    [supabase, supabaseUrl]
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

  const buildPayload = (pid: string, quizExisting: string[] | null | undefined) => {
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
    const quiz = encodeAdminMeta(optionsText, shipFee, shipMemo, quizExisting)

    return {
      brand_id: brandId || null,
      name: nameTrim || '이름 없음',
      description: shortDesc.trim() || null,
      tag: keywords.trim() || null,
      category: origin,
      ingredient: manufacturer.trim() || null,
      status,
      stock,
      retail_price: retail,
      sale_price: saleP,
      is_timesale: hasTs,
      timesale_starts_at: tsStart,
      timesale_ends_at: tsEnd,
      earn_points: earnPoints,
      earn_points_percent: earnPointsPercent,
      share_points: sharePts,
      review_points_text: rText,
      review_points_photo: rPhoto,
      review_points_video: rVideo,
      quiz_match: quiz,
      thumb_images: thumbsClean,
      thumb_img: thumbsClean[0] || null,
      storage_thumb_url: thumbsClean[0] || null,
      video_url: videoUrl.trim() || null,
      detail_content: detailContent.trim() || null,
      is_flash_sale: isFlashSaleState,
      updated_at: new Date().toISOString(),
    }
  }

  const onSave = async () => {
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
        const insertRow = {
          brand_id: brandId,
          name: name.trim().slice(0, 100) || '신규 상품',
          description: shortDesc.trim() || null,
          tag: keywords.trim() || null,
          category: origin,
          ingredient: manufacturer.trim() || null,
          status: 'pending' as const,
          stock: 0,
          retail_price: Math.max(0, Math.floor(Number(retailPrice) || 0)),
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

      const payload = buildPayload(pid!, existingQuiz)
      const { error: upErr } = await supabase.from('products').update(payload).eq('id', pid!)
      if (upErr) {
        setMsg(upErr.message || '저장 실패')
        setSaving(false)
        return
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
            <select
              value={brandId}
              onChange={e => setBrandId(e.target.value)}
              style={{ ...inputStyle, background: '#121212' }}
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
            <span style={labelStyle}>원산지</span>
            <select
              value={origin}
              onChange={e => setOrigin(e.target.value as (typeof ORIGINS)[number])}
              style={{ ...inputStyle, background: '#121212' }}
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
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={labelStyle}>판매가 (원)</span>
            <input
              value={salePrice}
              onChange={e => setSalePrice(e.target.value.replace(/[^0-9.]/g, ''))}
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
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          style={{
            width: '100%',
            padding: '14px 0',
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
          {saving ? '저장 중…' : editId ? '수정 저장' : '신규 저장'}
        </button>
      </div>
    </div>
  )
}
