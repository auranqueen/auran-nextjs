'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

type LocalFile = { id: string; file: File; previewUrl: string; uploading: boolean; uploadedUrl?: string; error?: string }

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

async function fileToPublicUrl(supabase: any, bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl as string
}

export default function BrandNewProductPage() {
  const supabase = createClient()
  const router = useRouter()

  const [me, setMe] = useState<any | null>(null)
  const [brand, setBrand] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [retailPrice, setRetailPrice] = useState('0')
  const [stock, setStock] = useState('0')
  const [ingredient, setIngredient] = useState('')
  const [category, setCategory] = useState('')
  const [detailHtml, setDetailHtml] = useState('')

  const [thumb, setThumb] = useState<LocalFile | null>(null)
  const [images, setImages] = useState<LocalFile[]>([])
  const [video, setVideo] = useState<LocalFile | null>(null)

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=brand')
        return
      }
      const { data: u } = await supabase.from('users').select('id,role,email,name').eq('auth_id', user.id).maybeSingle()
      setMe(u || null)
      const { data: b } = u?.id ? await supabase.from('brands').select('*').eq('user_id', u.id).maybeSingle() : { data: null }
      setBrand(b || null)
      setLoading(false)
    }
    run()
  }, [router, supabase])

  const canUpload = useMemo(() => {
    return !!me?.id && me?.role === 'brand' && !!brand?.id
  }, [brand?.id, me?.id, me?.role])

  const pickThumb = (file: File | null) => {
    if (!file) return
    if (thumb) URL.revokeObjectURL(thumb.previewUrl)
    setThumb({ id: uid(), file, previewUrl: URL.createObjectURL(file), uploading: false })
  }

  const addImages = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    const next = arr.map(f => ({ id: uid(), file: f, previewUrl: URL.createObjectURL(f), uploading: false })) as LocalFile[]
    setImages(prev => [...prev, ...next].slice(0, 5))
  }

  const removeImage = (id: string) => {
    setImages(prev => {
      const x = prev.find(p => p.id === id)
      if (x) URL.revokeObjectURL(x.previewUrl)
      return prev.filter(p => p.id !== id)
    })
  }

  const pickVideo = (file: File | null) => {
    if (!file) return
    if (video) URL.revokeObjectURL(video.previewUrl)
    setVideo({ id: uid(), file, previewUrl: URL.createObjectURL(file), uploading: false })
  }

  const uploadOne = async (f: LocalFile, kind: 'thumb' | 'image' | 'video') => {
    if (!brand?.id) return null
    const bucket = kind === 'video' ? 'product-videos' : 'products'
    const ext = (f.file.name.split('.').pop() || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase()
    const path = `${brand.id}/${kind}/${Date.now()}_${f.id}.${ext}`

    const setState = (patch: Partial<LocalFile>) => {
      if (kind === 'thumb') setThumb(prev => (prev?.id === f.id ? { ...prev, ...patch } as any : prev))
      else if (kind === 'video') setVideo(prev => (prev?.id === f.id ? { ...prev, ...patch } as any : prev))
      else setImages(prev => prev.map(x => (x.id === f.id ? { ...x, ...patch } : x)))
    }

    setState({ uploading: true, error: undefined })
    const { error } = await supabase.storage.from(bucket).upload(path, f.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: f.file.type || undefined,
    })
    if (error) {
      setState({ uploading: false, error: error.message })
      return null
    }
    const url = await fileToPublicUrl(supabase, bucket, path)
    setState({ uploading: false, uploadedUrl: url })
    return url
  }

  const submit = async () => {
    if (!canUpload) return
    if (!thumb?.file) {
      alert('대표 이미지를 추가해주세요.')
      return
    }
    if (!name.trim()) {
      alert('제품명을 입력해주세요.')
      return
    }
    if (images.length > 5) {
      alert('추가 이미지는 최대 5장까지 가능합니다.')
      return
    }

    setSaving(true)
    try {
      const thumbUrl = thumb.uploadedUrl || (await uploadOne(thumb, 'thumb'))
      if (!thumbUrl) {
        alert('대표 이미지 업로드에 실패했습니다.')
        return
      }

      const detailUrls: string[] = []
      for (const img of images) {
        if (img.uploadedUrl) {
          detailUrls.push(img.uploadedUrl)
          continue
        }
        const u = await uploadOne(img, 'image')
        if (!u) {
          alert('추가 이미지 업로드에 실패했습니다.')
          return
        }
        detailUrls.push(u)
      }

      let videoUrl: string | null = null
      if (video?.file) {
        videoUrl = video.uploadedUrl || (await uploadOne(video, 'video'))
        if (!videoUrl) {
          alert('동영상 업로드에 실패했습니다.')
          return
        }
      }

      const res = await fetch('/api/brand/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          retail_price: Number(retailPrice || '0'),
          stock: Number(stock || '0'),
          ingredient: ingredient.trim(),
          category: category.trim() || null,
          thumb_img: thumbUrl,
          detail_imgs: detailUrls,
          detail_html: detailHtml,
          video_url: videoUrl,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.ok) {
        alert(json?.error || '등록에 실패했습니다.')
        return
      }
      alert('✅ 신규 제품이 등록되었습니다. 심사 후 노출됩니다.')
      router.push('/dashboard/brand')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '8px 10px', color: '#fff', fontSize: 12 }}>←</button>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>신규 제품 업로드</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NoticeBell />
          <button onClick={submit} disabled={saving || loading || !canUpload} style={{ background: 'rgba(201,168,76,0.14)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: 10, padding: '8px 10px', color: 'var(--gold)', fontSize: 12, fontWeight: 900, opacity: saving ? 0.7 : 1 }}>
            {saving ? '저장중...' : '등록'}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 18px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : !canUpload ? (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14, color: 'var(--text3)', fontSize: 12, lineHeight: 1.7 }}>
            브랜드 계정으로 로그인되어 있고, 브랜드 정보가 있어야 업로드할 수 있습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10 }}>대표 이미지</div>
              <input type="file" accept="image/*" onChange={e => pickThumb(e.target.files?.[0] || null)} />
              {thumb?.previewUrl && (
                <div style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb.previewUrl} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>추가 이미지 (최대 5장)</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{images.length}/5</div>
              </div>
              <input type="file" accept="image/*" multiple onChange={e => addImages(e.target.files)} />
              {images.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {images.map(img => (
                    <div key={img.id} style={{ position: 'relative', width: 92, height: 92, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.10)', flex: '0 0 auto' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button onClick={() => removeImage(img.id)} style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 999, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 12 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10 }}>짧은 동영상 (선택)</div>
              <input type="file" accept="video/*" onChange={e => pickVideo(e.target.files?.[0] || null)} />
              {video?.file ? (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>{video.file.name}</div>
              ) : null}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10 }}>기본 정보</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="제품명" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="한 줄 설명(선택)" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input value={retailPrice} onChange={e => setRetailPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="소비자가(원)" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                  <input value={stock} onChange={e => setStock(e.target.value.replace(/[^0-9]/g, ''))} placeholder="재고(선택)" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                </div>
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="카테고리(선택)" style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12 }} />
                <textarea value={ingredient} onChange={e => setIngredient(e.target.value)} placeholder="주요성분/특징(선택)" rows={3} style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 11px', color: '#fff', fontSize: 12, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 10 }}>상세페이지(HTML)</div>
              <textarea
                value={detailHtml}
                onChange={e => setDetailHtml(e.target.value)}
                placeholder="<p>상세 설명...</p>"
                rows={10}
                style={{
                  width: '100%',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 11px',
                  color: '#fff',
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  resize: 'vertical',
                }}
              />
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
                기본은 HTML 입력 형태로 제공됩니다. (원하시면 에디터 형태로도 바꿔드릴게요.)
              </div>
            </div>
          </div>
        )}
      </div>

      <DashboardBottomNav role="brand" />
    </div>
  )
}

