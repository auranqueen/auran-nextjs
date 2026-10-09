'use client'

import { useState } from 'react'
import SlideUpSheet from '@/components/ui/SlideUpSheet'

const ACCENT = '#e8845a'
const CATEGORIES = ['피부케어', '성분', '루틴', '브랜드', '원장님픽']

const inp = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: '#faf8f6',
  border: '1px solid #f0ece8',
  color: '#222',
  fontSize: 13,
  boxSizing: 'border-box',
} as const

const label = (t: string) => <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t}</div>

const ERROR_TEXT: Record<string, string> = {
  not_logged_in: '로그인이 필요합니다.',
  curator_only: '큐레이터 계정만 기고할 수 있습니다.',
  title_required: '제목을 입력해 주세요.',
}

export default function ContributionSheet({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
}) {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [category, setCategory] = useState('')
  const [content, setContent] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setTitle('')
    setSubtitle('')
    setCategory('')
    setContent('')
    setThumbnailUrl('')
    setError('')
  }

  const submit = async () => {
    if (!title.trim()) {
      setError(ERROR_TEXT.title_required)
      return
    }
    setSending(true)
    setError('')
    const res = await fetch('/api/curator/magazine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle, category, content, thumbnail_url: thumbnailUrl }),
    }).catch(() => null)
    const json = (await res?.json().catch(() => null)) as unknown as { ok?: boolean; error?: string } | null
    setSending(false)
    if (!res?.ok || !json?.ok) {
      console.error('[ContributionSheet] submit error', json?.error ?? res?.status ?? 'network')
      setError(ERROR_TEXT[json?.error || ''] || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    reset()
    onSubmitted()
    onClose()
  }

  return (
    <SlideUpSheet open={open} onClose={onClose} zIndex={9000} height="auto" maxHeight="90dvh">
      <div style={{ background: '#fff', color: '#222', colorScheme: 'light', padding: '18px 18px 28px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#222' }}>매거진 기고</div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: '#888', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
          >
            ×
          </button>
        </div>

        {label('제목 *')}
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="글 제목" maxLength={200} style={{ ...inp, marginBottom: 14 }} />

        {label('부제')}
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="한 줄 요약 (선택)" maxLength={300} style={{ ...inp, marginBottom: 14 }} />

        {label('카테고리')}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(prev => (prev === c ? '' : c))}
              style={{
                border: `1px solid ${category === c ? ACCENT : '#f0ece8'}`,
                background: category === c ? '#fff7f4' : '#fff',
                color: category === c ? ACCENT : '#555',
                borderRadius: 20,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {label('본문')}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="내용을 적어주세요. 빈 줄로 문단이 나뉩니다."
          rows={8}
          style={{ ...inp, resize: 'vertical', minHeight: 160, marginBottom: 14 }}
        />

        {label('썸네일 이미지 URL')}
        <input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https:// (선택)" style={{ ...inp, marginBottom: 14 }} />

        {error && <div style={{ fontSize: 12, color: '#d93025', marginBottom: 12 }}>{error}</div>}

        <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>제출 즉시 매거진에 발행됩니다.</div>

        <button
          type="button"
          disabled={sending}
          onClick={() => void submit()}
          style={{ width: '100%', border: 'none', borderRadius: 12, padding: '14px 16px', background: ACCENT, color: '#fff', fontSize: 14, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1 }}
        >
          {sending ? '보내는 중…' : '기고 제출'}
        </button>
      </div>
    </SlideUpSheet>
  )
}
