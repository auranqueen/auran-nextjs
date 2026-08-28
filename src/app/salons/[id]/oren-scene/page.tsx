'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { orenSceneBadgeLabel, type OrenScenePostItem } from '@/lib/orenScene/display'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const CARD = 'rgba(255,255,255,0.05)'

export default function SalonOrenSceneListPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const salonId = params.id
  const [salonName, setSalonName] = useState('살롱')
  const [posts, setPosts] = useState<OrenScenePostItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [{ data: salon }, { data: rows }] = await Promise.all([
        supabase.from('salons').select('name').eq('id', salonId).maybeSingle(),
        supabase
          .from('oren_scene_posts')
          .select(
            'id, salon_id, video_url, thumbnail_url, content_type, uploader_type, view_count, like_count, highlight_tag, title, created_at',
          )
          .eq('salon_id', salonId)
          .eq('is_published', true)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      if (salon?.name) setSalonName(String(salon.name))
      setPosts((rows as OrenScenePostItem[]) ?? [])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [salonId, supabase])

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, maxWidth: 480, margin: '0 auto', padding: '16px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 20, cursor: 'pointer' }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>오렌씬</div>
          <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 2 }}>{salonName}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 32 }}>불러오는 중…</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 32 }}>등록된 오렌씬이 없어요</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {posts.map((post) => {
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
                {post.title ? (
                  <div
                    style={{
                      fontSize: 10,
                      color: TEXT,
                      marginTop: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {post.title}
                  </div>
                ) : null}
                <div style={{ fontSize: 9, color: TEXT_SUB, marginTop: 2 }}>
                  ❤ {Number(post.like_count || 0).toLocaleString()} · 조회{' '}
                  {Number(post.view_count || 0).toLocaleString()}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
