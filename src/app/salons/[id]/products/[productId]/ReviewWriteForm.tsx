'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
const BORDER = 'rgba(255,255,255,0.08)'
const CARD = 'rgba(255,255,255,0.05)'
const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
interface Props {
  orderId: string
  brandProductId: string
  onDone: () => void
}
export default function ReviewWriteForm({ orderId, brandProductId, onDone }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - imageFiles.length)
    setImageFiles(prev => [...prev, ...files].slice(0, 3))
  }
  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setVideoFile(file)
  }
  const handleSubmit = async () => {
    if (rating === 0) { setError('별점을 선택해주세요'); return }
    if (content.trim().length < 10) { setError('리뷰를 10자 이상 작성해주세요'); return }
    setUploading(true)
    setError(null)
    try {
      const imageUrls: string[] = []
      for (const file of imageFiles) {
        const path = `reviews/brand/${brandProductId}/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, file)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        imageUrls.push(data.publicUrl)
      }
      let videoUrl: string | null = null
      if (videoFile) {
        const path = `reviews/brand/videos/${brandProductId}/${Date.now()}-${videoFile.name}`
        const { error: upErr } = await supabase.storage.from('product-images').upload(path, videoFile)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        videoUrl = data.publicUrl
      }
      setUploading(false)
      setSubmitting(true)
      const res = await fetch('/api/brand-product-reviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          brand_product_id: brandProductId,
          rating, content, images: imageUrls, video_url: videoUrl,
        }),
      }).then(r => r.json())
      if (!res.ok) {
        setError(res.error === 'review_already_exists' ? '이미 리뷰를 작성했어요' : '리뷰 등록에 실패했어요')
        setSubmitting(false)
        return
      }
      router.refresh()
      onDone()
    } catch (e) {
      setError('업로드 중 문제가 발생했어요')
      setUploading(false)
      setSubmitting(false)
    }
  }
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => setRating(n)}
            style={{ border: 'none', background: 'transparent', fontSize: 22, color: n <= rating ? GOLD : 'rgba(255,255,255,0.2)', padding: 0, cursor: 'pointer' }}
          >★</button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="제품 사용 후기를 남겨주세요 (10자 이상)"
        rows={4}
        style={{ width: '100%', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, color: '#fff', fontSize: 13, resize: 'none', marginBottom: 12 }}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {imageFiles.map((f, i) => (
          <div key={i} style={{ width: 56, height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
        {imageFiles.length < 3 && (
          <label style={{ width: 56, height: 56, borderRadius: 8, border: `1px dashed ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB, fontSize: 20, cursor: 'pointer' }}>
            +
            <input type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: 'none' }} />
          </label>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        {videoFile ? (
          <div style={{ fontSize: 12, color: TEXT_SUB }}>{videoFile.name} 선택됨</div>
        ) : (
          <label style={{ fontSize: 12, color: PURPLE, cursor: 'pointer' }}>
            + 영상 추가
            <input type="file" accept="video/*" onChange={handleVideoSelect} style={{ display: 'none' }} />
          </label>
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: '#F09595', marginBottom: 8 }}>{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={uploading || submitting}
        style={{ width: '100%', border: 'none', background: PURPLE, color: '#fff', borderRadius: 10, padding: 12, fontSize: 13 }}
      >
        {uploading ? '업로드 중...' : submitting ? '등록 중...' : '리뷰 등록'}
      </button>
    </div>
  )
}
