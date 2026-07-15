'use client'

import dynamic from 'next/dynamic'
import { useRef, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import { uploadToStorage, uploadVideoToStorage } from '@/lib/product/productFormUtils'

const ProductDetailEditor = dynamic(() => import('@/components/admin/ProductDetailEditor'), { ssr: false })

type Props = {
  thumbImages: (string | null)[]
  setThumbImages: Dispatch<SetStateAction<(string | null)[]>>
  videoUrl: string
  setVideoUrl: (value: string) => void
  detailContent: string
  setDetailContent: (value: string) => void
  detailImages: string[]
  setDetailImages: Dispatch<SetStateAction<string[]>>
  ensureWorkingProduct: () => Promise<string | null>
}

const S = {
  sec: { background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 12 } as CSSProperties,
  secTitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 } as CSSProperties,
  lbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4, display: 'block' } as CSSProperties,
}

export default function BrandProductMediaSection({
  thumbImages,
  setThumbImages,
  videoUrl,
  setVideoUrl,
  detailContent,
  setDetailContent,
  detailImages,
  setDetailImages,
  ensureWorkingProduct,
}: Props) {
  const fileRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null])
  const videoRef = useRef<HTMLInputElement>(null)
  const detailFileRef = useRef<HTMLInputElement>(null)

  const uploadThumb = async (slot: number, file: File) => {
    const productId = await ensureWorkingProduct()
    if (!productId) return
    const ext = file.name.split('.').pop() || 'jpg'
    const url = await uploadToStorage(file, `edit/${productId}/${slot}-${Date.now()}.${ext}`)
    setThumbImages(prev => {
      const next = [...prev]
      next[slot] = url
      return next
    })
  }

  const uploadVideo = async (file: File) => {
    const productId = await ensureWorkingProduct()
    if (!productId) return
    const ext = file.name.split('.').pop() || 'mp4'
    const url = await uploadVideoToStorage(file, `edit/${productId}/video-${Date.now()}.${ext}`)
    setVideoUrl(url)
  }

  const uploadDetailImage = async (file: File) => {
    const productId = await ensureWorkingProduct()
    if (!productId) return
    const ext = file.name.split('.').pop() || 'jpg'
    const url = await uploadVideoToStorage(file, `edit/${productId}/detail-${Date.now()}.${ext}`)
    setDetailImages(prev => [...prev, url])
  }

  const uploadEditorAsset = async (file: File, kind: 'image' | 'video') => {
    const productId = await ensureWorkingProduct()
    if (!productId) return ''
    const ext = file.name.split('.').pop() || (kind === 'image' ? 'jpg' : 'mp4')
    const path = `edit/${productId}/editor${kind === 'video' ? '-video' : ''}-${Date.now()}.${ext}`
    return kind === 'image'
      ? uploadToStorage(file, path)
      : uploadVideoToStorage(file, path)
  }

  return (
    <>
      <div style={S.sec}>
        <div style={S.secTitle}>상품 이미지</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
          {thumbImages.map((url, i) => (
            <div key={i} style={{ position: 'relative', aspectRatio: '1' }} draggable={!!url}
              onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const from = Number(e.dataTransfer.getData('text/plain'))
                if (from === i) return
                setThumbImages(prev => {
                  const next = [...prev]
                  const tmp = next[from]
                  next[from] = next[i]
                  next[i] = tmp
                  return next
                })
              }}>
              <div onClick={() => { if (!url) fileRefs.current[i]?.click() }}
                style={{ width: '100%', height: '100%', background: i === 0 ? 'rgba(123,94,167,0.06)' : 'rgba(255,255,255,0.04)', border: `0.5px dashed ${i === 0 ? 'rgba(123,94,167,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: url ? 'grab' : 'pointer', overflow: 'hidden' }}>
                {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10, color: i === 0 ? 'rgba(196,167,231,0.6)' : 'rgba(255,255,255,0.25)' }}>{i === 0 ? '대표' : '+'}</span>}
              </div>
              {url && <button type="button" onClick={e => { e.stopPropagation(); setThumbImages(prev => { const next = [...prev]; next[i] = null; return next }) }}
                style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>}
              {url && i === 0 && <div style={{ position: 'absolute', bottom: 3, left: 3, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(123,94,167,0.7)', color: '#fff' }}>대표</div>}
              <input ref={el => { fileRefs.current[i] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const file = e.target.files?.[0]; if (file) void uploadThumb(i, file) }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>드래그로 순서 변경 · × 버튼으로 삭제</div>
        <div style={{ background: 'rgba(255,180,0,0.04)', border: '0.5px dashed rgba(255,180,0,0.2)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(255,180,0,0.5)' }} onClick={() => videoRef.current?.click()}>
          {videoUrl ? '영상 업로드됨 ✓' : '+ 영상 업로드'}
          <input ref={videoRef} type="file" accept="video/*" style={{ display: 'none' }}
            onChange={e => { const file = e.target.files?.[0]; if (file) void uploadVideo(file) }} />
        </div>
      </div>

      <div style={S.sec}>
        <div style={S.secTitle}>상세 설명</div>
        <ProductDetailEditor
          value={detailContent}
          onChange={setDetailContent}
          onImageUpload={(file) => uploadEditorAsset(file, 'image')}
          onVideoUpload={(file) => uploadEditorAsset(file, 'video')}
        />
        <div style={{ marginTop: 10 }}>
          <span style={S.lbl}>상세 이미지</span>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px dashed rgba(255,255,255,0.1)', borderRadius: 8, padding: 14, textAlign: 'center', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.25)' }} onClick={() => detailFileRef.current?.click()}>
            + 상세 이미지 업로드 (여러 장 가능)
            <input ref={detailFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => { Array.from(e.target.files || []).forEach(file => void uploadDetailImage(file)) }} />
          </div>
          {detailImages.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {detailImages.map((url, i) => (
                <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', cursor: 'pointer' }} draggable
                  onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    const from = Number(e.dataTransfer.getData('text/plain'))
                    if (from === i) return
                    setDetailImages(prev => {
                      const next = [...prev]
                      const tmp = next[from]
                      next[from] = next[i]
                      next[i] = tmp
                      return next
                    })
                  }}>
                  <img src={url} alt={`상세 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button type="button" onClick={e => { e.stopPropagation(); setDetailImages(prev => prev.filter((_, j) => j !== i)) }}
                    style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                  <div style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.6)' }}>{i + 1}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
