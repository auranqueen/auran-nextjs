'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'

type Category = 'skin' | 'review' | 'salon' | 'routine' | 'qa'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'skin', label: '피부고민' },
  { id: 'review', label: '제품리뷰' },
  { id: 'salon', label: '살롱후기' },
  { id: 'routine', label: '스킨루틴' },
  { id: 'qa', label: 'Q&A' },
]

export default function CommunityNewPage() {
  const supabase = createClient()
  const router = useRouter()
  const [category, setCategory] = useState<Category>('skin')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [images, setImages] = useState('')
  const [saving, setSaving] = useState(false)
  const canSave = useMemo(() => title.trim().length >= 2 && content.trim().length >= 5, [content, title])

  const submit = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }

    const tags = hashtags
      .split(/[,\s]+/)
      .map(t => t.replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 15)

    const imageUrls = images
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 6)

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        category,
        title: title.trim(),
        content: content.trim(),
        hashtags: tags,
        image_urls: imageUrls.length ? imageUrls : null,
        likes: 0,
        views: 0,
      })
      .select('id')
      .single()

    if (!error && data?.id) {
      router.replace(`/dashboard/customer/community/${data.id}`)
      return
    }
    setSaving(false)
    alert(error?.message || '글 등록 중 오류가 발생했습니다.')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="글쓰기" right={<NoticeBell />} />
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '14px 14px' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>카테고리</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {CATEGORIES.map(c => {
              const active = c.id === category
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 999,
                    background: active ? 'rgba(201,168,76,0.14)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${active ? 'rgba(201,168,76,0.45)' : 'rgba(255,255,255,0.10)'}`,
                    color: active ? '#c9a84c' : 'rgba(255,255,255,0.75)',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>제목</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 16,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 13,
              outline: 'none',
              marginBottom: 12,
            }}
          />

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>내용</div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
            rows={8}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 16,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 13,
              outline: 'none',
              resize: 'none',
              lineHeight: 1.7,
              marginBottom: 12,
            }}
          />

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>해시태그</div>
          <input
            value={hashtags}
            onChange={e => setHashtags(e.target.value)}
            placeholder="#피부고민 #트러블 (공백/쉼표로 구분)"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 16,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
              marginBottom: 12,
            }}
          />

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>이미지 URL (선택)</div>
          <input
            value={images}
            onChange={e => setImages(e.target.value)}
            placeholder="https://... , https://... (쉼표로 구분)"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 16,
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
              marginBottom: 14,
            }}
          />

          <button
            type="button"
            disabled={!canSave || saving}
            onClick={submit}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 16,
              background: canSave ? '#c9a84c' : 'rgba(255,255,255,0.10)',
              border: 'none',
              color: canSave ? '#111' : 'rgba(255,255,255,0.45)',
              fontSize: 14,
              fontWeight: 900,
              cursor: canSave ? 'pointer' : 'default',
            }}
          >
            {saving ? '등록 중...' : '등록하기'}
          </button>
        </div>
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

