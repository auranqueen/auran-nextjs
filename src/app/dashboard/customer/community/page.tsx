'use client'

import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import DashboardHeader from '@/components/DashboardHeader'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

type TabId = 'all' | 'hot' | 'skin' | 'review' | 'salon' | 'routine' | 'qa' | 'menopause' | 'contest'

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
  skin_type?: string | null
  is_expert_answered?: boolean | null
  product_tags?: string[] | null
  _u?: { name?: string | null; avatar_url?: string | null; customer_grade?: string | null; auth_id?: string | null } | null
  _p?: { username?: string | null; full_name?: string | null; grade?: string | null; avatar_url?: string | null } | null
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'hot', label: '인기' },
  { id: 'skin', label: '피부고민' },
  { id: 'review', label: '제품리뷰' },
  { id: 'salon', label: '살롱후기' },
  { id: 'routine', label: '스킨루틴' },
  { id: 'qa', label: 'Q&A' },
  { id: 'menopause', label: '갱년기' },
  { id: 'contest', label: '컨테스트' },
]

function contestDDayLabel(endAt: string) {
  const e = new Date(endAt)
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime()
  const t = new Date()
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const n = Math.ceil((endDay - today) / 86400000)
  return n <= 0 ? 'D-DAY' : `D-${n}일`
}

