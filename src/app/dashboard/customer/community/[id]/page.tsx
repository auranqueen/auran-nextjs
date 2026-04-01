'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyReviewLikeReward } from '@/lib/community/reviewLikeReward'
import DashboardBottomNav from '@/components/DashboardBottomNav'

const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

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
  product_tags?: string[] | null
  is_expert_answered?: boolean | null
  expert_answer?: string | null
  skin_type?: string | null
}

type CommentRow = {
  id: string
  post_id: string
  user_id: string
  content: string
  is_expert: boolean
  created_at: string
  profiles?: { username?: string | null; avatar_url?: string | null; grade?: string | null; full_name?: string | null } | null
}

type ProductRow = { id: string; name: string; thumb_img?: string | null; retail_price?: number | null }

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
}

function categoryLabel(cat: string) {
  const m: Record<string, string> = {
    skin: '피부고민',
    review: '제품리뷰',
    salon: '살롱후기',
    routine: '스킨루틴',
    qa: 'Q&A',
    menopause: '갱년기',
    hot: '인기',
    all: '전체',
  }
  return m[cat] || cat
}

export default function CommunityPostDetailPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const postId = params?.id

  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<Post | null>(null)
  const [authorName, setAuthorName] = useState('')
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null)
  const [authorGrade, setAuthorGrade] = useState<string | null>(null)
  const [taggedProducts, setTaggedProducts] = useState<ProductRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [liked, setLiked] = useState(false)
  const [scrapped, setScrapped] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [likeCount, setLikeCount] = useState(0)
  const [toast, setToast] = useState('')

  const tags = useMemo(() => (post?.hashtags || []).slice(0, 20), [post?.hashtags])
  const mediaUrls = useMemo(() => post?.image_urls || [], [post?.image_urls])
  const images = useMemo(() => mediaUrls.filter((u) => !isVideoUrl(u)), [mediaUrls])
  const videos = useMemo(() => mediaUrls.filter((u) => isVideoUrl(u)), [mediaUrls])

  const loadPost = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user

    const { data: row } = await supabase
      .from('posts')
      .select(
        'id,user_id,category,title,content,image_urls,hashtags,likes,views,created_at,product_tags,is_expert_answered,expert_answer,skin_type'
      )
      .eq('id', postId)
      .single()

    if (!row) {
      setPost(null)
      setComments([])
      setLoading(false)
      return
    }

    const p = row as Post
    setPost(p)
    setLikeCount(Number(p.likes || 0))

    try {
      await supabase.from('posts').update({ views: (p.views || 0) + 1 }).eq('id', postId)
    } catch {
      // ignore
    }

    const { data: urow } = await supabase.from('users').select('name, avatar_url, customer_grade, auth_id').eq('id', p.user_id).maybeSingle()
    if (urow?.auth_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, full_name, grade, avatar_url')
        .eq('auth_id', urow.auth_id)
        .maybeSingle()
      const pr = prof as { username?: string; full_name?: string; grade?: string; avatar_url?: string } | null
      setAuthorName((pr?.username || pr?.full_name || urow.name || '').trim() || '회원')
      setAuthorAvatar(pr?.avatar_url || urow.avatar_url || null)
      setAuthorGrade((pr?.grade || urow.customer_grade || '').trim() || null)
    } else {
      setAuthorName((urow?.name || '').trim() || '회원')
      setAuthorAvatar(urow?.avatar_url || null)
      setAuthorGrade((urow?.customer_grade || '').trim() || null)
    }

    const pids = (p.product_tags || []).filter(Boolean) as string[]
    if (pids.length) {
      const { data: prods } = await supabase.from('products').select('id,name,thumb_img,retail_price').in('id', pids)
      setTaggedProducts((prods || []) as ProductRow[])
    } else {
      setTaggedProducts([])
    }

    let list: CommentRow[] = []
    const { data: rawComments, error: cErr } = await supabase
      .from('post_comments')
      .select('id,post_id,user_id,content,is_expert,created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (!cErr && rawComments) list = rawComments as CommentRow[]
    const cAuthIds = Array.from(new Set(list.map((c) => c.user_id)))
    let pmap: Record<string, { username?: string; avatar_url?: string; grade?: string; full_name?: string }> = {}
    if (cAuthIds.length) {
      const { data: profs } = await supabase.from('profiles').select('auth_id,username,avatar_url,grade,full_name').in('auth_id', cAuthIds)
      pmap = Object.fromEntries((profs || []).map((x: any) => [x.auth_id, x]))
    }
    setComments(
      list.map((c) => ({
        ...c,
        profiles: pmap[c.user_id] || null,
      }))
    )

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
  }, [postId, supabase])

  useEffect(() => {
    void loadPost()
  }, [loadPost])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const toggleLike = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || !postId || !post) {
      router.push('/login?role=customer')
      return
    }
    const next = !liked
    setLiked(next)
    const delta = next ? 1 : -1
    setLikeCount((prev) => {
      const newLikes = Math.max(0, prev + delta)
      void (async () => {
        try {
          if (next) {
            const { error: insE } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
            if (!insE) void applyReviewLikeReward(supabase, postId, user.id)
          } else {
            await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
          }
          await supabase.from('posts').update({ likes: newLikes }).eq('id', postId)
          setPost((p) => (p ? { ...p, likes: newLikes } : p))
        } catch {
          // ignore
        }
      })()
      return newLikes
    })
  }

  const toggleScrap = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
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

  const copyShare = async () => {
    if (!postId || typeof window === 'undefined') return
    const url = `${window.location.origin}/dashboard/customer/community/${postId}`
    try {
      await navigator.clipboard.writeText(url)
      setToast('링크를 복사했어요')
    } catch {
      setToast('복사에 실패했어요')
    }
  }

  const submitComment = async () => {
    const text = commentText.trim()
    if (!text || !postId) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: user.id, content: text, is_expert: false })
      .select('id,post_id,user_id,content,is_expert,created_at')
      .single()
    if (error || !data) return
    const { data: prof } = await supabase.from('profiles').select('username,avatar_url,grade,full_name').eq('auth_id', user.id).maybeSingle()
    const pr = prof as CommentRow['profiles']
    setComments((prev) => [...prev, { ...(data as CommentRow), profiles: pr || null }])
    setCommentText('')
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, maxWidth: 390, margin: '0 auto', paddingBottom: 180 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(13,11,9,0.94)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
          <button type="button" onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>
            ←
          </button>
          <span
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(201,169,110,0.12)',
              border: '1px solid rgba(201,169,110,0.25)',
              color: GOLD,
            }}
          >
            {post ? categoryLabel(post.category) : '…'}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>불러오는 중...</div>
        ) : !post ? (
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>게시글을 찾을 수 없습니다.</div>
        ) : (
          <>
            {videos[0] ? (
              <div style={{ width: '100%', aspectRatio: '9/16', borderRadius: 14, overflow: 'hidden', background: '#000', marginBottom: 10 }}>
                <video src={videos[0]} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ) : null}

            {images.length === 1 ? (
              <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : images.length > 1 ? (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 10, scrollbarWidth: 'none' as const }}>
                {images.map((u) => (
                  <div key={u} style={{ flexShrink: 0, width: '78%', aspectRatio: '1/1', borderRadius: 14, overflow: 'hidden' }}>
                    <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: authorAvatar ? `url(${authorAvatar}) center/cover no-repeat` : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                {!authorAvatar ? '👤' : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{authorName}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, alignItems: 'center' }}>
                  {authorGrade ? (
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#e8d6ff' }}>{authorGrade}</span>
                  ) : null}
                  <span style={{ fontSize: 10, color: TEXT_MUTED }}>
                    {post.created_at ? new Date(post.created_at).toLocaleString('ko-KR') : ''}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 16, color: '#fff', lineHeight: 1.35, marginBottom: 10, fontWeight: 700 }}>{post.title}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{post.content}</div>

            {tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(201,169,110,0.12)',
                      border: '1px solid rgba(201,169,110,0.22)',
                      color: GOLD,
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}

            {taggedProducts.length > 0 ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 8 }}>🧴 태그된 제품</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {taggedProducts.map((pr) => (
                    <div
                      key={pr.id}
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'center',
                        padding: 10,
                        borderRadius: 12,
                        background: CARD_BG,
                        border: CARD_BORDER,
                      }}
                    >
                      <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
                        {pr.thumb_img ? <img src={pr.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{pr.name}</div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{Number(pr.retail_price || 0).toLocaleString()}원</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/products/${pr.id}`)}
                        style={{
                          flexShrink: 0,
                          padding: '8px 12px',
                          borderRadius: 10,
                          border: 'none',
                          background: PURPLE,
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        구매하기
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 12,
              }}
            >
              <button type="button" onClick={() => void toggleLike()} style={{ background: 'none', border: 'none', color: liked ? '#ff6b9d' : '#fff', fontSize: 13, cursor: 'pointer' }}>
                ❤️ 좋아요 {likeCount}
              </button>
              <span style={{ fontSize: 13, color: TEXT_MUTED }}>💬 댓글 {comments.length}</span>
              <button type="button" onClick={() => void toggleScrap()} style={{ background: 'none', border: 'none', color: scrapped ? GOLD : '#fff', fontSize: 13, cursor: 'pointer' }}>
                🔖 스크랩
              </button>
              <button type="button" onClick={() => void copyShare()} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
                🔗 공유
              </button>
            </div>

            {post.is_expert_answered && post.expert_answer ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: 14,
                  borderRadius: 14,
                  background: 'rgba(201,169,110,0.08)',
                  border: '1px solid rgba(201,169,110,0.22)',
                }}
              >
                <div style={{ fontSize: 11, color: GOLD, marginBottom: 8, fontWeight: 700 }}>👩‍⚕️ 전문가 답변</div>
                <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{post.expert_answer}</div>
              </div>
            ) : null}

            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 10 }}>댓글</div>
            {comments.length === 0 ? (
              <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>첫 댓글을 남겨보세요.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                {comments.map((c) => {
                  const nick = (c.profiles?.username || c.profiles?.full_name || '').trim() || c.user_id.slice(0, 6)
                  const g = (c.profiles?.grade || '').trim()
                  return (
                    <div key={c.id} style={{ paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 999,
                            background: c.profiles?.avatar_url ? `url(${c.profiles.avatar_url}) center/cover` : 'rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                          }}
                        >
                          {!c.profiles?.avatar_url ? '👤' : null}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{nick}</span>
                            {g ? (
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#e8d6ff' }}>{g}</span>
                            ) : null}
                            {c.is_expert ? (
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: 'rgba(201,169,110,0.15)', color: GOLD }}>원장님</span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                            {c.created_at ? new Date(c.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.88)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {post ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 56,
            width: '100%',
            maxWidth: 390,
            padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
            background: 'rgba(13,11,9,0.96)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: 8,
            zIndex: 30,
          }}
        >
          <input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글을 입력해주세요..."
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              background: CARD_BG,
              border: CARD_BORDER,
              color: '#fff',
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void submitComment()}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            등록
          </button>
        </div>
      ) : null}

      <DashboardBottomNav role="customer" />

      {toast ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 130,
            transform: 'translateX(-50%)',
            padding: '10px 16px',
            borderRadius: 12,
            background: 'rgba(30,25,35,0.95)',
            border: '1px solid rgba(123,94,167,0.35)',
            color: '#fff',
            fontSize: 12,
            zIndex: 200,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
