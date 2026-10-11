'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type Hls from 'hls.js'

const TEXT = '#1A1A2E'
const SUB = '#888888'
const BORDER = '#ede9f7'

interface BroadcastDetail {
  id: number
  owner_id: string | null
  title: string
  description: string | null
  status: string
  hls_url: string | null
  scheduled_at: string | null
  started_at: string | null
}

function VideoPlayer({ hlsUrl }: { hlsUrl: string }) {
  useEffect(() => {
    let hls: Hls | null = null
    const video = document.getElementById('live-video') as HTMLVideoElement | null
    if (!video) return
    const setup = async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl
        video.play().catch(() => {})
        return
      }
      try {
        const { default: HlsLib } = await import('hls.js')
        if (HlsLib.isSupported()) {
          const instance = new HlsLib({ lowLatencyMode: true })
          hls = instance
          instance.loadSource(hlsUrl)
          instance.attachMedia(video)
          instance.on(HlsLib.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}) })
        }
      } catch {
        video.src = hlsUrl
      }
    }
    void setup()
    return () => { hls?.destroy() }
  }, [hlsUrl])

  return (
    <div style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}>
      <video id="live-video" style={{ width: '100%', height: '100%' }} controls playsInline />
    </div>
  )
}

export default function LiveWatchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('oren_live_broadcasts')
        .select('id, owner_id, title, description, status, hls_url, scheduled_at, started_at')
        .eq('id', id)
        .maybeSingle()
      if (!data) { setNotFound(true); setLoading(false); return }
      const detail: BroadcastDetail = data
      setBroadcast(detail)
      setLoading(false)
      if (detail.owner_id) {
        const { data: owner } = await supabase.from('profiles').select('owner_store_name, full_name').eq('id', detail.owner_id).maybeSingle()
        setOwnerName(owner?.owner_store_name || owner?.full_name || null)
      }
    }
    if (id) void fetch()
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: SUB, fontSize: 14 }}>불러오는 중...</div>
  )

  if (notFound || !broadcast) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
      <div style={{ fontSize: 36 }}>📭</div>
      <div style={{ fontSize: 14, color: SUB }}>방송을 찾을 수 없어요</div>
      <button type="button" onClick={() => router.push('/live')}
        style={{ marginTop: 8, fontSize: 13, padding: '8px 20px', borderRadius: 20, border: `1px solid ${BORDER}`, background: '#f8f7fc', color: '#7B5EA7', cursor: 'pointer' }}>
        목록으로
      </button>
    </div>
  )

  const salonName = ownerName || '원장님'
  const hlsUrl = broadcast.hls_url

  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <button type="button" onClick={() => router.push('/live')}
          style={{ background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 20, padding: '6px 12px', color: '#fff', fontSize: 13, cursor: 'pointer' }}>
          ← 목록
        </button>
      </div>

      {broadcast.status === 'live' && hlsUrl ? (
        <VideoPlayer hlsUrl={hlsUrl} />
      ) : (
        <div style={{ width: '100%', aspectRatio: '16/9', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {broadcast.status === 'upcoming' ? (
            <>
              <div style={{ fontSize: 32 }}>⏰</div>
              <div style={{ fontSize: 14, color: '#fff' }}>곧 시작돼요</div>
              {broadcast.scheduled_at && (
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {new Date(broadcast.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 32 }}>📭</div>
              <div style={{ fontSize: 14, color: '#aaa' }}>방송이 종료됐어요</div>
            </>
          )}
        </div>
      )}

      <div style={{ background: '#fff', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {broadcast.status === 'live' && (
            <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 6, background: '#FCEBEB', color: '#A32D2D', fontWeight: 700 }}>🔴 LIVE</span>
          )}
          <span style={{ fontSize: 12, color: '#7B5EA7', fontWeight: 600 }}>{salonName}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{broadcast.title}</div>
        {broadcast.description && <div style={{ fontSize: 13, color: SUB, lineHeight: 1.5 }}>{broadcast.description}</div>}
      </div>
    </div>
  )
}
