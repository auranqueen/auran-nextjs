'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ReviewFormProps = {
  productId: string
  onSuccess: () => void
}

const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'
const BG = '#0D0B09'

const CONCERNS = [
  '수분감 좋아요',
  '트러블 진정',
  '발림성 좋아요',
  '향이 좋아요',
  '지속력 좋아요',
  '피부톤 개선',
  '탄력 향상',
  '자극 없어요',
  '재구매 의사',
]

export function ReviewForm({ productId, onSuccess }: ReviewFormProps) {
  const supabase = createClient()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [helpfulConcerns, setHelpfulConcerns] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const canSubmit = useMemo(() => rating > 0 && content.trim().length >= 10 && !submitting, [rating, content, submitting])

  const toggleConcern = (value: string) => {
    setHelpfulConcerns(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
  }

  const onPickImages = (selected: FileList | null) => {
    const next = Array.from(selected || []).slice(0, 3)
    setFiles(next)
    setPreviewUrls(next.map(file => URL.createObjectURL(file)))
  }

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) {
        setToastMsg('로그인이 필요해요')
        setTimeout(() => setToastMsg(''), 1800)
        setSubmitting(false)
        return
      }

      const uploadedUrls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `reviews/${productId}/${userId}-${Date.now()}-${i}.${ext}`
        const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
        if (!error) {
          const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          uploadedUrls.push(`${base}/storage/v1/object/public/product-images/${path}`)
        }
      }

      const reviewType = uploadedUrls.length > 0 ? 'photo' : 'general'
      const { error: insertError } = await supabase.from('reviews').insert({
        target_id: productId,
        author_id: userId,
        review_type: reviewType,
        rating,
        content: content.trim(),
        images: uploadedUrls,
        helpful_concerns: helpfulConcerns,
        status: '게시',
        is_best: false,
        helpful_count: 0,
      })
      if (insertError) throw insertError

      setRating(0)
      setContent('')
      setHelpfulConcerns([])
      setFiles([])
      setPreviewUrls([])
      onSuccess()
      setToastMsg('리뷰가 등록됐어요! 🎉')
      setTimeout(() => setToastMsg(''), 1800)
    } catch {
      setToastMsg('리뷰 등록에 실패했어요')
      setTimeout(() => setToastMsg(''), 1800)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: BG, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 10 }}>리뷰 작성</div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            style={{
              border: 'none',
              background: 'transparent',
              color: n <= rating ? GOLD : 'rgba(255,255,255,0.3)',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ★
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {CONCERNS.map(item => {
          const selected = helpfulConcerns.includes(item)
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggleConcern(item)}
              style={{
                padding: '8px 10px',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.08)',
                background: selected ? PURPLE : 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {item}
            </button>
          )
        })}
      </div>

      <textarea
        placeholder="솔직한 리뷰를 남겨주세요 (최소 10자)"
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={5}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(255,255,255,0.05)',
          color: '#fff',
          fontSize: 13,
          resize: 'vertical',
          marginBottom: 10,
          boxSizing: 'border-box',
        }}
      />

      <input type="file" accept="image/*" multiple onChange={e => onPickImages(e.target.files)} style={{ marginBottom: 10, color: '#fff' }} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
        {previewUrls.map((url, i) => (
          <img key={i} src={url} alt="" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }} />
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 10,
          border: 'none',
          background: GOLD,
          color: '#0D0B09',
          fontWeight: 800,
          fontSize: 14,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        리뷰 등록하기
      </button>

      {toastMsg ? <div style={{ marginTop: 10, color: '#fff', fontSize: 12 }}>{toastMsg}</div> : null}
    </div>
  )
}
