'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import { createClient } from '@/lib/supabase/client'
import { broadcastCartCountRefresh } from '@/lib/cartEvents'

type Row = {
  id: string
  quantity: number
  product_id: string
  products: {
    id: string
    name: string
    thumb_img?: string | null
    retail_price?: number | null
    brands?: { name: string } | { name: string }[] | null
  } | null
}

function brandName(p: Row['products']) {
  if (!p?.brands) return ''
  const b = p.brands as any
  return Array.isArray(b) ? b[0]?.name || '' : b?.name || ''
}

export default function CartPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [meId, setMeId] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) {
        router.replace('/login?redirect=/cart')
        return
      }
      const { data: me } = await supabase.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
      if (!me?.id) {
        router.replace('/login?redirect=/cart')
        return
      }
      setMeId(me.id)
      const { data } = await supabase
        .from('cart_items')
        .select('id,quantity,product_id, products(id,name,thumb_img,retail_price,brands(name))')
        .eq('user_id', me.id)
        .order('id', { ascending: false })
      setRows((data as unknown as Row[]) || [])
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const updateQty = async (id: string, next: number) => {
    const q = Math.max(1, Math.min(99, next))
    const { error } = await supabase.from('cart_items').update({ quantity: q }).eq('id', id)
    if (error) {
      setToast(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, quantity: q } : r)))
    broadcastCartCountRefresh()
  }

  const removeRow = async (id: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', id)
    if (error) {
      setToast(error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
    broadcastCartCountRefresh()
  }

  const subtotal = rows.reduce((s, r) => {
    const price = Number(r.products?.retail_price) || 0
    return s + price * r.quantity
  }, 0)

  const goCheckout = () => {
    const ids = rows.map((r) => r.product_id).filter(Boolean)
    if (!ids.length) return
    const params = new URLSearchParams()
    params.set('products', ids.join(','))
    const q = rows.length === 1 ? String(rows[0].quantity) : String(Math.min(...rows.map((r) => r.quantity)))
    params.set('qty', q)
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title="장바구니" right={<CustomerHeaderRight />} />
      <div style={{ padding: '16px 18px 0' }}>
        {toast ? (
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12 }}>{toast}</div>
        ) : null}
        {loading ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 12px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>장바구니가 비어 있어요</div>
            <Link href="/products" style={{ display: 'inline-block', padding: '12px 20px', borderRadius: 12, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: 'var(--gold)', fontWeight: 800, textDecoration: 'none' }}>
              제품 보러가기
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((r) => {
                const p = r.products
                const price = Number(p?.retail_price) || 0
                return (
                  <div key={r.id} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.25)', flexShrink: 0 }}>
                      {p?.thumb_img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🧴</div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{brandName(p)}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{p?.name || '제품'}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>₩{(price * r.quantity).toLocaleString()}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => updateQty(r.id, r.quantity - 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>
                          −
                        </button>
                        <span style={{ fontSize: 13, color: '#fff', fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{r.quantity}</span>
                        <button type="button" onClick={() => updateQty(r.id, r.quantity + 1)} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>
                          +
                        </button>
                        <button type="button" onClick={() => removeRow(r.id)} style={{ marginLeft: 'auto', fontSize: 11, color: '#e57373', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 18, padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 14, fontWeight: 900 }}>
                <span>합계</span>
                <span>₩{subtotal.toLocaleString()}</span>
              </div>
              <button type="button" onClick={goCheckout} disabled={!meId || subtotal < 1} style={{ marginTop: 12, width: '100%', height: 44, borderRadius: 12, border: 'none', background: subtotal < 1 ? '#55606f' : '#c9a84c', color: subtotal < 1 ? '#c8d0db' : '#111', fontWeight: 900 }}>
                결제하기
              </button>
            </div>
          </>
        )}
      </div>
      <DashboardBottomNav role="customer" />
    </div>
  )
}
