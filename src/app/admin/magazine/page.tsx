'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/imageUpload'

const CATS = ['피부케어', '성분', '루틴', '브랜드', '원장님픽'] as const

type PublishMode = 'draft' | 'now' | 'scheduled'

export default function AdminMagazinePage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<{ open: boolean; row: any | null }>({ open: false, row: null })
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [category, setCategory] = useState<string>(CATS[0])
  const [content, setContent] = useState('')
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState('')
  const [publishMode, setPublishMode] = useState<PublishMode>('draft')
  const [scheduleAt, setScheduleAt] = useState('')
  const [productTags, setProductTags] = useState<string[]>([])
  const [prodSearch, setProdSearch] = useState('')
  const [prodHits, setProdHits] = useState<any[]>([])
  const [kpi, setKpi] = useState({ total: 0, published: 0, views: 0 })

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('magazines' as any).select('*').order('created_at', { ascending: false }).limit(200)
      const list = (data as any[]) || []
      setRows(list)
      const published = list.filter((r) => r.is_published)
      setKpi({
        total: list.length,
        published: published.length,
        views: list.reduce((a, r) => a + Number(r.view_count || 0), 0),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openNew = () => {
    setModal({ open: true, row: null })
    setTitle('')
    setSubtitle('')
    setCategory(CATS[0])
    setContent('')
    setThumbFile(null)
    setThumbPreview('')
    setPublishMode('draft')
    setScheduleAt('')
    setProductTags([])
    setProdSearch('')
    setProdHits([])
  }

  const openEdit = (r: any) => {
    setModal({ open: true, row: r })
    setTitle(String(r.title || ''))
    setSubtitle(String(r.subtitle || ''))
    setCategory((CATS as readonly string[]).includes(String(r.category)) ? String(r.category) : CATS[0])
    setContent(String(r.content || ''))
    setThumbFile(null)
    setThumbPreview(String(r.thumbnail_url || ''))
    setPublishMode(r.is_published ? 'now' : 'draft')
    const tags = r.product_tags
    setProductTags(Array.isArray(tags) ? tags.map((x: any) => String(x)) : [])
    setProdSearch('')
    setProdHits([])
    if (r.published_at) {
      const d = new Date(r.published_at)
      setScheduleAt(d.toISOString().slice(0, 16))
    } else {
      setScheduleAt('')
    }
  }

  const searchProducts = async () => {
    const q = prodSearch.trim()
    if (!q) {
      setProdHits([])
      return
    }
    const { data } = await supabase
      .from('products')
      .select('id,name,retail_price,sale_price')
      .ilike('name', `%${q}%`)
      .limit(15)
    setProdHits((data as any[]) || [])
  }

  const addTag = (id: string) => {
    if (productTags.includes(id) || productTags.length >= 5) return
    setProductTags((t) => [...t, id])
  }

  const removeTag = (id: string) => setProductTags((t) => t.filter((x) => x !== id))

  const uploadThumb = async (magId: string) => {
    if (!thumbFile) return thumbPreview || null
    let f = thumbFile
    f = await compressImage(f, 'magazine')
    const path = `thumb_${magId}`
    const { error } = await supabase.storage.from('magazine').upload(path, f, { upsert: true })
    if (error) return thumbPreview || null
    const { data } = supabase.storage.from('magazine').getPublicUrl(path)
    return data.publicUrl || null
  }

  const save = async () => {
    const magId = modal.row?.id || crypto.randomUUID()
    let publishedAt: string | null = null
    let isPublished = false
    if (publishMode === 'now') {
      isPublished = true
      publishedAt = new Date().toISOString()
    } else if (publishMode === 'scheduled' && scheduleAt) {
      isPublished = true
      publishedAt = new Date(scheduleAt).toISOString()
    } else {
      isPublished = false
      publishedAt = modal.row?.published_at || null
    }

    const thumbUrl = (await uploadThumb(magId)) || thumbPreview || null

    const payload: any = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      category,
      thumbnail_url: thumbUrl,
      content,
      product_tags: productTags,
      is_published: isPublished,
      published_at: publishedAt,
    }

    if (modal.row?.id) {
      await supabase.from('magazines' as any).update(payload).eq('id', modal.row.id)
    } else {
      await supabase.from('magazines' as any).insert({ ...payload, id: magId } as any)
    }
    setModal({ open: false, row: null })
    setToast('저장됐어요 💜')
    void load()
  }

  const del = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('magazines' as any).delete().eq('id', id)
    setToast('삭제됐어요')
    void load()
  }

  const togglePublish = async (r: any) => {
    const next = !r.is_published
    await supabase
      .from('magazines' as any)
      .update({
        is_published: next,
        published_at: next ? r.published_at || new Date().toISOString() : r.published_at,
      } as any)
      .eq('id', r.id)
    void load()
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>전체 글</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{kpi.total}</div>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>발행된 글</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: 'var(--green)' }}>{kpi.published}</div>
        </div>
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>총 조회수</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: 'var(--gold)' }}>{kpi.views.toLocaleString()}</div>
        </div>
      </div>

      <button type="button" className="btn btn-gr" onClick={openNew} style={{ marginBottom: 16 }}>
        + 새 글 작성
      </button>

      {loading ? (
        <div style={{ color: 'var(--text3)' }}>불러오는 중…</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}
            >
              <div style={{ width: 72, height: 54, borderRadius: 8, overflow: 'hidden', background: 'var(--bg3)', flexShrink: 0 }}>
                {r.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {r.category} · 조회 {Number(r.view_count || 0).toLocaleString()} · {r.is_published ? '발행' : '임시'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{r.published_at ? new Date(r.published_at).toLocaleString('ko-KR') : '-'}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button type="button" className="btn btn-bl" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => openEdit(r)}>
                  수정
                </button>
                <button type="button" className="btn btn-re" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => void del(r.id)}>
                  삭제
                </button>
                <button type="button" className="btn btn-gy" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => void togglePublish(r)}>
                  {r.is_published ? '발행취소' : '발행'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 18,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>{modal.row ? '글 수정' : '새 글'}</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13 }}
            />
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="부제목"
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13 }}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 13 }}
            >
              {CATS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>썸네일</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setThumbFile(f || null)
                if (f) setThumbPreview(URL.createObjectURL(f))
                else if (modal.row?.thumbnail_url) setThumbPreview(String(modal.row.thumbnail_url))
                else setThumbPreview('')
              }}
              style={{ marginBottom: 8, fontSize: 12 }}
            />
            {thumbPreview ? (
              <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', marginBottom: 10, background: 'var(--bg3)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : null}
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>본문 (HTML 또는 마크다운)</div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={20} style={{ width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 12, fontFamily: 'monospace' }} />

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>제품 태그 (최대 5)</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder="제품명 검색"
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 12 }}
                />
                <button type="button" className="btn btn-bl" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => void searchProducts()}>
                  검색
                </button>
              </div>
              <button type="button" className="btn btn-gy" style={{ fontSize: 11, marginBottom: 8, padding: '6px 10px' }} onClick={() => void searchProducts()}>
                + 제품 태그
              </button>
              {prodHits.length > 0 ? (
                <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                  {prodHits.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addTag(String(p.id))}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}
                    >
                      {p.name} — ₩
                      {Number(
                        Number(p.sale_price ?? 0) > 0 ? p.sale_price : p.retail_price ?? 0
                      ).toLocaleString()}
                    </button>
                  ))}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {productTags.map((tid) => (
                  <span key={tid} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, background: 'rgba(123,94,167,0.2)', color: '#c4a7e7' }}>
                    {tid.slice(0, 8)}…{' '}
                    <button type="button" onClick={() => removeTag(tid)} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer' }}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>발행 설정</div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
                <input type="radio" checked={publishMode === 'draft'} onChange={() => setPublishMode('draft')} /> 임시저장
              </label>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
                <input type="radio" checked={publishMode === 'now'} onChange={() => setPublishMode('now')} /> 즉시 발행
              </label>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>
                <input type="radio" checked={publishMode === 'scheduled'} onChange={() => setPublishMode('scheduled')} /> 예약 발행
              </label>
              {publishMode === 'scheduled' ? (
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  style={{ marginTop: 6, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontSize: 12 }}
                />
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-gy" style={{ flex: 1 }} onClick={() => setModal({ open: false, row: null })}>
                닫기
              </button>
              <button type="button" className="btn btn-gr" style={{ flex: 2 }} onClick={() => void save()}>
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, zIndex: 300 }}>
          {toast}
        </div>
      ) : null}
    </div>
  )
}
