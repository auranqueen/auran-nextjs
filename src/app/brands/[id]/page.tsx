'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.5)'

export default function BrandProductsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const brandId = params.id
  const [brand, setBrand] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    setLoading(true)

    Promise.all([
      supabase.from('brands').select('*').eq('id', brandId).single(),
      supabase
        .from('products')
        .select('id, name, retail_price, thumb_img, brand_id')
        .eq('brand_id', brandId),
    ])
      .then(([b, p]) => {
        if (cancelled) return
        setBrand(b.data || null)
        setProducts(p.data || [])
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [brandId])

  const filtered = useMemo(() => {
    const qq = (q || '').trim().toLowerCase()
    if (!qq) return products
    return products.filter((p) => String(p?.name || '').toLowerCase().includes(qq))
  }, [products, q])

  const requestPay = async (productId: string) => {
    const res = await fetch(`${window.location.origin}/api/payment/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, quantity: 1 }),
    })
    const data = await res.json().catch(() => ({}))
    if (data?.payUrl) window.location.href = data.payUrl
    else alert('결제 요청 실패')
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'sans-serif' }}>
      {/* Top bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '14px 16px',
          background: 'rgba(13,11,9,0.95)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => router.push('/')}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: GOLD,
              cursor: 'pointer',
              fontSize: 16,
            }}
            aria-label="back"
          >
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(201,255,255,0.0)' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {brand?.name || brand?.label || 'BRAND'}
            </div>
          </div>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="제품명 검색"
          style={{
            width: '100%',
            padding: '12px 12px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: '#fff',
            outline: 'none',
            fontSize: 13,
          }}
        />
        <div style={{ marginTop: 8, fontSize: 11, color: TEXT_MUTED }}>
          {loading ? '불러오는 중…' : `${filtered.length.toLocaleString()}개 제품`}
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/products/${p.id}`)}
              style={{
                background: CARD_BG,
                border: CARD_BORDER,
                borderRadius: 14,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1/1',
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg,#1a1510,#2a2015)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p.thumb_img ? (
                  <img
                    src={p.thumb_img}
                    alt={p.name || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ fontSize: 36, opacity: 0.8 }}>🧴</div>
                )}
              </div>

              <div style={{ padding: '10px 10px 12px' }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.35, marginBottom: 6 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 10 }}>
                  {Number(p.retail_price || 0).toLocaleString()}원
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      alert('담기')
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      color: 'rgba(255,255,255,0.65)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    담기
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      alert('선물')
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: 'rgba(180,100,200,0.12)',
                      border: '1px solid rgba(180,100,200,0.25)',
                      borderRadius: 10,
                      color: 'rgba(220,160,240,0.9)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    선물
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      requestPay(p.id)
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      background: GOLD,
                      border: 'none',
                      borderRadius: 10,
                      color: '#1a1000',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    지금구매
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

