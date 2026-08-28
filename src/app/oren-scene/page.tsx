'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { orenSceneBadgeLabel } from '@/lib/orenScene/display'
import { isHotByScore, sevenDaysAgoIso } from '@/lib/orenScene/popularity'

const BG = '#0D0B09'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const PAGE_SIZE = 24
const VIEW = 'oren_scene_posts_with_popularity'
const POPULAR_DAYS_BACK = 7

type MainTab = 'popular' | 'latest' | 'all'
type ContentFilter = 'all' | 'verified' | 'free'

type SalonJoin = { name?: string | null }
type UploaderJoin = { name?: string | null }

type HubPost = {
  id: string
  salon_id: string | null
  video_url: string
  thumbnail_url: string | null
  content_type: string | null
  uploader_type: string | null
  view_count: number | null
  like_count: number | null
  popularity_score: number | null
  sort_score?: number | null
  title: string | null
  created_at: string
  salons: SalonJoin | SalonJoin[] | null
  uploader: UploaderJoin | UploaderJoin[] | null
}

type RpcHubRow = {
  id: string
  salon_id: string | null
  video_url: string
  thumbnail_url: string | null
  content_type: string | null
  uploader_type: string | null
  view_count: number | null
  like_count: number | null
  popularity_score: number | null
  sort_score: number | null
  title: string | null
  created_at: string
  salon_name: string | null
  uploader_name: string | null
}

type UserGeo = { lat: number; lng: number } | null

const SELECT_FIELDS = `
  id, salon_id, video_url, thumbnail_url, content_type, uploader_type,
  view_count, like_count, popularity_score, title, created_at,
  salons(name),
  uploader:users!oren_scene_posts_uploader_user_id_fkey(name)
`

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function displayName(post: HubPost): string {
  const salon = pickOne(post.salons)
  if (salon?.name) return String(salon.name)
  const uploader = pickOne(post.uploader)
  if (uploader?.name) return String(uploader.name)
  if (post.uploader_type === 'owner') return '원장'
  return '오렌씬'
}

function hubScore(post: HubPost): number {
  return Number(post.sort_score ?? post.popularity_score ?? 0)
}

function mapRpcRow(row: RpcHubRow): HubPost {
  return {
    id: row.id,
    salon_id: row.salon_id,
    video_url: row.video_url,
    thumbnail_url: row.thumbnail_url,
    content_type: row.content_type,
    uploader_type: row.uploader_type,
    view_count: row.view_count,
    like_count: row.like_count,
    popularity_score: row.popularity_score,
    sort_score: row.sort_score,
    title: row.title,
    created_at: row.created_at,
    salons: row.salon_name ? { name: row.salon_name } : null,
    uploader: row.uploader_name ? { name: row.uploader_name } : null,
  }
}

function applyContentFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  filter: ContentFilter,
): T {
  if (filter === 'verified') return query.eq('content_type', 'verified')
  if (filter === 'free') return query.eq('content_type', 'free')
  return query
}

function applyTabFilter<T extends { gte: (col: string, val: string) => T }>(
  query: T,
  tab: MainTab,
): T {
  if (tab === 'popular') return query.gte('created_at', sevenDaysAgoIso())
  return query
}

function daysBackForTab(tab: MainTab): number | null {
  if (tab === 'popular') return POPULAR_DAYS_BACK
  return null
}

async function requestUserGeo(): Promise<UserGeo> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    )
  })
}

async function fetchHubCount(
  supabase: SupabaseClient,
  tab: MainTab,
  filter: ContentFilter,
): Promise<number> {
  let countQuery = supabase.from(VIEW).select('id', { count: 'exact', head: true })
  countQuery = applyContentFilter(countQuery, filter)
  countQuery = applyTabFilter(countQuery, tab)
  const { count, error } = await countQuery
  if (error || !count) return 0
  return count
}

