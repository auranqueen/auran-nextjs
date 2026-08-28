'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  groupOrenSceneByHighlightTag,
  orenSceneBadgeLabel,
  type OrenScenePostItem,
} from '@/lib/orenScene/display'

const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const CARD = 'rgba(255,255,255,0.05)'

type Props = {
  salonId: string
  isSalonOwner: boolean
}

export default function SalonOrenSceneSection({ salonId, isSalonOwner }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [posts, setPosts] = useState<OrenScenePostItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void supabase
      .from('oren_scene_posts')
      .select(
        'id, salon_id, video_url, thumbnail_url, content_type, uploader_type, view_count, like_count, highlight_tag, title, created_at',
      )
      .eq('salon_id', salonId)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setPosts((data as OrenScenePostItem[]) ?? [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [salonId, supabase])

  const highlightGroups = useMemo(() => groupOrenSceneByHighlightTag(posts), [posts])
  const gridPosts = posts.slice(0, 9)

  if (loading) {
    return (
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, color: TEXT, marginBottom: 12, fontWeight: 700 }}>🎬 오렌씬</div>
        <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 24 }}>불러오는 중…</div>
      </div>
    )
  }

  if (posts.length === 0 && !isSalonOwner) {
    return null
  }

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 13, color: TEXT, marginBottom: 14, fontWeight: 700 }}>🎬 오렌씬</div>

      {(highlightGroups.length > 0 || isSalonOwner) ? (
        <div
          style={{
            display: 'flex',
            gap: 14,
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: 16,
            scrollbarWidth: 'none',
          }}
        >
          {isSalonOwner ? (
            <button
              type="button"
              onClick={() => router.push(`/oren-scene/upload?salon_id=${encodeURIComponent(salonId)}`)}
              style={{
                flexShrink: 0,
                width: 72,
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                color: TEXT,
              }}
              aria-label="오렌씬 업로드"
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  border: `2px dashed ${PURPLE}`,
                  background: PURPLE_LIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 700,
                  color: PURPLE,
                  margin: '0 auto',
                }}
              >
                +
              </div>
              <div style={{ fontSize: 10, color: TEXT_SUB, marginTop: 6, textAlign: 'center' }}>업로드</div>
            </button>
          ) : null}

          {highlightGroups.map((group) => {
            const thumb = String(group.repThumbnail || '').trim()
            const videoUrl = String(group.repVideoUrl || '').trim()
            return (
              <button
                key={group.tag}
                type="button"
                onClick={() => router.push(`/oren-scene/${group.repPostId}`)}
                style={{
                  flexShrink: 0,
                  width: 72,
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  color: TEXT,
                  textAlign: 'center',
                }}
              >
                <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto' }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: `2px solid ${PURPLE}`,
                      background: PURPLE_LIGHT,
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
                          fontSize: 20,
                        }}
                      >
                        🎬
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: PURPLE,
                      border: `2px solid ${TEXT}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      lineHeight: 1,
                    }}
                  >
                    ▶
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: TEXT,
                    marginTop: 6,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 72,
                  }}
                >
                  {group.tag}
                </div>
                <div style={{ fontSize: 9, color: TEXT_SUB, marginTop: 2 }}>
                  조회 {group.totalViews.toLocaleString()}
                </div>
              </button>
            )
          })}
        </div>
      ) : null}

      {gridPosts.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
          }}
        >
          {gridPosts.map((post) => {
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
                  cursor: 'pointer',
                  color: TEXT,
                  textAlign: 'left',
                  minWidth: 0,
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
                      fontSize: 8,
                      fontWeight: 700,
                      color: '#fff',
                      background: 'rgba(0,0,0,0.55)',
                      borderRadius: 5,
                      padding: '2px 5px',
                    }}
                  >
                    {orenSceneBadgeLabel(post)}
                  </div>
                </div>
                <div style={{ fontSize: 9, color: TEXT_SUB, marginTop: 4 }}>
                  ❤ {Number(post.like_count || 0).toLocaleString()} · 조회{' '}
                  {Number(post.view_count || 0).toLocaleString()}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 12, padding: '8px 0 16px' }}>
          아직 등록된 오렌씬이 없어요
        </div>
      )}

      {posts.length > 0 ? (
        <button
          type="button"
          onClick={() => router.push(`/salons/${salonId}/oren-scene`)}
          style={{
            width: '100%',
            marginTop: 14,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            background: CARD,
            color: PURPLE,
            padding: '11px 0',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          더보기 · {posts.length}개 전체
        </button>
      ) : null}
    </div>
  )
}
