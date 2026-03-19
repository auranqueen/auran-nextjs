'use client'

import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import NoticeBell from '@/components/NoticeBell'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useMemo, useState } from 'react'

export default function ProductsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [selectedBrand, setSelectedBrand] = useState<any | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('products')
        .select('id,name,retail_price,status,created_at,brand_id,brands(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(300)
      setProducts(data || [])
      setLoading(false)
    }
    run()
  }, [supabase])

  useEffect(() => {
    const run = async () => {
      if (brandFilter === 'all') {
        setSelectedBrand(null)
        return
      }
      const { data } = await supabase
        .from('brands')
        .select('id,name,origin,description,logo_url,story_title,story_body,story_image_url,promo_enabled,promo_title,promo_body,promo_image_url,promo_link_url,promo_starts_at,promo_ends_at')
        .eq('id', brandFilter)
        .maybeSingle()
      setSelectedBrand(data || null)
    }
    run()
  }, [brandFilter, supabase])

  const brands = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const p of products) {
      const bid = p.brand_id || ''
      const bname = p.brands?.name || ''
      if (!bid || !bname) continue
      const cur = map.get(bid)
      if (cur) cur.count += 1
      else map.set(bid, { id: bid, name: bname, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [products])

  const visible = useMemo(() => {
    if (brandFilter === 'all') return products
    return products.filter(p => p.brand_id === brandFilter)
  }, [brandFilter, products])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="제품추천" right={<NoticeBell />} />
      <div style={{ padding: '18px 18px 0' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, WebkitOverflowScrolling: 'touch' as any }}>
          <button
            onClick={() => setBrandFilter('all')}
            style={{
              border: brandFilter === 'all' ? '1px solid rgba(201,168,76,0.65)' : '1px solid rgba(255,255,255,0.10)',
              background: brandFilter === 'all' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
              color: '#fff',
              borderRadius: 999,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            전체 ({products.length})
          </button>
          {brands.map(b => (
            <button
              key={b.id}
              onClick={() => setBrandFilter(b.id)}
              style={{
                border: brandFilter === b.id ? '1px solid rgba(201,168,76,0.65)' : '1px solid rgba(255,255,255,0.10)',
                background: brandFilter === b.id ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                color: '#fff',
                borderRadius: 999,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              {b.name} ({b.count})
            </button>
          ))}
        </div>

        {selectedBrand && (
          <div style={{ marginBottom: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.20)', borderRadius: 16, padding: '14px 14px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {selectedBrand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBrand.logo_url} alt={selectedBrand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: 16 }}>🏷️</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>{selectedBrand.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedBrand.origin || ''} {selectedBrand.description ? `· ${selectedBrand.description}` : ''}
                </div>
              </div>
            </div>

            {(selectedBrand.story_title || selectedBrand.story_body || selectedBrand.story_image_url) && (
              <div style={{ marginTop: 12, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, overflow: 'hidden' }}>
                {selectedBrand.story_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBrand.story_image_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                ) : null}
                <div style={{ padding: '12px 12px' }}>
                  {selectedBrand.story_title ? <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{selectedBrand.story_title}</div> : null}
                  {selectedBrand.story_body ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {selectedBrand.story_body}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {selectedBrand.promo_enabled && (selectedBrand.promo_title || selectedBrand.promo_body || selectedBrand.promo_image_url) && (
              <a
                href={selectedBrand.promo_link_url || '#'}
                onClick={e => {
                  if (!selectedBrand.promo_link_url) e.preventDefault()
                }}
                style={{
                  display: 'block',
                  marginTop: 12,
                  textDecoration: 'none',
                  background: 'rgba(201,168,76,0.10)',
                  border: '1px solid rgba(201,168,76,0.25)',
                  borderRadius: 14,
                  overflow: 'hidden',
                }}
              >
                {selectedBrand.promo_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedBrand.promo_image_url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                ) : null}
                <div style={{ padding: '12px 12px' }}>
                  <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', color: 'rgba(201,168,76,0.9)', marginBottom: 6 }}>PROMOTION</div>
                  {selectedBrand.promo_title ? <div style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>{selectedBrand.promo_title}</div> : null}
                  {selectedBrand.promo_body ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {selectedBrand.promo_body}
                    </div>
                  ) : null}
                  {selectedBrand.promo_link_url ? <div style={{ marginTop: 8, fontSize: 11, color: 'var(--gold)', fontWeight: 900 }}>자세히 보기 →</div> : null}
                </div>
              </a>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
        ) : visible.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>표시할 제품이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map(p => (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '14px 14px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{p.name}</div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.brands?.name || ''}</div>
                    <div style={{ width: 4, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }} />
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('ko-KR') : ''}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: 'var(--gold)' }}>
                    ₩{(p.retail_price || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}