async function fetchHotScoreThreshold(
  supabase: SupabaseClient,
  tab: MainTab,
  filter: ContentFilter,
  geo: UserGeo,
): Promise<number | null> {
  if (tab === 'latest') return null

  const count = await fetchHubCount(supabase, tab, filter)
  if (count <= 0) return null

  const hotCount = Math.max(1, Math.ceil(count * 0.2))
  const { data, error } = await supabase.rpc('get_oren_scene_hub', {
    p_lat: geo?.lat ?? null,
    p_lng: geo?.lng ?? null,
    p_content_filter: filter,
    p_days_back: daysBackForTab(tab),
    p_offset: hotCount - 1,
    p_limit: 1,
  })
  if (error || !data?.length) return null

  const minScore = Number((data[0] as RpcHubRow).sort_score ?? 0)
  return minScore > 0 ? minScore : null
}

async function fetchPostsPageRpc(
  supabase: SupabaseClient,
  tab: MainTab,
  filter: ContentFilter,
  geo: UserGeo,
  offset: number,
): Promise<HubPost[]> {
  const { data, error } = await supabase.rpc('get_oren_scene_hub', {
    p_lat: geo?.lat ?? null,
    p_lng: geo?.lng ?? null,
    p_content_filter: filter,
    p_days_back: daysBackForTab(tab),
    p_offset: offset,
    p_limit: PAGE_SIZE,
  })
  if (error) {
    console.error('oren-scene hub rpc error', error.message)
    return []
  }
  return ((data as RpcHubRow[]) ?? []).map(mapRpcRow)
}

async function fetchPostsPageLatest(
  supabase: SupabaseClient,
  filter: ContentFilter,
  offset: number,
): Promise<HubPost[]> {
  const to = offset + PAGE_SIZE - 1
  let query = supabase.from(VIEW).select(SELECT_FIELDS)
  query = applyContentFilter(query, filter)
  query = query.order('created_at', { ascending: false })
  const { data, error } = await query.range(offset, to)
  if (error) {
    console.error('oren-scene hub fetch error', error.message)
    return []
  }
  return (data as HubPost[]) ?? []
}

async function fetchPostsPage(
  supabase: SupabaseClient,
  tab: MainTab,
  filter: ContentFilter,
  geo: UserGeo,
  offset: number,
): Promise<HubPost[]> {
  if (tab === 'latest') {
    return fetchPostsPageLatest(supabase, filter, offset)
  }
  return fetchPostsPageRpc(supabase, tab, filter, geo, offset)
}

