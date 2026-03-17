'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0a0a0a'
const CARD = '#1a1a1a'
const BORDER = '#2a2a2a'
const GOLD = '#c9a84c'

const CATEGORIES = [
  { id: 'skin', label: '피부고민' },
  { id: 'review', label: '제품리뷰' },
  { id: 'salon', label: '살롱후기' },
  { id: 'routine', label: '스킨루틴' },
  { id: 'qa', label: 'Q&A' },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

type LocalImage = {
  id: string
  file: File
  previewUrl: string
  uploading: boolean
  uploadedUrl?: string
  error?: string
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export default function CommunityWritePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [category, setCategory] = useState<CategoryId>('skin')
  const [images, setImages] = useState<LocalImage[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [me, setMe] = useState<{ id: string; name?: string | null } | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) {
        router.replace('/login?role=customer')
        return
      }
      const { data } = await supabase.from('users').select('id,name').eq('auth_id', auth.user.id).single()
      if (!data?.id) {
        router.replace('/login?role=customer')
        return
      }
      setMe({ id: data.id, name: data.name })
    }
    run()
  }, [router, supabase])

  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = useMemo(() => {
    if (saving) return false
    if (!me?.id) return false
    if (!title.trim()) return false
    if (!content.trim()) return false
    if (images.some(i => i.uploading)) return false
    if (images.some(i => i.error)) return false
    return true
  }, [content, images, me?.id, saving, title])

  const addTag = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    const normalized = t.startsWith('#') ? t : `#${t}`
    const cleaned = normalized.replace(/\s+/g, '')
    if (cleaned.length < 2) return
    setHashtags(prev => (prev.includes(cleaned) ? prev : [...prev, cleaned].slice(0, 20)))
  }

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(tagInput)
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && hashtags.length > 0) {
      setHashtags(prev => prev.slice(0, -1))
    }
  }

  const removeTag = (t: string) => setHashtags(prev => prev.filter(x => x !== t))

  const pickImages = () => fileRef.current?.click()

  const onFiles = (files: FileList | null) => {
    if (!files) return
    const current = images.length
    const incoming = Array.from(files)
    const remaining = Math.max(0, 5 - current)
    const selected = incoming.slice(0, remaining)
    if (selected.length === 0) return

    const next = selected.map(f => ({
      id: uid(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      uploading: false,
    })) as LocalImage[]
    setImages(prev => [...prev, ...next])
  }

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(x => x.id === id)
      if (img) URL.revokeObjectURL(img.previewUrl)
      return prev.filter(x => x.id !== id)
    })
  }

  const uploadOne = async (img: LocalImage, userId: string) => {
    const ext = img.file.name.split('.').pop() || 'jpg'
    const path = `community/${userId}/${Date.now()}_${img.id}.${ext}`

    setImages(prev => prev.map(x => (x.id === img.id ? { ...x, uploading: true, error: undefined } : x)))
    const { error } = await supabase.storage.from('community').upload(path, img.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: img.file.type || undefined,
    })
    if (error) {
      setImages(prev => prev.map(x => (x.id === img.id ? { ...x, uploading: false, error: error.message } : x)))
      return null
    }
    const { data } = supabase.storage.from('community').getPublicUrl(path)
    const url = data?.publicUrl
    setImages(prev => prev.map(x => (x.id === img.id ? { ...x, uploading: false, uploadedUrl: url } : x)))
    return url
  }

  const submit = async () => {
    if (!me?.id) return
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }
    if (images.length > 5) {
      alert('이미지는 최대 5장까지 가능합니다.')
      return
    }

    setSaving(true)
    try {
      const urls: string[] = []
      for (const img of images) {
        if (img.uploadedUrl) {
          urls.push(img.uploadedUrl)
          continue
        }
        const u = await uploadOne(img, me.id)
        if (!u) {
          alert('이미지 업로드에 실패했습니다.')
          return
        }
        urls.push(u)
      }

      const { error } = await supabase.from('posts').insert({
        user_id: me.id,
        category,
        title: title.trim(),
        content: content.trim(),
        image_urls: urls,
        hashtags,
        created_at: new Date().toISOString(),
      })
      if (error) {
        alert(error.message)
        return
      }
      router.push('/dashboard/customer/community')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', paddingBottom: 28 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', fontSize: 18, cursor: 'pointer', padding: 6 }}
            aria-label="뒤로가기"
          >
            ‹
          </button>
          <div style={{ fontSize: 14, fontWeight: 900 }}>글쓰기</div>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              background: 'transparent',
              border: 'none',
              color: canSubmit ? GOLD : 'rgba(201,168,76,0.45)',
              fontWeight: 900,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              padding: 6,
              fontSize: 13,
            }}
          >
            완료
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 14px 0' }}>
        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {CATEGORIES.map(c => {
            const active = c.id === category
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                style={{
                  flexShrink: 0,
                  padding: '9px 12px',
                  borderRadius: 999,
                  background: active ? 'rgba(201,168,76,0.16)' : CARD,
                  border: `1px solid ${active ? 'rgba(201,168,76,0.35)' : BORDER}`,
                  color: active ? GOLD : 'rgba(255,255,255,0.72)',
                  fontWeight: 900,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Image uploader */}
        <div style={{ marginTop: 14, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '12px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,0.9)' }}>이미지</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{images.length}/5</div>
          </div>

          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              onClick={pickImages}
              disabled={images.length >= 5 || saving}
              style={{
                width: 72,
                height: 72,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.04)',
                border: `1px dashed ${BORDER}`,
                color: images.length >= 5 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.70)',
                cursor: images.length >= 5 || saving ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 20 }}>📷</div>
              <div style={{ fontSize: 10, fontWeight: 800 }}>추가</div>
            </button>

            {images.map(img => (
              <div key={img.id} style={{ position: 'relative', width: 72, height: 72, borderRadius: 14, overflow: 'hidden', border: `1px solid ${BORDER}`, background: '#111', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => removeImage(img.id)}
                  disabled={saving || img.uploading}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: `1px solid ${BORDER}`,
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    cursor: saving || img.uploading ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    lineHeight: '20px',
                  }}
                  aria-label="이미지 삭제"
                >
                  ×
                </button>
                {img.uploading ? (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: GOLD }}>
                    업로드…
                  </div>
                ) : img.error ? (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.70)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, fontSize: 10, color: '#ff7b7b', textAlign: 'center' }}>
                    실패
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={e => onFiles(e.target.files)}
            style={{ display: 'none' }}
          />
        </div>

        {/* Title */}
        <div style={{ marginTop: 14, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '12px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>제목</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            style={{ width: '100%', padding: '12px 12px', borderRadius: 14, background: '#141414', border: `1px solid ${BORDER}`, color: '#fff', outline: 'none', fontSize: 13 }}
          />
        </div>

        {/* Content */}
        <div style={{ marginTop: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '12px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>내용</div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={'내용을 입력하세요\n피부 고민, 제품 후기를 자유롭게 나눠요'}
            rows={8}
            style={{ width: '100%', padding: '12px 12px', borderRadius: 14, background: '#141414', border: `1px solid ${BORDER}`, color: '#fff', outline: 'none', fontSize: 13, resize: 'none', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}
          />
        </div>

        {/* Hashtags */}
        <div style={{ marginTop: 12, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '12px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>해시태그</div>
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={onTagKeyDown}
            placeholder="#태그 형식, 엔터로 추가"
            style={{ width: '100%', padding: '12px 12px', borderRadius: 14, background: '#141414', border: `1px solid ${BORDER}`, color: '#fff', outline: 'none', fontSize: 13 }}
          />
          {hashtags.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {hashtags.map(t => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.28)', color: GOLD, fontSize: 12, fontWeight: 900 }}>
                  <span>{t}</span>
                  <button onClick={() => removeTag(t)} style={{ border: 'none', background: 'transparent', color: GOLD, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 24 }} />
      </div>

      {/* Saving overlay */}
      {saving && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.70)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '14px 16px', color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 900 }}>
            저장 중…
          </div>
        </div>
      )}
    </div>
  )
}

