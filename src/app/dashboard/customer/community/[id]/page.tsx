'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'

type Post = {
  id: string
  user_id: string
  category: string
  title: string
  content: string
  image_urls: string[] | null
  hashtags: string[] | null
  likes: number | null
  views: number | null
  created_at: string
}

type Comment = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
}

export default function CommunityPostDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const postId = params?.id

  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [liked, setLiked] = useState(false)
  const [scrapped, setScrapped] = useState(false)
  const [commentText, setCommentText] = useState('')

  const tags = useMemo(() => (post?.hashtags || []).slice(0, 12), [post?.hashtags])

  useEffect(() => {
    const run = async () => {
      if (!postId) return
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      const { data } = await supabase
        .from('posts')
        .select('id,user_id,category,title,content,image_urls,hashtags,likes,views,created_at')
        .eq('id', postId)
        .single()

      if (!data) {
        setPost(null)
        setComments([])
        setLoading(false)
        return
      }

      const p = data as Post
      setPost(p)

      // 조회수 +1 (best-effort)
      try {
        await supabase.from('posts').update({ views: (p.views || 0) + 1 }).eq('id', postId)
      } catch {
        // ignore
      }

      const { data: cs } = await supabase
        .from('comments')
        .select('id,post_id,user_id,content,created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(200)
      setComments((cs || []) as Comment[])

      if (user) {
        const [lr, sr] = await Promise.all([
          supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle(),
          supabase.from('post_scraps').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle(),
        ])
        setLiked(!!lr.data)
        setScrapped(!!sr.data)
      } else {
        setLiked(false)
        setScrapped(false)
      }

      setLoading(false)
    }
    run()
  }, [postId, supabase])

  const toggleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !postId) {
      router.push('/login?role=customer')
      return
    }
    const next = !liked
    setLiked(next)
    try {
      if (next) {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
      } else {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
      }
    } catch {
      // ignore
    }
  }

  const toggleScrap = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !postId) {
      router.push('/login?role=customer')
      return
    }
    const next = !scrapped
    setScrapped(next)
    try {
      if (next) {
        await supabase.from('post_scraps').insert({ post_id: postId, user_id: user.id })
      } else {
        await supabase.from('post_scraps').delete().eq('post_id', postId).eq('user_id', user.id)
      }
    } catch {
      // ignore
    }
  }

  const submitComment = async () => {
    const text = commentText.trim()
    if (!text || !postId) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content: text })
      .select('id,post_id,user_id,content,created_at')
      .single()
    if (data) {
      setComments(prev => [...prev, data as Comment])
      setCommentText('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="게시글" right={<CustomerHeaderRight />} />

      <div style={{ padding: '14px 16px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : !post ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>게시글을 찾을 수 없습니다.</div>
        ) : (
          <>
            <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '14px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1.35, marginBottom: 10 }}>
                {post.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                <div>작성자 {post.user_id?.slice(0, 6)}</div>
                <div>{post.created_at ? new Date(post.created_at).toLocaleString('ko-KR') : ''}</div>
              </div>

              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {tags.map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.22)', color: '#c9a84c' }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {post.image_urls?.[0] && (
                <div style={{ marginTop: 12, width: '100%', aspectRatio: '1 / 1', borderRadius: 16, background: `url(${post.image_urls[0]}) center/cover no-repeat`, border: '1px solid rgba(255,255,255,0.10)' }} />
              )}

              <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.82)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {post.content}
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <button type="button" onClick={toggleLike} style={{ flex: 1, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: liked ? '#ff6b9d' : 'rgba(255,255,255,0.8)', fontWeight: 800, cursor: 'pointer' }}>
                  ❤️ 좋아요
                </button>
                <button type="button" onClick={toggleScrap} style={{ flex: 1, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: scrapped ? '#c9a84c' : 'rgba(255,255,255,0.8)', fontWeight: 800, cursor: 'pointer' }}>
                  🔖 스크랩
                </button>
              </div>
            </div>

            <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 16, padding: '14px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 10 }}>댓글 {comments.length}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="댓글을 입력하세요"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={submitComment}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: 'rgba(201,168,76,0.14)',
                    border: '1px solid rgba(201,168,76,0.30)',
                    color: '#c9a84c',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  등록
                </button>
              </div>

              {comments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>첫 댓글을 남겨보세요.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                        <span>{c.user_id?.slice(0, 6)}</span>
                        <span>{c.created_at ? new Date(c.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <DashboardBottomNav role="customer" />
    </div>
  )
}

