'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SlideUpSheet from '@/components/ui/SlideUpSheet'

const ACCENT = '#e8845a'

type Post = {
  id: string
  title: string
  subtitle: string | null
  category: string | null
  content: string | null
  is_published: boolean | null
  published_at: string | null
  created_at: string | null
  thumbnail_url: string | null
}

const ymd = (iso: string | null) => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '')

/** 저장된 문단 HTML(<p>, <br />)을 화면 표시용 일반 텍스트로 변환 — React 텍스트로만 렌더링 */
const toPlainText = (html: string | null) =>
  (html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()

export default function MyContributions({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)

  // [ANCHOR: fetch-my-posts]
  useEffect(() => {
    let alive = true
    setLoading(true)
    setFailed(false)
    fetch('/api/curator/magazine', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json: { items?: Post[] }) => {
        if (alive) setItems(json.items ?? [])
      })
      .catch(err => {
        console.error('[MyContributions] load error', err)
        if (alive) setFailed(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [refreshKey])

  const previewText = toPlainText(selectedPost?.content ?? null)

  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#222', margin: '20px 0 10px' }}>내 기고 글</div>
      <div style={{ background: '#fff', border: '1px solid #f0ece8', borderRadius: 16, padding: '4px 16px', marginBottom: 12 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: '#999', padding: '16px 0', textAlign: 'center' }}>불러오는 중…</div>
        ) : failed ? (
          <div style={{ fontSize: 13, color: '#999', padding: '16px 0', textAlign: 'center' }}>데이터를 불러올 수 없습니다</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 13, color: '#999', padding: '16px 0', textAlign: 'center' }}>아직 기고한 글이 없어요</div>
        ) : (
          items.map(p => {
            const row = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderBottom: '1px solid #f5f2ef' }}>
                {p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flex: '0 0 auto', background: '#faf8f6' }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 8, flex: '0 0 auto', background: '#faf8f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✍️</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                    {p.is_published ? `발행 ${ymd(p.published_at || p.created_at)}` : `제출 ${ymd(p.created_at)}`}
                  </div>
                </div>
                <span
                  style={{
                    flex: '0 0 auto',
                    fontSize: 11,
                    borderRadius: 20,
                    padding: '4px 10px',
                    background: p.is_published ? '#f0faf5' : '#fff7f4',
                    color: p.is_published ? '#3db87a' : ACCENT,
                    border: `1px solid ${p.is_published ? '#3db87a' : ACCENT}`,
                  }}
                >
                  {p.is_published ? '발행됨' : '검토 중'}
                </span>
              </div>
            )
            return p.is_published ? (
              <Link key={p.id} href={`/magazine/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {row}
              </Link>
            ) : (
              // [ANCHOR: pending-post-preview]
              <div key={p.id} onClick={() => setSelectedPost(p)} style={{ cursor: 'pointer' }}>
                {row}
              </div>
            )
          })
        )}
      </div>

      <SlideUpSheet open={selectedPost !== null} onClose={() => setSelectedPost(null)} zIndex={9200} height="auto" maxHeight="90dvh">
        <div style={{ background: '#ffffff', color: '#222', colorScheme: 'light', minHeight: '100%', padding: '24px 16px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 17, color: '#222', lineHeight: 1.4, wordBreak: 'break-word' }}>{selectedPost?.title}</div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setSelectedPost(null)}
                style={{ flex: '0 0 auto', border: 'none', background: 'transparent', color: '#888', fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 4 }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 11, borderRadius: 20, padding: '4px 10px', background: '#fff7f4', color: ACCENT, border: `1px solid ${ACCENT}` }}>검토 중</span>
              {selectedPost?.category && (
                <span style={{ fontSize: 11, borderRadius: 20, padding: '4px 10px', background: '#faf8f6', color: '#555', border: '1px solid #f0ece8' }}>{selectedPost.category}</span>
              )}
              <span style={{ fontSize: 11, color: '#999' }}>제출 {ymd(selectedPost?.created_at ?? null)}</span>
            </div>
            {selectedPost?.subtitle && <div style={{ fontSize: 13, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>{selectedPost.subtitle}</div>}
            {selectedPost?.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedPost.thumbnail_url} alt="" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, background: '#faf8f6', marginBottom: 14, display: 'block' }} />
            )}
            <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {previewText || '본문이 없습니다.'}
            </div>
          </div>
        </div>
      </SlideUpSheet>
    </>
  )
}
