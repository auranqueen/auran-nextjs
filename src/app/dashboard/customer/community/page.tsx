'use client'

import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import DashboardHeader from '@/components/DashboardHeader'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type TabId = 'all' | 'hot' | 'skin' | 'review' | 'salon' | 'routine' | 'qa'

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

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'hot', label: '인기' },
  { id: 'skin', label: '피부고민' },
  { id: 'review', label: '제품리뷰' },
  { id: 'salon', label: '살롱후기' },
  { id: 'routine', label: '스킨루틴' },
  { id: 'qa', label: 'Q&A' },
]

export default function CustomerCommunityPage() {
  const supabase = createClient()
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [scrappedIds, setScrappedIds] = useState<Set<string>>(new Set())

  const activeLabel = useMemo(() => TABS.find(t => t.id === tab)?.label ?? '커뮤니티', [tab])

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      let query = supabase
        .from('posts')
        .select('id,user_id,category,title,content,image_urls,hashtags,likes,views,created_at')

      if (tab === 'hot') {
        query = query.order('likes', { ascending: false }).order('views', { ascending: false }).limit(10)
      } else {
        query = query.order('created_at', { ascending: false }).limit(40)
      }

      if (tab !== 'all' && tab !== 'hot') {
        query = query.eq('category', tab)
      }

      const tag = q.trim().replace(/^#/, '')
      if (tag) {
        query = query.contains('hashtags', [tag])
      }

      const { data } = await query
      const list = (data || []) as Post[]
      setPosts(list)

      if (!user || list.length === 0) {
        setLikedIds(new Set())
        setScrappedIds(new Set())
        setLoading(false)
        return
      }

      const ids = list.map(p => p.id)
      const [likesRes, scrapsRes] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
        supabase.from('post_scraps').select('post_id').eq('user_id', user.id).in('post_id', ids),
      ])
      setLikedIds(new Set((likesRes.data || []).map((x: any) => x.post_id)))
      setScrappedIds(new Set((scrapsRes.data || []).map((x: any) => x.post_id)))
      setLoading(false)
    }
    run()
  }, [q, supabase, tab])

  const toggleLike = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const has = likedIds.has(postId)
    const next = new Set(likedIds)
    if (has) next.delete(postId); else next.add(postId)
    setLikedIds(next)

    try {
      if (has) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
      }
    } catch {
      // ignore
    }
  }

  const toggleScrap = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const has = scrappedIds.has(postId)
    const next = new Set(scrappedIds)
    if (has) next.delete(postId); else next.add(postId)
    setScrappedIds(next)

    try {
      if (has) {
        await supabase.from('post_scraps').delete().eq('post_id', postId).eq('user_id', user.id)
      } else {
        await supabase.from('post_scraps').insert({ post_id: postId, user_id: user.id })
      }
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110, position: 'relative' }}>
      <DashboardHeader title={activeLabel} right={<NoticeBell />} />

      {/* 검색 + 탭 */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>🔍</span>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="#해시태그 검색"
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                borderRadius: 16,
                background: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#fff',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10 }}>
          {TABS.map(t => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  flexShrink: 0,
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: active ? 'rgba(201,168,76,0.14)' : '#1a1a1a',
                  border: `1px solid ${active ? 'rgba(201,168,76,0.45)' : 'rgba(255,255,255,0.10)'}`,
                  color: active ? '#c9a84c' : 'rgba(255,255,255,0.70)',
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding: '6px 16px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : tab === 'hot' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => router.push(`/dashboard/customer/community/${p.id}`)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 16,
                  padding: '12px 12px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 24, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 900, color: '#c9a84c' }}>{idx + 1}</div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: p.image_urls?.[0] ? `url(${p.image_urls[0]}) center/cover no-repeat` : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 10, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                    <span>조회 {(p.views || 0).toLocaleString()}</span>
                    <span>좋아요 {(p.likes || 0).toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>›</div>
              </button>
            ))}
          </div>
        ) : tab === 'all' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {posts.map(p => {
              const hasImg = !!p.image_urls?.[0]
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  <button
                    onClick={() => router.push(`/dashboard/customer/community/${p.id}`)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {hasImg ? (
                      <div style={{ width: '100%', aspectRatio: '1 / 1', background: `url(${p.image_urls![0]}) center/cover no-repeat` }} />
                    ) : (
                      <div style={{ padding: '12px 12px', height: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>
                          {p.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                          {p.content}
                        </div>
                      </div>
                    )}
                  </button>

                  <div style={{ padding: '10px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button type="button" onClick={() => toggleLike(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: likedIds.has(p.id) ? '#ff6b9d' : 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                      ❤️
                    </button>
                    <button type="button" onClick={() => router.push(`/dashboard/customer/community/${p.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                      💬
                    </button>
                    <button type="button" onClick={() => toggleScrap(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: scrappedIds.has(p.id) ? '#c9a84c' : 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                      🔖
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map(p => {
              const tags = (p.hashtags || []).slice(0, 4)
              return (
                <button
                  key={p.id}
                  onClick={() => router.push(`/dashboard/customer/community/${p.id}`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 16,
                    padding: '14px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, marginBottom: 10 }}>
                    {p.content}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {tags.map(t => (
                      <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.22)', color: '#c9a84c' }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                    <div>작성자 {p.user_id?.slice(0, 6) || '-'}</div>
                    <div>{p.created_at ? new Date(p.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 글쓰기 플로팅 */}
      <button
        type="button"
        onClick={() => router.push('/dashboard/customer/community/new')}
        style={{
          position: 'fixed',
          right: 'calc(50% - 240px + 16px)',
          bottom: 88,
          width: 52,
          height: 52,
          borderRadius: 999,
          background: '#c9a84c',
          border: 'none',
          color: '#111',
          fontSize: 20,
          fontWeight: 900,
          cursor: 'pointer',
          boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
          zIndex: 40,
        }}
      >
        ✏️
      </button>

      <DashboardBottomNav role="customer" />
    </div>
  )
}