export default function OrenSceneHubPage() {
  const router = useRouter()
  const supabase = createClient()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const offsetRef = useRef(0)
  const hasMoreRef = useRef(true)
  const userGeoRef = useRef<UserGeo | undefined>(undefined)

  const [mainTab, setMainTab] = useState<MainTab>('popular')
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all')
  const [posts, setPosts] = useState<HubPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [hotScoreMin, setHotScoreMin] = useState<number | null>(null)
  const [hasGeoBonus, setHasGeoBonus] = useState(false)

  const ensureGeo = useCallback(async (): Promise<UserGeo> => {
    if (userGeoRef.current !== undefined) return userGeoRef.current
    const geo = await requestUserGeo()
    userGeoRef.current = geo
    setHasGeoBonus(geo != null)
    return geo
  }, [])

  const loadInitial = useCallback(async () => {
    setLoading(true)
    setLoadingMore(false)
    loadingMoreRef.current = false
    offsetRef.current = 0
    setHasMore(true)
    hasMoreRef.current = true

    const geo = mainTab === 'latest' ? null : await ensureGeo()

    const [threshold, rows] = await Promise.all([
      fetchHotScoreThreshold(supabase, mainTab, contentFilter, geo),
      fetchPostsPage(supabase, mainTab, contentFilter, geo, 0),
    ])

    setHotScoreMin(threshold)
    setPosts(rows)
    offsetRef.current = rows.length
    const more = rows.length === PAGE_SIZE
    setHasMore(more)
    hasMoreRef.current = more
    setLoading(false)
  }, [contentFilter, ensureGeo, mainTab, supabase])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || loading) return
    loadingMoreRef.current = true
    setLoadingMore(true)

    const geo = mainTab === 'latest' ? null : userGeoRef.current ?? null
    const from = offsetRef.current
    const rows = await fetchPostsPage(supabase, mainTab, contentFilter, geo, from)

    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id))
      const next = rows.filter((r) => !seen.has(r.id))
      return next.length ? [...prev, ...next] : prev
    })

    offsetRef.current = from + rows.length
    const more = rows.length === PAGE_SIZE
    setHasMore(more)
    hasMoreRef.current = more
    loadingMoreRef.current = false
    setLoadingMore(false)
  }, [contentFilter, loading, mainTab, supabase])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasMore || loading) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loadMore, loading, posts.length])

  const mainTabs: { key: MainTab; label: string }[] = [
    { key: 'popular', label: '인기' },
    { key: 'latest', label: '최신' },
    { key: 'all', label: '전체' },
  ]

  const contentChips: { key: ContentFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'verified', label: '✓ 인증' },
    { key: 'free', label: '✨ 자유' },
  ]

  const showHotBadge = mainTab !== 'latest'

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, maxWidth: 480, margin: '0 auto' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(13,11,9,0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${BORDER}`,
          padding: '14px 16px 12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 20, cursor: 'pointer', padding: 0 }}
            aria-label="뒤로"
          >
            ←
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>🎬 오렌씬</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {mainTabs.map((t) => {
            const active = mainTab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setMainTab(t.key)}
                style={{
                  flex: 1,
                  border: active ? `1px solid ${PURPLE}` : `1px solid ${BORDER}`,
                  background: active ? 'rgba(123,94,167,0.2)' : CARD,
                  color: active ? TEXT : TEXT_SUB,
                  borderRadius: 10,
                  padding: '10px 0',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {contentChips.map((c) => {
            const active = contentFilter === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setContentFilter(c.key)}
                style={{
                  flexShrink: 0,
                  border: active ? `1px solid ${PURPLE}` : `1px solid ${BORDER}`,
                  background: active ? 'rgba(123,94,167,0.15)' : 'transparent',
                  color: active ? TEXT : TEXT_SUB,
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {mainTab === 'popular' ? (
          <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 10, lineHeight: 1.5 }}>
            최근 7일 · {hasGeoBonus ? '인기+거리 가중치' : '인기순 (위치 미허용)'}
          </div>
        ) : mainTab === 'all' && hasGeoBonus ? (
          <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 10, lineHeight: 1.5 }}>
            인기+거리 가중치
          </div>
        ) : null}
      </div>

      <div style={{ padding: '12px 12px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 48 }}>불러오는 중…</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 48 }}>
            {mainTab === 'popular' ? '이번 주 등록된 오렌씬이 없어요' : '등록된 오렌씬이 없어요'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {posts.map((post) => {
              const thumb = String(post.thumbnail_url || '').trim()
              const videoUrl = String(post.video_url || '').trim()
              const isHot = showHotBadge && isHotByScore(hubScore(post), hotScoreMin)
              const name = displayName(post)
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => router.push(`/oren-scene/${post.id}`)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    minWidth: 0,
                    color: 'inherit',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '9/16',
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: CARD,
                      border: `1px solid ${BORDER}`,
                    }}
                  >
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : videoUrl ? (
                      <video
                        src={videoUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                        }}
                      >
                        🎬
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: 5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 700,
                          color: '#fff',
                          background: 'rgba(0,0,0,0.55)',
                          borderRadius: 5,
                          padding: '2px 5px',
                          lineHeight: 1.2,
                        }}
                      >
                        {orenSceneBadgeLabel(post)}
                      </span>
                      {isHot ? (
                        <span
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            color: '#fff',
                            background: 'rgba(220,80,40,0.85)',
                            borderRadius: 5,
                            padding: '2px 5px',
                            lineHeight: 1.2,
                          }}
                        >
                          🔥 인기
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: TEXT,
                      marginTop: 5,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {name}
                  </div>
                  <div style={{ fontSize: 9, color: TEXT_SUB, marginTop: 2 }}>
                    ❤ {Number(post.like_count || 0).toLocaleString()} · 조회{' '}
                    {Number(post.view_count || 0).toLocaleString()}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && hasMore ? (
          <div ref={loadMoreRef} style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 12, padding: '24px 0' }}>
            {loadingMore ? '더 불러오는 중…' : '스크롤하여 더 보기'}
          </div>
        ) : null}
      </div>
    </div>
  )
}
