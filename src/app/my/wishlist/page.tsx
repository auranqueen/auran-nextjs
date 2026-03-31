'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BG = '#0D0B09'
const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.55)'

type WishlistRow = {
  id: string
  product_id: string
  created_at: string
  products: {
    id: string
    name: string
    price: number
    storage_thumb_url: string | null
    brands: { name: string } | null
  } | null
}

export default function MyWishlistPage() {
  const router = useRouter()
  const supabase = createClient()
  const [rows, setRows] = useState<WishlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        setLoading(false)
        return
      }
      const { data: list, error } = await supabase
        .from('wishlists')
        .select('id, product_id, created_at, products(id, name, price, storage_thumb_url, brands(name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        setTableMissing(true)
        setRows([])
      } else {
        setRows((list as unknown as WishlistRow[]) || [])
      }
      setLoading(false)
    }
    run()
  }, [supabase])

  const removeWishlist = async (id: string) => {
    await supabase.from('wishlists').delete().eq('id', id)
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 390, margin: '0 auto', color: '#fff', paddingBottom: 20 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(13,11,9,0.96)', borderBottom: CARD_BORDER }}>
        <button onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: '#fff', fontSize: 18, cursor: 'pointer' }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>찜 목록</div>
      </header>

      <div style={{ padding: 16 }}>
        {loading ? <div style={{ color: TEXT_MUTED, fontSize: 13 }}>불러오는 중...</div> : null}
        {!loading && tableMissing ? <div style={{ color: TEXT_MUTED, fontSize: 13 }}>준비 중입니다</div> : null}
        {!loading && !tableMissing && rows.length === 0 ? <div style={{ color: TEXT_MUTED, fontSize: 13 }}>찜한 제품이 없어요 💜</div> : null}

        {!loading && !tableMissing ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} style={{ background: CARD_BG, border: CARD_BORDER, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 130, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {row.products?.storage_thumb_url ? (
                    <img src={row.products.storage_thumb_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 28 }}>🧴</span>
                  )}
                </div>
                <div style={{ padding: 10 }}>
                  <div style={{ fontSize: 10, color: GOLD, marginBottom: 4 }}>{row.products?.brands?.name || '-'}</div>
                  <div style={{ fontSize: 12, minHeight: 32, marginBottom: 6 }}>{row.products?.name || '제품'}</div>
                  <div style={{ fontSize: 13, marginBottom: 8 }}>{(row.products?.price || 0).toLocaleString()}원</div>
                  <button
                    onClick={() => router.push(`/products/${row.products?.id || row.product_id}`)}
                    style={{ width: '100%', border: '1px solid rgba(201,169,110,0.3)', color: GOLD, background: 'rgba(201,169,110,0.1)', borderRadius: 8, padding: '7px 0', fontSize: 11, cursor: 'pointer', marginBottom: 6 }}
                  >
                    구매하기
                  </button>
                  <button
                    onClick={() => removeWishlist(row.id)}
                    style={{ width: '100%', border: CARD_BORDER, color: TEXT_MUTED, background: 'transparent', borderRadius: 8, padding: '7px 0', fontSize: 11, cursor: 'pointer' }}
                  >
                    찜 해제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
