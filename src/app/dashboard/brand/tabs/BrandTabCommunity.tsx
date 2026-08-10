'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveCompanyBrandIds } from '@/lib/brand/resolveCompanyBrandIds'
import type { CSSProperties } from 'react'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const BORDER = 'rgba(255,255,255,0.05)'
interface Post {
  id: string
  title: string | null
  body: string
  is_pinned: boolean
  reply_count: number
  author_type: string
  created_at: string
}
interface Props {
  myBrands: { id: string; name: string }[]
  brandId: string | null
}
export default function BrandTabCommunity({ myBrands, brandId }: Props) {
  const [companyBrandIds, setCompanyBrandIds] = useState<string[]>([])
  const brandName = myBrands.find((b) => b.id === brandId)?.name || ''
  const supabase = createClient()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [pinned, setPinned] = useState(false)
  const [posting, setPosting] = useState(false)
  const [toast, setToast] = useState('')
  const [showForm, setShowForm] = useState(false)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  useEffect(() => {
    if (!brandId) { setCompanyBrandIds([]); return }
    let cancelled = false
    void (async () => {
      const ids = await resolveCompanyBrandIds(supabase, brandId)
      if (!cancelled) setCompanyBrandIds(ids)
    })()
    return () => { cancelled = true }
  }, [brandId, supabase])
  const fetchPosts = useCallback(async () => {
    if (!companyBrandIds.length) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_posts')
      .select('id, title, body, is_pinned, reply_count, author_type, created_at')
      .in('brand_id', companyBrandIds)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)
    setPosts((data || []) as Post[])
    setLoading(false)
  }, [companyBrandIds])
  useEffect(() => { void fetchPosts() }, [fetchPosts])
  const submitPost = async () => {
    if (!body.trim()) { showToast('내용을 입력해주세요'); return }
    if (!brandId) { showToast('브랜드 정보가 없습니다'); return }
    setPosting(true)
    const { data, error } = await supabase
      .from('brand_posts')
      .insert({
        brand_id: brandId,
        title: title.trim() || null,
        body: body.trim(),
        is_pinned: pinned,
        author_type: 'brand',
      })
      .select('id, title, body, is_pinned, reply_count, author_type, created_at')
      .single()
    if (!error && data) {
      setPosts(prev => [data as Post, ...prev])
      setBody('')
      setTitle('')
      setPinned(false)
      setShowForm(false)
      showToast('게시 완료!')
    } else {
      showToast('게시 실패: ' + (error?.message || ''))
    }
    setPosting(false)
  }
  const deletePost = async (id: string) => {
    const { error } = await supabase.from('brand_posts').delete().eq('id', id)
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== id))
      showToast('삭제됨')
    }
  }
  const togglePin = async (post: Post) => {
    const { error } = await supabase
      .from('brand_posts')
      .update({ is_pinned: !post.is_pinned })
      .eq('id', post.id)
    if (!error) {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, is_pinned: !p.is_pinned } : p))
      showToast(post.is_pinned ? '고정 해제' : '상단 고정!')
    }
  }
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '방금 전'
    if (m < 60) return `${m}분 전`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}시간 전`
    return `${Math.floor(h / 24)}일 전`
  }
  if (!companyBrandIds.length) {
    return <div style={{ textAlign: 'center', padding: 24, color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>불러오는 중…</div>
  }
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999 }}>{toast}</div>
      )}
      {showForm ? (
        <div style={CARD}>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>✍️ 새 게시글</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="제목 (선택)"
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: TEXT, outline: 'none', marginBottom: 8 }}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={`${brandName} 원장님들에게 공지·소식을 전해보세요`}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '10px 12px', fontSize: 12, color: TEXT, minHeight: 80, resize: 'none', outline: 'none', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div
              onClick={() => setPinned(v => !v)}
              style={{ width: 32, height: 18, borderRadius: 9, background: pinned ? PURPLE : 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', background: '#fff', top: 3, left: pinned ? 17 : 3, transition: 'left .2s' }} />
            </div>
            <span style={{ fontSize: 11, color: SUB }}>상단 고정</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={submitPost}
              disabled={posting}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: posting ? 'rgba(123,94,167,0.4)' : PURPLE, color: '#fff', fontSize: 12, cursor: posting ? 'not-allowed' : 'pointer' }}
            >
              {posting ? '게시 중...' : '게시하기'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setTitle(''); setBody(''); setPinned(false) }}
              style={{ padding: '8px 14px', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 12, cursor: 'pointer', marginBottom: 10 }}
        >
          ✏️ 새 게시글 작성
        </button>
      )}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 12 }}>💬 게시글</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 16, color: SUB, fontSize: 12 }}>불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: SUB, fontSize: 12, lineHeight: 1.7 }}>
            아직 게시글이 없어요.<br />원장님들에게 첫 소식을 전해보세요!
          </div>
        ) : (
          posts.map((p, i) => (
            <div key={p.id} style={{ padding: '12px 0', borderBottom: i < posts.length - 1 ? `0.5px solid ${BORDER}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    {p.is_pinned && (
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(201,169,110,0.15)', color: GOLD, border: '0.5px solid rgba(201,169,110,0.3)' }}>고정</span>
                    )}
                    {p.title && (
                      <span style={{ fontSize: 13, color: TEXT }}>{p.title}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: SUB, marginBottom: 4, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{p.body}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>댓글 {p.reply_count} · {timeAgo(p.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => togglePin(p)}
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: `0.5px solid ${p.is_pinned ? 'rgba(201,169,110,0.3)' : 'rgba(255,255,255,0.1)'}`, background: p.is_pinned ? 'rgba(201,169,110,0.08)' : 'transparent', color: p.is_pinned ? GOLD : SUB, cursor: 'pointer' }}
                  >
                    {p.is_pinned ? '고정해제' : '고정'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePost(p.id)}
                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '0.5px solid rgba(229,57,53,0.3)', background: 'rgba(229,57,53,0.08)', color: 'rgba(229,57,53,0.7)', cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
