'use client'

import { useEffect, useState } from 'react'
import SlideUpSheet from '@/components/ui/SlideUpSheet'
import type { LiveWatchProduct } from './LiveWatchProductBar'
import LiveWatchProductDetail from './LiveWatchProductDetail'

const PURPLE = '#7B5EA7'
const TEXT = '#1a1a1a'
const SUB = '#888888'

const won = (n: number | null) => (n == null ? '' : `${n.toLocaleString('ko-KR')}원`)

export default function LiveWatchProductSheet({
  products,
  salonId,
  open,
  onClose,
}: {
  products: LiveWatchProduct[]
  salonId: string | null
  open: boolean
  onClose: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? products.find((p) => p.id === selectedId) ?? null : null

  useEffect(() => {
    if (!open) setSelectedId(null)
  }, [open])

  return (
    <SlideUpSheet open={open} onClose={onClose} height="72dvh" zIndex={10050}>
      {selected ? (
        <LiveWatchProductDetail product={selected} salonId={salonId} onBack={() => setSelectedId(null)} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', color: TEXT }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: TEXT }}>상품목록</div>
            <button
              type="button"
              aria-label="닫기"
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: SUB, padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12 }}>
            {products.length === 0 ? (
              <div style={{ fontSize: 11, color: SUB, padding: 16, textAlign: 'center' }}>연결된 제품이 없어요</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    style={{
                      border: '1px solid #eee',
                      borderRadius: 12,
                      background: '#fff',
                      padding: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: '#f5f5f5', marginBottom: 8 }}>
                      {p.thumb_img ? (
                        <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: TEXT,
                        lineHeight: 1.35,
                        height: 36,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: 11, color: PURPLE, marginTop: 4 }}>{won(p.consumer_price)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </SlideUpSheet>
  )
}