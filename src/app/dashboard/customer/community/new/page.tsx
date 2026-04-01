'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserProfile } from '@/hooks/useUserProfile'

const BG = '#0D0B09'
const CARD_BG = 'rgba(255,255,255,0.03)'
const BORDER = '1px solid rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

type CategoryId = 'skin' | 'review' | 'salon' | 'routine' | 'qa' | 'menopause'

const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'skin', label: '피부고민' },
  { id: 'review', label: '제품리뷰' },
  { id: 'salon', label: '살롱후기' },
  { id: 'routine', label: '스킨루틴' },
  { id: 'qa', label: 'Q&A' },
  { id: 'menopause', label: '갱년기' },
]

type MediaItem = {
  id: string
  file: File
  previewUrl: string
  kind: 'image' | 'video'
}

type ProductLite = { id: string; name: string; thumb_img?: string | null; retail_price?: number | null }

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function isVideoFile(f: File) {
  return f.type.startsWith('video/')
}

function toKoreanSkinType(raw: string | null | undefined) {
  const v = String(raw || '').trim()
  if (v === 'dry') return '건성'
  if (v === 'oily') return '지성'
  if (v === 'combination') return '복합성'
  if (v === 'sensitive') return '민감성'
  if (v === 'normal') return '정상'
  return v
}

