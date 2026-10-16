'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LiveWatchPlayer from '@/components/live/LiveWatchPlayer'
import LiveWatchOverlay from '@/components/live/LiveWatchOverlay'
import LiveWatchProductBar, { type LiveWatchProduct } from '@/components/live/LiveWatchProductBar'
import LiveWatchProductSheet from '@/components/live/LiveWatchProductSheet'

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
  viewer_count: number | null
}

export default function LiveWatchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPC, setIsPC] = useState(false)
  const [muted, setMuted] = useState(false)
  const [products, setProducts] = useState<LiveWatchProduct[]>([])
  const [salonId, setSalonId] = useState<string | null>(null)
  const [productsLocked, setProductsLocked] = useState(false)
  const [productSheetOpen, setProductSheetOpen] = useState(false)

  useEffect(() => {
    const onResize = () => setIsPC(window.innerWidth >= 768)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('oren_live_broadcasts_public')
        .select('id, owner_id, title, description, status, hls_url, scheduled_at, started_at, viewer_count')
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

  useEffect(() => {
    if (!broadcast || broadcast.status !== 'live') {
      setProducts([])
      setSalonId(null)
      setProductsLocked(false)
      setProductSheetOpen(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/live/broadcast-products?broadcast_id=' + broadcast.id, { credentials: 'same-origin' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!json?.ok) {
          setProducts([])
          setSalonId(null)
          setProductsLocked(false)
          return
        }
        setSalonId(typeof json.salon_id === 'string' ? json.salon_id : null)
        setProductsLocked(json.locked === true)
        setProducts(json.locked === true ? [] : (Array.isArray(json.products) ? json.products as LiveWatchProduct[] : []))
      } catch {
        if (!cancelled) {
          setProducts([])
          setSalonId(null)
          setProductsLocked(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [broadcast?.id, broadcast?.status])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#000', color: SUB, fontSize: 13 }}>불러오는 중...</div>
  )

  if (notFound || !broadcast) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 12, background: '#000' }}>
      <div style={{ fontSize: 13, color: SUB }}>방송을 찾을 수 없어요</div>
      <button type="button" onClick={() => router.push('/live')}
        style={{ marginTop: 8, fontSize: 13, padding: '8px 20px', borderRadius: 20, border: `1px solid ${BORDER}`, background: '#f8f7fc', color: '#7B5EA7', cursor: 'pointer' }}>
        목록으로
      </button>
    </div>
  )

  const ownerLabel = ownerName || '원장님'
  const hlsUrl = broadcast.hls_url
  const isLivePlaying = broadcast.status === 'live' && !!hlsUrl

  const frameStyle: CSSProperties = isPC
    ? {
        position: 'relative',
        height: '100dvh',
        width: 'min(480px, calc(100dvh * 9 / 16))',
        maxWidth: 480,
        margin: '0 auto',
        background: '#000',
        overflow: 'hidden',
      }
    : {
        position: 'relative',
        width: '100%',
        height: '100dvh',
        background: '#000',
        overflow: 'hidden',
      }

  return (
    <div style={{ background: '#000', minHeight: '100dvh' }}>
      <div style={frameStyle}>
        {isLivePlaying ? (
          <LiveWatchPlayer hlsUrl={hlsUrl!} muted={muted} onMutedChange={setMuted} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#111' }}>
            {broadcast.status === 'upcoming' ? (
              <>
                <div style={{ fontSize: 13, color: '#fff' }}>곧 시작돼요</div>
                {broadcast.scheduled_at && (
                  <div style={{ fontSize: 11, color: '#aaa' }}>
                    {new Date(broadcast.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#aaa' }}>방송이 종료됐어요</div>
            )}
          </div>
        )}

        <LiveWatchOverlay
          status={broadcast.status}
          title={broadcast.title}
          ownerLabel={ownerLabel}
          viewerCount={broadcast.viewer_count}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onClose={() => router.push('/live')}
          showMute={isLivePlaying}
        />

        {broadcast.status === 'live' && !productsLocked && products.length > 0 ? (
          <>
            <LiveWatchProductBar products={products} onOpen={() => setProductSheetOpen(true)} />
            <LiveWatchProductSheet
              products={products}
              salonId={salonId}
              open={productSheetOpen}
              onClose={() => setProductSheetOpen(false)}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}