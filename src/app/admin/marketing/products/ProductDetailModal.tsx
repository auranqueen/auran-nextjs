'use client'

import ProductThumbnail from '@/components/ui/ProductThumbnail'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type TabKey = 'thumb' | 'basic' | 'detail' | 'points' | 'flash'

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
    points: '💰 포인트',
    flash: '⚡ 타임세일',
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
}: {
  product: any
  tab: 'pending' | 'active' | 'rejected'
  busyId: string | null
  brands: { id: string; name: string }[]
  onClose: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onToast: (msg: string) => void
  onProductUpdated: (p: any) => void
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
  })
  const mark = useCallback((k: TabKey, v: boolean) => {
    setDirty(d => ({ ...d, [k]: v }))
  }, [])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const extraGalleryInputRef = useRef<HTMLInputElement>(null)
  const detailFilesRef = useRef<HTMLInputElement>(null)

  const [thumbPreview, setThumbPreview] = useState<string | null>(null)
  const [thumbUploading, setThumbUploading] = useState(false)
  const [thumbHover, setThumbHover] = useState(false)
  const [galleryImgUrls, setGalleryImgUrls] = useState<string[]>([])
  const [galleryGifUrl, setGalleryGifUrl] = useState<string | null>(null)
  const [galleryVideoUrl, setGalleryVideoUrl] = useState<string | null>(null)
  const [galleryBusy, setGalleryBusy] = useState(false)

  const [nameDraft, setNameDraft] = useState(String(product.name || ''))
  const [priceDraft, setPriceDraft] = useState(String(product.retail_price ?? ''))
  const [brandId, setBrandId] = useState(String(product.brand_id || ''))
  const [descDraft, setDescDraft] = useState(String(product.description || ''))

  const [detailContent, setDetailContent] = useState(String(product.detail_content || ''))
  const [detailImages, setDetailImages] = useState<string[]>(
    Array.isArray(product.detail_images) && product.detail_images.length
      ? product.detail_images
      : Array.isArray(product.detail_imgs)
        ? product.detail_imgs
        : []
  )
  const [detailPreview, setDetailPreview] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)

  const [earnPercent, setEarnPercent] = useState(Number(product.earn_points ?? 0))
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

  const thumbDisplay = thumbPreview || product.thumb_img || product.storage_thumb_url || '/og-image.png'

  useEffect(() => {
    setThumbPreview(null)
    const ti = Array.isArray(product.thumb_images) ? ([...(product.thumb_images as string[])] as string[]) : []
    const g = ti.find(u => /\.gif($|\?)/i.test(String(u).trim())) || null
    const rest = ti.filter(u => u !== g)
    setGalleryImgUrls(rest.slice(0, 5))
    setGalleryGifUrl(g)
    setGalleryVideoUrl(typeof product.video_url === 'string' && product.video_url.trim() ? product.video_url.trim() : null)
    setNameDraft(String(product.name || ''))
    setPriceDraft(String(product.retail_price ?? ''))
    setBrandId(String(product.brand_id || ''))
    setDescDraft(String(product.description || ''))
    setDetailContent(String(product.detail_content || ''))
    setDetailImages(
      Array.isArray(product.detail_images) && product.detail_images.length
        ? product.detail_images
        : Array.isArray(product.detail_imgs)
          ? product.detail_imgs
          : []
    )
    setEarnPercent(Number(product.earn_points ?? 0))
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
    setTimesaleSaving(false)
    setDirty({ thumb: false, basic: false, detail: false, points: false, flash: false })
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

  const debouncedSaveNamePrice = useMemo(
    () =>
      debounce(async (field: 'name' | 'retail_price', value: string) => {
        const p = productRef.current
        const id = p.id
        const payload =
          field === 'name'
            ? { name: value.trim() }
            : { retail_price: Math.max(0, Math.floor(Number(value) || 0)) }
        const { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error) {
          onToastRef.current(error.message || '저장 실패')
          return
        }
        onToastRef.current('✅ 저장됨')
        onProductUpdatedRef.current({
          ...p,
          ...(field === 'name'
            ? { name: value.trim() }
            : {
                retail_price: Math.max(0, Math.floor(Number(value) || 0)),
                price: Math.max(0, Math.floor(Number(value) || 0)),
              }),
        })
      }, 1000),
    [supabase]
  )

  const requestClose = () => {
    if (hasDirty) {
      if (!window.confirm('저장하지 않은 변경사항이 있어요. 닫을까요?')) return
    }
    onClose()
  }

  const saveBasic = async () => {
    const { error } = await supabase
      .from('products')
      .update({
        name: nameDraft.trim(),
        retail_price: Math.max(0, Math.floor(Number(priceDraft) || 0)),
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
    onProductUpdated({
      ...product,
      name: nameDraft.trim(),
      retail_price: Math.max(0, Math.floor(Number(priceDraft) || 0)),
      brand_id: brandId || null,
      description: descDraft.trim() || null,
      brands: brands.find(b => b.id === brandId) ? { name: brands.find(b => b.id === brandId)!.name } : product.brands,
    })
  }

  const saveDetail = async () => {
    setDetailSaving(true)
    const imgs = [...detailImages]
    const { error } = await supabase
      .from('products')
      .update({
        detail_content: detailContent.trim() || null,
        detail_images: imgs,
        detail_imgs: imgs,
      })
      .eq('id', product.id)
    setDetailSaving(false)
    if (error) {
      onToast(error.message || '저장 실패')
      return
    }
    mark('detail', false)
    onToast('✅ 상세내용 저장됨')
    onProductUpdated({ ...product, detail_content: detailContent, detail_images: imgs, detail_imgs: imgs })
  }

  const savePoints = async () => {
    setPointsSaving(true)
    const { error } = await supabase
      .from('products')
      .update({
        earn_points: Math.max(0, Math.min(100, Math.floor(earnPercent))),
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
    onToast('✅ 포인트 설정 저장됨')
    onProductUpdated({
      ...product,
      earn_points: Math.max(0, Math.min(100, Math.floor(earnPercent))),
      share_points: Math.max(0, Math.floor(sharePoints)),
      review_points_text: Math.max(0, Math.floor(textReviewPts)),
      review_points_photo: Math.max(0, Math.floor(photoPoints)),
      review_points_video: Math.max(0, Math.floor(videoPoints)),
    })
  }

  const applyDefaults = () => {
    setEarnPercent(1)
    setSharePoints(50)
    setTextReviewPts(100)
    setPhotoPoints(300)
    setVideoPoints(500)
    mark('points', true)
  }

  const insertImageMarkdown = (url: string) => {
    const isVid = /\.mp4($|\?)/i.test(url)
    const line = isVid
      ? `\n<video src="${url}" controls playsInline style="max-width:100%;border-radius:8px;"></video>\n`
      : `\n![](${url})\n`
    setDetailContent(c => c + line)
    mark('detail', true)
  }

  const removeDetailImage = (idx: number) => {
    setDetailImages(arr => arr.filter((_, i) => i !== idx))
    mark('detail', true)
  }

  const exampleEarn = useMemo(() => {
    const p = Math.max(0, Math.floor(Number(priceDraft) || 0))
    const pct = Math.max(0, Math.min(100, Math.floor(earnPercent)))
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
          {(['thumb', 'basic', 'detail', 'points', 'flash'] as TabKey[]).map(t => (
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
                const file = e.target.files?.[0]
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
                const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                if (error) {
                  onToast(error.message || '업로드 실패')
                  setThumbUploading(false)
                  return
                }
                const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
                const newUrl = pub.publicUrl
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
                onProductUpdated({ ...product, thumb_img: newUrl, storage_thumb_url: newUrl })
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
                  for (const file of files) {
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
                      const safe = file.name.replace(/[^\w.\-가-힣]/g, '_')
                      const path = `thumbnails/${product.id}/${Date.now()}_${safe}`
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
                      onProductUpdated({ ...product, thumb_images: tArr, video_url: vid })
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
                      onProductUpdated({ ...product, thumb_images: tArr, video_url: vid || null })
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
                    onProductUpdated({ ...product, thumb_images: tArr, video_url: vid || null })
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
                        onProductUpdated({ ...product, thumb_images: tArr, video_url: galleryVideoUrl || null })
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
                        onProductUpdated({ ...product, thumb_images: tArr, video_url: galleryVideoUrl || null })
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
                        onProductUpdated({ ...product, thumb_images: tArr, video_url: null })
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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => detailFilesRef.current?.click()}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '8px 14px',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                이미지 추가 (다중)
              </button>
              <button
                type="button"
                onClick={() => setDetailPreview(v => !v)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '8px 14px',
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                미리보기 {detailPreview ? '끄기' : '켜기'}
              </button>
            </div>
            <input
              ref={detailFilesRef}
              type="file"
              accept="image/*,image/gif,video/mp4"
              multiple
              className="hidden"
              style={{ display: 'none' }}
              onChange={async e => {
                const files = Array.from(e.target.files || [])
                const inputEl = e.target
                inputEl.value = ''
                const urls: string[] = []
                const IMG_MAX = 20 * 1024 * 1024
                const VID_MAX = 50 * 1024 * 1024
                for (const file of files) {
                  const isVid = file.type.startsWith('video/') || /\.mp4$/i.test(file.name)
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
                  } else if (file.size > IMG_MAX) {
                    onToast('이미지는 20MB, 영상은 50MB 이하만 가능합니다')
                    continue
                  }
                  const safe = file.name.replace(/[^\w.\-가-힣]/g, '_')
                  const path = `detail/${product.id}/${Date.now()}_${safe}`
                  const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true })
                  if (error) {
                    onToast(error.message || '업로드 실패')
                    continue
                  }
                  const { data: pub } = supabase.storage.from('products').getPublicUrl(path)
                  urls.push(pub.publicUrl)
                }
                if (urls.length === 0) {
                  onToast('파일 업로드에 실패했습니다')
                  return
                }
                const updated = [...detailImages, ...urls]
                setDetailImages(updated)
                urls.forEach(insertImageMarkdown)
                mark('detail', true)
                onToast(`✅ ${urls.length}개 추가됨 · 상세 저장으로 확정`)
              }}
            />
            {detailImages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
                {detailImages.map((u, i) => (
                  <div key={`${u}-${i}`} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                    {/\.mp4($|\?)/i.test(u) ? (
                      <video
                        src={u}
                        muted
                        playsInline
                        style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={u} alt="" style={{ width: '100%', height: 72, objectFit: 'cover', display: 'block' }} />
                    )}
                    <button
                      type="button"
                      onClick={() => removeDetailImage(i)}
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
              </div>
            )}
            {detailPreview ? (
              <div
                style={{
                  minHeight: 120,
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.65,
                }}
              >
                {detailContent || '(내용 없음)'}
              </div>
            ) : (
              <textarea
                value={detailContent}
                onChange={e => {
                  setDetailContent(e.target.value)
                  mark('detail', true)
                }}
                placeholder="상세 설명을 입력하세요. 이미지 추가 시 URL이 본문에 삽입됩니다."
                style={{
                  width: '100%',
                  minHeight: 200,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#fff',
                  fontSize: 13,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            )}
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
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 14 }}>💰 포인트 설정</div>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              구매 적립 포인트 — 구매금액의{' '}
              <input
                type="number"
                min={0}
                max={100}
                value={earnPercent}
                onChange={e => {
                  setEarnPercent(Number(e.target.value))
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
              예) ₩{Math.max(0, Math.floor(Number(priceDraft) || 0)).toLocaleString()} 구매 시 약 {exampleEarn.toLocaleString()}P 적립
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
              공유 포인트 (표시용)
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
              P
            </label>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 8 }}>리뷰 포인트</div>
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
              P
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
              P
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
              P
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
                  onProductUpdated({
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
                  onProductUpdated({
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
          {listTab === 'pending' && (
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
          {listTab === 'rejected' && (
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
