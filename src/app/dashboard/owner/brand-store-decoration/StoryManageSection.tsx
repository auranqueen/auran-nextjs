'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { createClient } from '@/lib/supabase/client'

const GOLD = '#B08A46'
const GOLD_BG = '#FBF7EE'
const GOLD_BORDER = '#EFE3C8'
const PURPLE = '#7B5EA7'
const PURPLE_BG = '#F5F1FA'
const PURPLE_BORDER = '#E1D8F0'
const TEXT = '#1A1A2E'
const SUB = '#666666'
const CARD = '#ffffff'

type StoryType = 'treatment' | 'homecare'
type Mode = 'list' | 'pickType' | 'form'

type StoryRow = {
  id: string
  story_type: StoryType
  title: string
  content: string
  banner_image_url_pc: string | null
  banner_image_url_mobile: string | null
  is_published: boolean
  product_ids?: string[]
}

type SearchProduct = {
  id: string
  name: string
  thumb_img: string | null
  price: number | null
}

const TYPE_LABEL: Record<StoryType, string> = {
  treatment: '관리프로그램',
  homecare: '홈케어제품추천',
}

const fieldStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${GOLD_BORDER}`,
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  color: TEXT,
  background: CARD,
}

function StoryEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit v3 includes Link — do not add @tiptap/extension-link again
        link: {
          openOnClick: false,
          HTMLAttributes: { style: `color:${PURPLE}` },
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      attributes: {
        style: `min-height:160px;outline:none;padding:12px;font-size:13px;line-height:1.7;color:${TEXT}`,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) editor.commands.setContent(value || '')
  }, [value, editor])

  if (!editor) return null

  const toolBtn = (active: boolean): CSSProperties => ({
    width: 32,
    height: 32,
    borderRadius: 6,
    border: `1px solid ${active ? PURPLE : PURPLE_BORDER}`,
    background: active ? PURPLE_BG : CARD,
    color: active ? PURPLE : SUB,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  })

  return (
    <div style={{ border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, background: CARD, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, padding: 8, borderBottom: `1px solid ${GOLD_BORDER}`, background: PURPLE_BG }}>
        <button type="button" style={toolBtn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </button>
        <button type="button" style={toolBtn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button
          type="button"
          style={toolBtn(editor.isActive('link'))}
          onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined
            const url = window.prompt('링크 URL', prev || 'https://')
            if (url === null) return
            if (!url) {
              editor.chain().focus().unsetLink().run()
              return
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          }}
        >
          Link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export default function StoryManageSection({ salonId }: { salonId: string }) {
  const supabaseRef = useRef(createClient())
  const [mode, setMode] = useState<Mode>('list')
  const [stories, setStories] = useState<StoryRow[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [storyType, setStoryType] = useState<StoryType>('treatment')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [bannerPc, setBannerPc] = useState<string | null>(null)
  const [bannerMobile, setBannerMobile] = useState<string | null>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchProduct[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadStories = useCallback(async () => {
    setLoadingList(true)
    const res = await fetch('/api/brand-product-orders/story').then((r) => r.json())
    if (res.ok) setStories((res.stories as StoryRow[]) || [])
    setLoadingList(false)
  }, [])

  useEffect(() => {
    void loadStories()
  }, [loadStories])

  const runProductSearch = useCallback(async (q: string) => {
    setSearching(true)
    const res = await fetch(`/api/brand-product-orders/story/product-search?q=${encodeURIComponent(q)}`).then((r) =>
      r.json(),
    )
    if (res.ok) setSearchResults((res.products as SearchProduct[]) || [])
    else setSearchResults([])
    setSearching(false)
  }, [])

  useEffect(() => {
    if (mode !== 'form' || storyType !== 'homecare') return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      void runProductSearch(searchQ.trim())
    }, 280)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [mode, storyType, searchQ, runProductSearch])

  const resetForm = () => {
    setEditingId(null)
    setStoryType('treatment')
    setTitle('')
    setContent('')
    setBannerPc(null)
    setBannerMobile(null)
    setIsPublished(false)
    setSelectedIds([])
    setSearchQ('')
    setSearchResults([])
  }

  const openNew = () => {
    resetForm()
    setMode('pickType')
  }

  const openEdit = (s: StoryRow) => {
    setEditingId(s.id)
    setStoryType(s.story_type)
    setTitle(s.title || '')
    setContent(s.content || '')
    setBannerPc(s.banner_image_url_pc)
    setBannerMobile(s.banner_image_url_mobile)
    setIsPublished(Boolean(s.is_published))
    setSelectedIds(Array.isArray(s.product_ids) ? s.product_ids : [])
    setSearchQ('')
    setMode('form')
  }

  const uploadStoryBanner = async (file: File, target: 'pc' | 'mobile') => {
    setUploading(true)
    const sb = supabaseRef.current
    const path = `salon-stories/${salonId}/${target}-${Date.now()}-${file.name}`
    const { error } = await sb.storage.from('product-images').upload(path, file, { upsert: true })
    if (error) {
      setUploading(false)
      alert('업로드에 실패했어요')
      return
    }
    const { data } = sb.storage.from('product-images').getPublicUrl(path)
    const url = data.publicUrl || ''
    if (target === 'pc') {
      setBannerPc(url)
      if (!bannerMobile) setBannerMobile(url)
    } else {
      setBannerMobile(url)
      if (!bannerPc) setBannerPc(url)
    }
    setUploading(false)
  }

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      alert('제목을 입력해 주세요')
      return
    }
    setSaving(true)
    const payload = {
      salon_id: salonId,
      story_type: storyType,
      title: title.trim(),
      content,
      banner_image_url_pc: bannerPc,
      banner_image_url_mobile: bannerMobile,
      is_published: isPublished,
      product_ids: storyType === 'homecare' ? selectedIds : [],
    }
    const res = editingId
      ? await fetch('/api/brand-product-orders/story', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        }).then((r) => r.json())
      : await fetch('/api/brand-product-orders/story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then((r) => r.json())
    setSaving(false)
    if (!res.ok) {
      alert('저장에 실패했어요')
      return
    }
    resetForm()
    setMode('list')
    await loadStories()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('이 스토리를 삭제할까요?')) return
    const res = await fetch(`/api/brand-product-orders/story?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).then((r) => r.json())
    if (!res.ok) {
      alert('삭제에 실패했어요')
      return
    }
    await loadStories()
  }

  return (
    <div
      style={{
        background: GOLD_BG,
        border: `1px solid ${GOLD_BORDER}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        color: TEXT,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>스토리 관리</span>
        {mode === 'list' ? (
          <button
            type="button"
            onClick={openNew}
            style={{ border: 'none', background: PURPLE, color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            새 스토리 작성
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              resetForm()
              setMode('list')
            }}
            style={{ border: `1px solid ${PURPLE_BORDER}`, background: CARD, color: PURPLE, borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            목록으로
          </button>
        )}
      </div>

      {mode === 'pickType' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {(['treatment', 'homecare'] as StoryType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setStoryType(t)
                setMode('form')
                if (t === 'homecare') void runProductSearch('')
              }}
              style={{
                border: `1px solid ${PURPLE_BORDER}`,
                background: PURPLE_BG,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 13, color: PURPLE, fontWeight: 600, marginBottom: 4 }}>{TYPE_LABEL[t]}</div>
              <div style={{ fontSize: 11, color: SUB, lineHeight: 1.5 }}>
                {t === 'treatment' ? '시술·관리 프로그램을 소개해요' : '홈케어 제품을 골라 추천해요'}
              </div>
            </button>
          ))}
        </div>
      )}

      {mode === 'form' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${PURPLE_BORDER}`,
            background: CARD,
          }}
        >
          <div style={{ fontSize: 12, color: PURPLE }}>
            {TYPE_LABEL[storyType]} · {editingId ? '수정' : '새 글'}
          </div>

<div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>배너 이미지</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {(
                [
                  { key: 'pc' as const, label: 'PC용 배너 업로드', url: bannerPc, sizeHint: '1100×410px 권장' },
                  { key: 'mobile' as const, label: '모바일용 배너 업로드', url: bannerMobile, sizeHint: '480×180px 권장' },
                ] as const
              ).map((slot) => (
                <div key={slot.key} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: PURPLE, fontWeight: 600, marginBottom: 6 }}>
                    {slot.key === 'pc' ? 'PC용' : '모바일용'}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '2.7',
                      borderRadius: 10,
                      background: slot.url ? `url(${slot.url}) center/cover` : PURPLE_BG,
                      border: `1px dashed ${PURPLE_BORDER}`,
                      position: 'relative',
                    }}
                  >
                    <label
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: uploading ? 'wait' : 'pointer',
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) void uploadStoryBanner(f, slot.key)
                          e.target.value = ''
                        }}
                      />
                      {!slot.url && <span style={{ fontSize: 12, color: SUB, textAlign: 'center', padding: '0 8px' }}>{slot.label}</span>}
                    </label>
                  </div>
                  <div style={{ fontSize: 10, color: SUB, marginTop: 6, lineHeight: 1.4 }}>{slot.sizeHint}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: SUB, lineHeight: 1.6, marginTop: 8 }}>
              하나만 올리면 나머지도 자동 적용돼요
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>제목</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="스토리 제목" style={fieldStyle} />
          </div>

          <div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>본문</div>
            <StoryEditor value={content} onChange={setContent} />
          </div>

          {storyType === 'homecare' && (
            <div>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 6 }}>제품 선택 ({selectedIds.length}개)</div>
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="제품명 검색"
                style={{ ...fieldStyle, marginBottom: 10 }}
              />
              {searching && <div style={{ fontSize: 11, color: SUB, marginBottom: 8 }}>검색 중…</div>}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 8,
                }}
                className="story-product-grid"
              >
                <style>{`@media (min-width:768px){ .story-product-grid{ grid-template-columns: repeat(4, 1fr) !important; } }`}</style>
                {searchResults.map((p) => {
                  const on = selectedIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      style={{
                        border: on ? `1.5px solid ${PURPLE}` : `1px solid ${GOLD_BORDER}`,
                        background: on ? PURPLE_BG : CARD,
                        borderRadius: 10,
                        padding: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: 8,
                          background: p.thumb_img ? `url(${p.thumb_img}) center/cover` : PURPLE_BG,
                          marginBottom: 6,
                        }}
                      />
                      <div style={{ fontSize: 11, color: TEXT, lineHeight: 1.3, height: 28, overflow: 'hidden' }}>{p.name}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: 10,
              background: isPublished ? PURPLE_BG : CARD,
              border: `1px solid ${isPublished ? PURPLE_BORDER : GOLD_BORDER}`,
              cursor: 'pointer',
            }}
          >
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            <div>
              <div style={{ fontSize: 13, color: TEXT, fontWeight: 600 }}>발행하기</div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>켜면 고객 스토어에 공개돼요. 기본은 초안이에요.</div>
            </div>
          </label>

          <button
            type="button"
            disabled={saving || uploading}
            onClick={() => void handleSave()}
            style={{
              border: 'none',
              background: saving ? `${PURPLE}99` : PURPLE,
              color: '#fff',
              borderRadius: 10,
              padding: 12,
              fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '저장 중…' : editingId ? '수정 저장' : '저장'}
          </button>
        </div>
      )}

      <div>
        {(mode === 'pickType' || mode === 'form') && (
          <div style={{ fontSize: 12, color: GOLD, fontWeight: 600, marginBottom: 8 }}>내 스토리 목록</div>
        )}
        {loadingList && <div style={{ fontSize: 12, color: SUB }}>불러오는 중…</div>}
        {!loadingList && stories.length === 0 && (
          <div style={{ fontSize: 12, color: SUB, lineHeight: 1.6 }}>아직 작성한 스토리가 없어요. 새 스토리를 만들어 보세요.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stories.map((s) => (
            <div
              key={s.id}
              style={{
                background: CARD,
                border: editingId === s.id && mode === 'form' ? `1.5px solid ${PURPLE}` : `1px solid ${GOLD_BORDER}`,
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: TEXT, fontWeight: 600, marginBottom: 6 }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 20,
                        background: PURPLE_BG,
                        color: PURPLE,
                        border: `1px solid ${PURPLE_BORDER}`,
                      }}
                    >
                      {TYPE_LABEL[s.story_type] || s.story_type}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '3px 8px',
                        borderRadius: 20,
                        background: s.is_published ? GOLD_BG : '#f3f3f3',
                        color: s.is_published ? GOLD : SUB,
                        border: `1px solid ${s.is_published ? GOLD_BORDER : '#e5e5e5'}`,
                      }}
                    >
                      {s.is_published ? '발행됨' : '초안'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    style={{ border: `1px solid ${PURPLE_BORDER}`, background: PURPLE_BG, color: PURPLE, borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(s.id)}
                    style={{ border: `1px solid ${GOLD_BORDER}`, background: CARD, color: SUB, borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