export default function CommunityNewPostPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const { profile } = useUserProfile()

  const [category, setCategory] = useState<CategoryId>('skin')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [productTags, setProductTags] = useState<ProductLite[]>([])
  const [productModal, setProductModal] = useState(false)
  const [productQ, setProductQ] = useState('')
  const [productResults, setProductResults] = useState<ProductLite[]>([])
  const [productLoading, setProductLoading] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [hideSkinTypeGuide, setHideSkinTypeGuide] = useState(false)

  useEffect(() => {
    return () => {
      media.forEach((m) => URL.revokeObjectURL(m.previewUrl))
    }
  }, [media])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) {
        router.replace('/login?role=customer')
        return
      }
      setAuthUserId(auth.user.id)
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      if (!urow?.id) {
        router.replace('/login?role=customer')
        return
      }
      setInternalUserId(urow.id)
    }
    void run()
  }, [router, supabase])

  const imageCount = useMemo(() => media.filter((m) => m.kind === 'image').length, [media])
  const videoCount = useMemo(() => media.filter((m) => m.kind === 'video').length, [media])

  const addHashtag = (raw: string) => {
    const t = raw.trim().replace(/^#+/, '').replace(/\s+/g, '')
    if (!t || hashtags.length >= 10) return
    if (hashtags.includes(t)) return
    setHashtags((prev) => [...prev, t])
  }

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addHashtag(tagInput)
      setTagInput('')
    }
  }

  const pickFiles = () => fileRef.current?.click()

  const onFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    let next = [...media]
    for (const f of arr) {
      const kind = isVideoFile(f) ? 'video' : 'image'
      if (kind === 'video') {
        if (next.some((m) => m.kind === 'video')) continue
        if (next.filter((m) => m.kind === 'image').length >= 9) continue
        next.push({ id: uid(), file: f, previewUrl: URL.createObjectURL(f), kind: 'video' })
        continue
      }
      if (next.filter((m) => m.kind === 'image').length >= 9) break
      next.push({ id: uid(), file: f, previewUrl: URL.createObjectURL(f), kind: 'image' })
    }
    setMedia(next)
  }

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const m = prev.find((x) => x.id === id)
      if (m) URL.revokeObjectURL(m.previewUrl)
      return prev.filter((x) => x.id !== id)
    })
  }

  const openProductModal = useCallback(async () => {
    setProductModal(true)
    if (productResults.length > 0) return
    setProductLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id,name,thumb_img,retail_price,status')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(80)
    setProductResults(
      ((data || []) as any[]).map((p) => ({ id: p.id, name: p.name, thumb_img: p.thumb_img, retail_price: p.retail_price }))
    )
    setProductLoading(false)
  }, [productResults.length, supabase])

  const filteredProducts = useMemo(() => {
    const s = productQ.trim().toLowerCase()
    if (!s) return productResults
    return productResults.filter((p) => (p.name || '').toLowerCase().includes(s))
  }, [productQ, productResults])

  const toggleProduct = (p: ProductLite) => {
    setProductTags((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev.filter((x) => x.id !== p.id)
      if (prev.length >= 3) return prev
      return [...prev, p]
    })
  }

  const uploadMedia = async (): Promise<string[]> => {
    if (!authUserId) throw new Error('로그인이 필요해요')
    const urls: string[] = []
    const ts = Date.now()
    let imgIdx = 0
    for (const m of media) {
      if (m.kind === 'image') {
        const path = `images/${authUserId}/${ts}_${imgIdx}`
        imgIdx += 1
        const { error } = await supabase.storage.from('community').upload(path, m.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: m.file.type || undefined,
        })
        if (error) throw error
        const { data } = supabase.storage.from('community').getPublicUrl(path)
        if (data?.publicUrl) urls.push(data.publicUrl)
      } else {
        const path = `videos/${authUserId}/${ts}`
        const { error } = await supabase.storage.from('community').upload(path, m.file, {
          cacheControl: '3600',
          upsert: false,
          contentType: m.file.type || undefined,
        })
        if (error) throw error
        const { data } = supabase.storage.from('community').getPublicUrl(path)
        if (data?.publicUrl) urls.push(data.publicUrl)
      }
    }
    return urls
  }

  const submit = async () => {
    if (!internalUserId || !authUserId) return
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    try {
      const image_urls = await uploadMedia()
      const { error } = await supabase.from('posts').insert({
        user_id: internalUserId,
        category,
        skin_type: profile?.skin_type || null,
        title: title.trim(),
        content: content.trim(),
        image_urls: image_urls.length ? image_urls : null,
        hashtags,
        product_tags: productTags.map((p) => p.id),
        likes: 0,
        views: 0,
        is_public: isPublic,
        created_at: new Date().toISOString(),
      } as any)
      if (error) throw error
      setToast('게시글이 등록됐어요 💜')
      setTimeout(() => router.push('/community'), 600)
    } catch {
      setToast('등록 중 오류가 발생했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', maxWidth: 390, margin: '0 auto', paddingBottom: 100 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(13,11,9,0.92)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
          <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', fontWeight: 500 }}>
            ←
          </button>
          <div style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>글 쓰기</div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8, fontWeight: 500 }}>카테고리</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' as const }}>
          {CATEGORIES.map((c) => {
            const active = c.id === category
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1px solid ${active ? 'rgba(123,94,167,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(123,94,167,0.2)' : CARD_BG,
                  color: active ? '#e8d6ff' : TEXT_MUTED,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {profile?.skin_type ? (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(123,94,167,0.06)',
              border: '1px solid rgba(123,94,167,0.2)',
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 14, lineHeight: 1 }}>✨</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: '#c4a7e7' }}>{toKoreanSkinType(profile.skin_type)} 피부로 작성돼요</div>
              <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.5)', marginTop: 2 }}>내 피부타입이 자동 적용돼요</div>
              {Array.isArray(profile.skin_concerns) && profile.skin_concerns.length > 0 ? (
                <div style={{ fontSize: 10, color: 'rgba(196,167,231,0.4)', marginTop: 2 }}>고민: {profile.skin_concerns.join(' · ')}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => router.push('/my/profile')}
              style={{ fontSize: 10, color: 'rgba(196,167,231,0.4)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 20, padding: '3px 8px', background: 'transparent', cursor: 'pointer' }}
            >
              변경
            </button>
          </div>
        ) : !hideSkinTypeGuide ? (
          <div
            style={{
              marginTop: 16,
              background: 'rgba(123,94,167,0.08)',
              border: '1px solid rgba(123,94,167,0.2)',
              borderRadius: 12,
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, color: '#c4a7e7', lineHeight: 1.4 }}>피부타입 설정하면 더 정확한 추천 받아요 💜</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => router.push('/my/profile')}
                style={{ border: '1px solid rgba(123,94,167,0.4)', background: 'transparent', color: '#c4a7e7', borderRadius: 8, padding: '5px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 500 }}
              >
                설정하기
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('hide_skintype_banner', 'true')
                  setHideSkinTypeGuide(true)
                }}
                style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={(e) => onFiles(e.target.files)} />
          <button
            type="button"
            onClick={pickFiles}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: BORDER,
              background: CARD_BG,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            📸 사진/영상 추가
          </button>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 6, fontWeight: 500 }}>사진 최대 9장 · 영상 최대 1개 (9:16 권장)</div>
        </div>

        {media.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
            {media.map((m) => (
              <div key={m.id} style={{ position: 'relative' }}>
                {m.kind === 'image' ? (
                  <div style={{ width: '100%', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                    <img src={m.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '9/16', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                    <video src={m.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(m.id)}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    border: 'none',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer',
                    lineHeight: 1,
                    fontWeight: 500,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ fontSize: 11, color: TEXT_MUTED, margin: '16px 0 6px', fontWeight: 500 }}>제목</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력해주세요"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: 12,
            background: CARD_BG,
            border: BORDER,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            fontWeight: 500,
          }}
        />

        <div style={{ fontSize: 11, color: TEXT_MUTED, margin: '14px 0 6px', fontWeight: 500 }}>내용</div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="피부 고민, 제품 후기, 루틴을 공유해보세요 💜"
          rows={6}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: 12,
            background: CARD_BG,
            border: BORDER,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            resize: 'none',
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        />

        <div style={{ fontSize: 11, color: TEXT_MUTED, margin: '14px 0 6px', fontWeight: 500 }}>해시태그</div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={onTagKeyDown}
          placeholder="#해시태그 입력 후 Enter"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 14px',
            borderRadius: 12,
            background: CARD_BG,
            border: BORDER,
            color: '#fff',
            fontSize: 12,
            outline: 'none',
            fontWeight: 500,
          }}
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {hashtags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setHashtags((prev) => prev.filter((x) => x !== t))}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid rgba(201,169,110,0.3)',
                background: 'rgba(201,169,110,0.1)',
                color: GOLD,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              #{t}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={() => void openProductModal()}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: BORDER,
              background: CARD_BG,
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            🧴 제품 태그하기
          </button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {productTags.map((p) => (
              <span
                key={p.id}
                style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, background: 'rgba(123,94,167,0.15)', color: '#d4c4f0', fontWeight: 500 }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setIsPublic(true)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${isPublic ? 'rgba(123,94,167,0.45)' : 'rgba(255,255,255,0.08)'}`,
              background: isPublic ? 'rgba(123,94,167,0.15)' : CARD_BG,
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            🌍 전체공개
          </button>
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${!isPublic ? 'rgba(123,94,167,0.45)' : 'rgba(255,255,255,0.08)'}`,
              background: !isPublic ? 'rgba(123,94,167,0.15)' : CARD_BG,
              color: '#fff',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            🔒 나만보기
          </button>
        </div>

        <button
          type="button"
          disabled={saving || !title.trim() || !content.trim()}
          onClick={() => void submit()}
          style={{
            width: '100%',
            marginTop: 22,
            padding: '14px 16px',
            borderRadius: 14,
            border: 'none',
            background: title.trim() && content.trim() ? PURPLE : 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: title.trim() && content.trim() ? 'pointer' : 'default',
          }}
        >
          {saving ? '등록 중…' : '등록하기 💜'}
        </button>
      </div>

      {productModal ? (
        <>
          <div onClick={() => setProductModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 90 }} />
          <div
            style={{
              position: 'fixed',
              left: '50%',
              top: '45%',
              transform: 'translate(-50%, -50%)',
              width: 'min(340px, 92vw)',
              maxHeight: '70vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#1a1520',
              border: '1px solid rgba(123,94,167,0.35)',
              borderRadius: 16,
              zIndex: 100,
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 14, fontWeight: 500 }}>제품 검색</div>
            <div style={{ padding: 10 }}>
              <input
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
                placeholder="제품명 검색"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: CARD_BG,
                  border: BORDER,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  fontWeight: 500,
                }}
              />
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '0 10px 12px' }}>
              {productLoading ? (
                <div style={{ fontSize: 12, color: TEXT_MUTED, padding: 12, fontWeight: 500 }}>불러오는 중…</div>
              ) : (
                filteredProducts.map((p) => {
                  const sel = productTags.some((x) => x.id === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 8px',
                        marginBottom: 6,
                        borderRadius: 10,
                        border: sel ? '1px solid rgba(123,94,167,0.5)' : '1px solid rgba(255,255,255,0.06)',
                        background: sel ? 'rgba(123,94,167,0.12)' : 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {p.name}
                    </button>
                  )
                })
              )}
            </div>
            <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={() => setProductModal(false)}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: PURPLE, color: '#fff', fontWeight: 500, cursor: 'pointer' }}
              >
                닫기
              </button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 100,
            transform: 'translateX(-50%)',
            maxWidth: 'min(320px, 90vw)',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(30,25,35,0.95)',
            border: '1px solid rgba(123,94,167,0.35)',
            color: '#fff',
            fontSize: 13,
            zIndex: 200,
            textAlign: 'center',
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