export default function CustomerCommunityPage() {
  const supabase = createClient()
  const router = useRouter()
  const contestAnchorRef = useRef<HTMLDivElement | null>(null)
  const [tab, setTab] = useState<TabId>('all')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [scrappedIds, setScrappedIds] = useState<Set<string>>(new Set())

  const [contestRow, setContestRow] = useState<any>(null)
  const [contestEntries, setContestEntries] = useState<any[]>([])
  const [contestVoteCost, setContestVoteCost] = useState(10)
  const [contestDiscount, setContestDiscount] = useState(50)
  const [contestTick, setContestTick] = useState(0)
  const [contestBusy, setContestBusy] = useState<string | null>(null)
  const [chargeModal, setChargeModal] = useState(false)
  const [votedContest, setVotedContest] = useState(false)
  const [skinFilter, setSkinFilter] = useState<'' | '건성' | '지성' | '복합성' | '민감성'>('')

  const activeLabel = useMemo(() => TABS.find((t) => t.id === tab)?.label ?? '커뮤니티', [tab])

  const loadActiveContest = useCallback(async () => {
    const iso = new Date().toISOString()
    const { data: c } = await supabase
      .from('contests')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'active')
      .lte('start_at', iso)
      .gte('end_at', iso)
      .limit(1)
      .maybeSingle()
    setContestRow(c || null)
    if (!c?.id) {
      setContestEntries([])
      setVotedContest(false)
      return
    }
    const [{ data: ent }, { data: sets }, { data: auth }] = await Promise.all([
      supabase.from('contest_entries').select('*').eq('contest_id', c.id).order('vote_count', { ascending: false }),
      supabase.from('admin_settings').select('key,value').eq('category', 'contest').in('key', ['contest_vote_cost', 'contest_voter_discount']),
      supabase.auth.getUser(),
    ])
    setContestEntries(ent || [])
    const m: Record<string, string> = {}
    ;(sets || []).forEach((r: { key: string; value: string | null }) => {
      m[r.key] = String(r.value ?? '')
    })
    setContestVoteCost(Number(m.contest_vote_cost ?? 10))
    setContestDiscount(Number(m.contest_voter_discount ?? 50))
    const user = auth?.user
    if (user?.id) {
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (urow?.id) {
        const { data: prev } = await supabase.from('contest_votes').select('id').eq('contest_id', c.id).eq('voter_user_id', urow.id).limit(1)
        setVotedContest(!!(prev && prev.length > 0))
      } else setVotedContest(false)
    } else setVotedContest(false)
  }, [supabase])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('tab') === 'contest') setTab('contest')
  }, [])

  useEffect(() => {
    void loadActiveContest()
    const i = setInterval(() => void loadActiveContest(), 8000)
    return () => clearInterval(i)
  }, [loadActiveContest])

  useEffect(() => {
    if (tab !== 'contest') return
    const i = setInterval(() => setContestTick((x) => x + 1), 1000)
    return () => clearInterval(i)
  }, [tab])

  useEffect(() => {
    const run = async () => {
      if (tab === 'contest') {
        setPosts([])
        setLikedIds(new Set())
        setScrappedIds(new Set())
        setLoading(false)
        return
      }
      setLoading(true)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      let query = supabase
        .from('posts')
        .select('id,user_id,category,title,content,image_urls,hashtags,likes,views,created_at,skin_type,is_expert_answered,product_tags')

      if (tab === 'hot') {
        query = query.order('likes', { ascending: false }).order('views', { ascending: false }).limit(10)
      } else {
        query = query.order('created_at', { ascending: false }).limit(40)
      }

      if (tab !== 'all' && tab !== 'hot') {
        query = query.eq('category', tab)
      }

      if (skinFilter) {
        query = query.eq('skin_type', skinFilter)
      }

      const tag = q.trim().replace(/^#/, '')
      if (tag) {
        query = query.contains('hashtags', [tag])
      }

      const { data } = await query
      let list = (data || []) as Post[]
      const uidSet = Array.from(new Set(list.map((p) => p.user_id).filter(Boolean)))
      if (uidSet.length > 0) {
        const { data: us } = await supabase.from('users').select('id,name,avatar_url,customer_grade,auth_id').in('id', uidSet)
        const umap = Object.fromEntries((us || []).map((u: any) => [u.id, u]))
        const aids = Array.from(new Set((us || []).map((u: any) => u.auth_id).filter(Boolean)))
        let pmap: Record<string, any> = {}
        if (aids.length > 0) {
          const { data: profs } = await supabase.from('profiles').select('auth_id,username,grade,avatar_url,full_name').in('auth_id', aids)
          pmap = Object.fromEntries((profs || []).map((pr: any) => [pr.auth_id, pr]))
        }
        list = list.map((p) => {
          const u = umap[p.user_id]
          const pr = u?.auth_id ? pmap[u.auth_id] : null
          return { ...p, _u: u, _p: pr }
        })
      }
      setPosts(list)

      if (!user || list.length === 0) {
        setLikedIds(new Set())
        setScrappedIds(new Set())
        setLoading(false)
        return
      }

      const ids = list.map((p) => p.id)
      const [likesRes, scrapsRes] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', ids),
        supabase.from('post_scraps').select('post_id').eq('user_id', user.id).in('post_id', ids),
      ])
      setLikedIds(new Set((likesRes.data || []).map((x: any) => x.post_id)))
      setScrappedIds(new Set((scrapsRes.data || []).map((x: any) => x.post_id)))
      setLoading(false)
    }
    run()
  }, [q, supabase, tab, skinFilter])

  const onVote = async (entryId: string) => {
    if (!contestRow?.id) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const { data: urow, error: ue } = await supabase.from('users').select('id, points, customer_grade').eq('auth_id', user.id).maybeSingle()
    if (ue || !urow?.id) {
      alert('회원 정보를 확인할 수 없어요')
      return
    }
    const { data: dup } = await supabase.from('contest_votes').select('id').eq('contest_id', contestRow.id).eq('voter_user_id', urow.id).limit(1)
    if (dup && dup.length > 0) {
      alert('이미 이 컨테스트에 투표했어요')
      return
    }
    const cost = contestVoteCost
    const bal = Number(urow.points || 0)
    if (bal < cost) {
      setChargeModal(true)
      return
    }
    setContestBusy(entryId)
    try {
      const { error: vErr } = await supabase.from('contest_votes').insert({
        contest_id: contestRow.id,
        entry_id: entryId,
        voter_user_id: urow.id,
        votes_count: 1,
        toast_spent: cost,
        voter_grade: (urow as { customer_grade?: string }).customer_grade || null,
        created_at: new Date().toISOString(),
      })
      if (vErr) {
        alert(vErr.message)
        return
      }
      const { error: ptErr } = await supabase.from('point_transactions').insert({
        user_id: user.id,
        amount: -cost,
        type: 'contest_vote',
        description: '컨테스트 투표',
      })
      if (ptErr) {
        alert(ptErr.message)
        return
      }
      await supabase.from('users').update({ points: bal - cost }).eq('id', urow.id)
      const ent = contestEntries.find((e) => e.id === entryId)
      const vc = Number(ent?.vote_count || 0) + 1
      await supabase.from('contest_entries').update({ vote_count: vc }).eq('id', entryId)
      setVotedContest(true)
      await loadActiveContest()
      alert(`투표했어요! 당선되면 ${contestDiscount}% 할인 쿠폰 드려요 💜`)
    } finally {
      setContestBusy(null)
    }
  }

  const toggleLike = async (postId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const has = likedIds.has(postId)
    const next = new Set(likedIds)
    if (has) next.delete(postId)
    else next.add(postId)
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login?role=customer')
      return
    }
    const has = scrappedIds.has(postId)
    const next = new Set(scrappedIds)
    if (has) next.delete(postId)
    else next.add(postId)
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
    <div className="relative mx-auto min-h-screen w-full max-w-[390px] bg-[#0D0B09] pb-24">
      <DashboardHeader title={activeLabel} right={<CustomerHeaderRight />} />

      {contestRow ? (
        <div style={{ padding: '10px 16px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              background: 'linear-gradient(135deg, rgba(123,94,167,0.18), rgba(201,169,110,0.08))',
              border: '1px solid rgba(123,94,167,0.28)',
              borderRadius: 14,
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 11, color: '#fff', lineHeight: 1.45, flex: 1, minWidth: 0 }}>
              🏆 {contestRow.title} · {contestDDayLabel(contestRow.end_at)} · 투표하면 반값!
            </div>
            <button
              type="button"
              onClick={() => {
                setTab('contest')
                setTimeout(() => contestAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
              }}
              style={{
                flexShrink: 0,
                border: 'none',
                borderRadius: 999,
                padding: '6px 12px',
                background: '#7B5EA7',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              바로가기
            </button>
          </div>
        </div>
      ) : null}

      {/* 검색 + 탭 */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 14, color: TEXT_DIM }}>🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="#해시태그 검색"
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                borderRadius: 16,
                background: CARD_BG,
                border: CARD_BORDER,
                color: '#fff',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' as const }}>
          {TABS.map((t) => {
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
                  background: active ? 'rgba(201,169,110,0.14)' : CARD_BG,
                  border: `1px solid ${active ? 'rgba(201,169,110,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  color: active ? GOLD : TEXT_MUTED,
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {tab !== 'contest' ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 8 }}>
            {(['전체', '건성', '지성', '복합성', '민감성'] as const).map((label) => {
              const val = label === '전체' ? '' : label
              const active = skinFilter === val
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSkinFilter(val as typeof skinFilter)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: active ? 'rgba(123,94,167,0.18)' : CARD_BG,
                    border: `1px solid ${active ? 'rgba(123,94,167,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    color: active ? '#e8d6ff' : TEXT_MUTED,
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding: '6px 16px 0' }}>
        {loading ? (
          <div style={{ fontSize: 12, color: TEXT_MUTED }}>불러오는 중...</div>
        ) : tab === 'contest' ? (
          <div ref={contestAnchorRef}>
            {!contestRow ? (
              <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '12px 0' }}>진행 중인 공개 컨테스트가 없어요</div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{contestRow.title}</div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                    테마 {contestRow.theme} · {new Date(contestRow.start_at).toLocaleDateString('ko-KR')} ~ {new Date(contestRow.end_at).toLocaleDateString('ko-KR')}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#c4a7e7', fontFamily: 'monospace' }}>
                    마감까지 {contestDDayLabel(contestRow.end_at)}
                    {votedContest ? <span style={{ marginLeft: 8, color: GOLD }}>· 투표 완료</span> : null}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: TEXT_MUTED, fontFamily: 'monospace' }}>
                    {(() => {
                      void contestTick
                      const ms = Math.max(0, new Date(contestRow.end_at).getTime() - Date.now())
                      const h = Math.floor(ms / 3600000)
                      const mm = Math.floor((ms % 3600000) / 60000)
                      const s = Math.floor((ms % 60000) / 1000)
                      return `남은 시간 ${h}시간 ${mm}분 ${s}초`
                    })()}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {contestEntries.map((en) => (
                    <div
                      key={en.id}
                      style={{
                        background: CARD_BG,
                        border: CARD_BORDER,
                        borderRadius: 14,
                        overflow: 'hidden',
                        paddingBottom: 8,
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '1/1', background: 'rgba(255,255,255,0.05)' }}>
                        {en.media_url ? (
                          <img src={en.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                            🖼️
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '8px 10px 0', fontSize: 11, color: '#fff', fontWeight: 600 }}>{en.artist_name || '작가'}</div>
                      <div style={{ padding: '2px 10px 6px', fontSize: 10, color: TEXT_MUTED }}>투표 {Number(en.vote_count || 0).toLocaleString()}</div>
                      <div style={{ padding: '0 10px' }}>
                        <button
                          type="button"
                          disabled={!!contestBusy || votedContest}
                          onClick={() => onVote(en.id)}
                          style={{
                            width: '100%',
                            border: 'none',
                            borderRadius: 10,
                            padding: '8px 0',
                            background: votedContest ? 'rgba(255,255,255,0.08)' : '#7B5EA7',
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: votedContest ? 'default' : 'pointer',
                          }}
                        >
                          {votedContest ? '투표 완료' : `투표하기 ${contestVoteCost}T`}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {contestEntries.length === 0 ? <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 10 }}>등록된 작품이 없어요</div> : null}
              </>
            )}
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 12px 40px' }}>
            <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.65, marginBottom: 18 }}>
              아직 글이 없어요
              <br />
              첫 번째 글을 써보세요 💜
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/customer/community/new')}
              style={{
                padding: '10px 22px',
                borderRadius: 999,
                border: 'none',
                background: '#7B5EA7',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              글 쓰기
            </button>
          </div>
        ) : tab === 'hot' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => router.push(`/dashboard/customer/community/${p.id}`)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: CARD_BG,
                  border: CARD_BORDER,
                  borderRadius: 16,
                  padding: '12px 12px',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: 24, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 900, color: GOLD }}>{idx + 1}</div>
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
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {p.is_expert_answered ? (
                      <span
                        style={{
                          fontSize: 9,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(201,169,110,0.15)',
                          color: GOLD,
                          fontWeight: 600,
                        }}
                      >
                        👩‍⚕️ 전문가답변
                      </span>
                    ) : null}
                    {p._p?.grade || p._u?.customer_grade ? (
                      <span
                        style={{
                          fontSize: 9,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(123,94,167,0.2)',
                          color: '#e8d6ff',
                          fontWeight: 600,
                        }}
                      >
                        {p._p?.grade || p._u?.customer_grade}
                      </span>
                    ) : null}
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
            {posts.map((p) => {
              const hasImg = !!p.image_urls?.[0]
              return (
                <div
                  key={p.id}
                  style={{
                    background: CARD_BG,
                    border: CARD_BORDER,
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
                      <>
                        <div style={{ width: '100%', aspectRatio: '1 / 1', background: `url(${p.image_urls![0]}) center/cover no-repeat` }} />
                        <div style={{ padding: '6px 8px 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {p.is_expert_answered ? (
                            <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(201,169,110,0.15)', color: GOLD, fontWeight: 600 }}>👩‍⚕️ 전문가답변</span>
                          ) : null}
                          {p._p?.grade || p._u?.customer_grade ? (
                            <span style={{ fontSize: 8, padding: '2px 6px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#e8d6ff', fontWeight: 600 }}>
                              {p._p?.grade || p._u?.customer_grade}
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '12px 12px', height: 140, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>{p.title}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.70)',
                            lineHeight: 1.6,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical' as const,
                          }}
                        >
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
                    <button type="button" onClick={() => toggleScrap(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: scrappedIds.has(p.id) ? GOLD : 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                      🔖
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map((p) => {
              const tags = (p.hashtags || []).slice(0, 4)
              return (
                <button
                  key={p.id}
                  onClick={() => router.push(`/dashboard/customer/community/${p.id}`)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: CARD_BG,
                    border: CARD_BORDER,
                    borderRadius: 16,
                    padding: '14px 14px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>{p.title}</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.70)',
                      lineHeight: 1.6,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      marginBottom: 10,
                    }}
                  >
                    {p.content}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {tags.map((tg) => (
                      <span
                        key={tg}
                        style={{
                          fontSize: 10,
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: 'rgba(201,168,76,0.12)',
                          border: '1px solid rgba(201,168,76,0.22)',
                          color: GOLD,
                        }}
                      >
                        #{tg}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    {p.is_expert_answered ? (
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: 'rgba(201,169,110,0.15)', color: GOLD, fontWeight: 600 }}>👩‍⚕️ 전문가답변</span>
                    ) : null}
                    {p._p?.grade || p._u?.customer_grade ? (
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 999, background: 'rgba(123,94,167,0.2)', color: '#e8d6ff', fontWeight: 600 }}>
                        {p._p?.grade || p._u?.customer_grade}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                    <div>
                      작성자 {p._p?.username || p._p?.full_name || p._u?.name || p.user_id?.slice(0, 6) || '-'}
                    </div>
                    <div>{p.created_at ? new Date(p.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {chargeModal ? (
        <>
          <div onClick={() => setChargeModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 80 }} />
          <div
            style={{
              position: 'fixed',
              left: '50%',
              top: '40%',
              transform: 'translate(-50%, -50%)',
              width: 'min(300px, 90vw)',
              background: '#1a1520',
              border: '1px solid rgba(123,94,167,0.35)',
              borderRadius: 16,
              padding: 20,
              zIndex: 90,
            }}
          >
            <div style={{ fontSize: 14, color: '#fff', marginBottom: 10 }}>토스트가 부족해요</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 16 }}>충전 후 투표하세요 💜</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setChargeModal(false)} style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}>
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setChargeModal(false)
                  router.push('/my/point')
                }}
                style={{ border: 'none', background: '#7B5EA7', color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
              >
                충전하기
              </button>
            </div>
          </div>
        </>
      ) : null}

      {tab !== 'contest' ? (
        <button
          type="button"
          onClick={() => router.push('/dashboard/customer/community/new')}
          style={{
            position: 'fixed',
            right: 'max(16px, calc((100vw - 390px) / 2 + 16px))',
            bottom: 88,
            width: 52,
            height: 52,
            borderRadius: 999,
            background: GOLD,
            border: 'none',
            color: '#0D0B09',
            fontSize: 20,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
            zIndex: 40,
          }}
        >
          ✏️
        </button>
      ) : null}

      <DashboardBottomNav role="customer" />
    </div>
  )
}
