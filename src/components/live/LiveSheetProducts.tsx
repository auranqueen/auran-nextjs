'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LiveWatchProduct } from '@/components/live/LiveWatchProductBar'

const PURPLE = '#7B5EA7'
const TEXT = '#1a1a1a'

type LoadState = 'loading' | 'ready' | 'empty'

const won = (n: number | null) => (n == null ? '' : `${n.toLocaleString('ko-KR')}원`)

export default function LiveSheetProducts({
  broadcastId,
  status,
}: {
  broadcastId: number
  status?: string
}) {
  const router = useRouter()
  const [state, setState] = useState<LoadState>('loading')
  const [products, setProducts] = useState<LiveWatchProduct[]>([])
  const [salonId, setSalonId] = useState<string | null>(null)

  const title = status === 'live' ? '방송 제품' : '예정 제품'

  useEffect(() => {
    let cancelled = false
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
    setState('loading')
    setProducts([])
    setSalonId(null)

    void (async () => {
      try {
        const res = await fetch(`/api/live/broadcast-products?broadcast_id=${broadcastId}`, {
          credentials: 'same-origin',
          signal: ac?.signal,
        })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!json?.ok || json.locked === true || !Array.isArray(json.products) || json.products.length === 0) {
          setState('empty')
          return
        }
        const list = (json.products as LiveWatchProduct[]).map((p) => ({
          id: String(p.id),
          name: String(p.name ?? ''),
          thumb_img: typeof p.thumb_img === 'string' && p.thumb_img ? p.thumb_img : null,
          consumer_price: p.consumer_price != null && Number.isFinite(Number(p.consumer_price)) ? Number(p.consumer_price) : null,
          sort_order: p.sort_order,
        }))
        setProducts(list)
        setSalonId(typeof json.salon_id === 'string' ? json.salon_id : null)
        setState(list.length > 0 ? 'ready' : 'empty')
      } catch {
        if (cancelled) return
        setState('empty')
      }
    })()

    return () => {
      cancelled = true
      ac?.abort()
    }
  }, [broadcastId])

  if (state === 'empty') return null

  if (state === 'loading') {
    return (
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: TEXT }}>{title}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ aspectRatio: '1/1', borderRadius: 8, background: '#f0f0f0' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ marginBottom: 8, fontSize: 13, color: TEXT }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {products.map((p) => {
          const canOpen = !!salonId
          return (
            <button
              key={p.id}
              type="button"
              disabled={!canOpen}
              onClick={() => {
                if (!salonId) return
                router.push(`/salons/${salonId}/products/${p.id}`)
              }}
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: canOpen ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#f5f5f5', marginBottom: 6 }}>
                {p.thumb_img ? (
                  <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: TEXT,
                  lineHeight: 1.3,
                  height: 34,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: PURPLE, marginTop: 2 }}>{won(p.consumer_price)}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}