'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { orenSceneBadgeLabel } from '@/lib/orenScene/display'
import {
  computeSortScore,
  isHotRank,
  sevenDaysAgoIso,
} from '@/lib/orenScene/popularity'

const BG = '#0D0B09'
const CARD = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(255,255,255,0.08)'
const PURPLE = '#7B5EA7'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const PAGE_SIZE = 24

type MainTab = 'popular' | 'latest' | 'all'
type ContentFilter = 'all' | 'verified' | 'free'

type SalonJoin = { name?: string | null; lat?: number | null; lng?: number | null }
type UploaderJoin = { name?: string | null }

type RawPost = {
  id: string
  salon_id: string | null
  video_url: string
  thumbnail_url: string | null
  content_type: string | null
  uploader_type: string | null
  view_count: number | null
  like_count: number | null
  booking_conversion_count: number | null
  revenue_generated: number | null
  title: string | null
  created_at: string
  salons: SalonJoin | SalonJoin[] | null
  uploader: UploaderJoin | UploaderJoin[] | null
}

type HubCard = RawPost & {
  sortScore: number
  isHot: boolean
  displayName: string
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function salonCoords(post: RawPost): { lat: number | null; lng: number | null } {
  const salon = pickOne(post.salons)
  const lat = salon?.lat != null ? Number(salon.lat) : null
  const lng = salon?.lng != null ? Number(salon.lng) : null
  return {
    lat: lat != null && Number.isFinite(lat) ? lat : null,
    lng: lng != null && Number.isFinite(lng) ? lng : null,
  }
}

function displayName(post: RawPost): string {
  const salon = pickOne(post.salons)
  if (salon?.name) return String(salon.name)
  const uploader = pickOne(post.uploader)
  if (uploader?.name) return String(uploader.name)
  if (post.uploader_type === 'owner') return '원장'
  return '오렌씬'
}

function matchesContentFilter(post: RawPost, filter: ContentFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'verified') return post.content_type === 'verified'
  if (filter === 'free') return post.content_type === 'free'
  return true
}

export default function OrenSceneHubPage() {
  const router = useRouter()
  const supabase = createClient()
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const [mainTab, setMainTab] = useState<MainTab>('popular')
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all')
  const [rawPosts, setRawPosts] = useState<RawPost[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE)
  const [loggedIn, setLoggedIn] = useState(false)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setLoggedIn(Boolean(data.user))
    })
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (!loggedIn || typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }, [loggedIn])

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setDisplayCount(PAGE_SIZE)

    let query = supabase
      .from('oren_scene_posts')
      .select(
        `id, salon_id, video_url, thumbnail_url, content_type, uploader_type,
         view_count, like_count, booking_conversion_count, revenue_generated,
         title, created_at,
         salons(name, lat, lng),
         uploader:users!oren_scene_posts_uploader_user_id_fkey(name)`,
      )
      .eq('is_published', true)

    if (mainTab === 'popular') {
      query = query.gte('created_at', sevenDaysAgoIso())
    }

    if (mainTab === 'latest') {
      query = query.order('created_at', { ascending: false }).limit(300)
    } else {
      query = query.order('created_at', { ascending: false }).limit(500)
    }

    const { data } = await query
    setRawPosts((data as RawPost[]) ?? [])
    setLoading(false)
  }, [mainTab, supabase])

  useEffect(() => {
    void fetchPosts()
  }, [fetchPosts])

  const cards = useMemo((): HubCard[] => {
    const filtered = rawPosts.filter((p) => matchesContentFilter(p, contentFilter))

    if (mainTab === 'latest') {
      return filtered.map((post) => ({
        ...post,
        sortScore: 0,
        isHot: false,
        displayName: displayName(post),
      }))
    }

    const applyDistance = mainTab === 'popular' && loggedIn && userLat != null && userLng != null

    const scored = filtered.map((post) => {
      const { lat, lng } = salonCoords(post)
      const sortScore = computeSortScore(
        {
          like_count: post.like_count,
          view_count: post.view_count,
          booking_conversion_count: post.booking_conversion_count,
          revenue_generated: post.revenue_generated,
          salonLat: lat,
          salonLng: lng,
        },
        { userLat, userLng, applyDistance },
      )
      return { post, sortScore }
    })

    scored.sort((a, b) => {
      if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore
      return new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime()
    })

    const total = scored.length
    return scored.map(({ post, sortScore }, index) => ({
      ...post,
      sortScore,
      isHot: isHotRank(index, total, sortScore),
      displayName: displayName(post),
    }))
  }, [rawPosts, contentFilter, mainTab, loggedIn, userLat, userLng])

  const visibleCards = cards.slice(0, displayCount)
  const hasMore = displayCount < cards.length

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasMore) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setDisplayCount((c) => Math.min(c + PAGE_SIZE, cards.length))
        }
      },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, cards.length])

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
                onClick={() => {
                  setContentFilter(c.key)
                  setDisplayCount(PAGE_SIZE)
                }}
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
            최근 7일 게시물 · 누적 지표 기준
            {loggedIn && userLat != null ? ' · 가까운 살롱 가산' : ''}
          </div>
        ) : null}
      </div>

      <div style={{ padding: '12px 12px 32px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 48 }}>불러오는 중…</div>
        ) : visibleCards.length === 0 ? (
          <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 48 }}>
            {mainTab === 'popular' ? '이번 주 등록된 오렌씬이 없어요' : '등록된 오렌씬이 없어요'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {visibleCards.map((post) => {
              const thumb = String(post.thumbnail_url || '').trim()
              const videoUrl = String(post.video_url || '').trim()
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
                      {post.isHot ? (
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
                    {post.displayName}
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
            더 불러오는 중…
          </div>
        ) : null}
      </div>
    </div>
  )
}
