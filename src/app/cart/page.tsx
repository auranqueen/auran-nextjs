'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import DashboardHeader from '@/components/DashboardHeader'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import ProductThumbImage from '@/components/ProductThumbImage'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/stores/cartStore'

type SearchHit = { id: string; name: string; email: string }

export default function CartPage() {
  const router = useRouter()
  const supabase = createClient()
  const items = useCartStore((s) => s.items)
  const selectedIds = useCartStore((s) => s.selectedIds)
  const setSelected = useCartStore((s) => s.setSelected)
  const setAllSelected = useCartStore((s) => s.setAllSelected)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const removeLine = useCartStore((s) => s.removeLine)
  const selectedLines = useMemo(() => items.filter((i) => selectedIds[i.id] !== false), [items, selectedIds])

  const [toast, setToast] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftQ, setGiftQ] = useState('')
  const [giftHits, setGiftHits] = useState<SearchHit[]>([])
  const [giftPick, setGiftPick] = useState('')
  const [giftLoading, setGiftLoading] = useState(false)

  const selectedCount = selectedLines.length
  const selectedSubtotal = useMemo(
    () => selectedLines.reduce((s, i) => s + i.price * i.quantity, 0),
    [selectedLines]
  )

  const allSelected = useMemo(() => {
    if (items.length === 0) return false
    return items.every((i) => selectedIds[i.id] !== false)
  }, [items, selectedIds])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const goCheckout = useCallback(
    (giftTo?: string) => {
      const lines = selectedLines
      if (!lines.length) {
        setToast('선택한 상품이 없어요')
        return
      }
      const params = new URLSearchParams()
      params.set('products', lines.map((r) => r.product_id).join(','))
      params.set('qty', lines.map((r) => r.quantity).join(','))
      if (giftTo) params.set('gift_to', giftTo)
      const path = `/checkout?${params.toString()}`
      void supabase.auth.getUser().then(({ data: auth }) => {
        if (!auth?.user) {
          router.push(`/login?redirect=${encodeURIComponent(path)}`)
          return
        }
        router.push(path)
      })
    },
    [router, selectedLines, supabase]
  )

  const onBuyClick = () => goCheckout()

  const searchGiftUsers = useCallback(async (q: string) => {
    const t = q.trim()
    if (t.length < 2) {
      setGiftHits([])
      return
    }
    setGiftLoading(true)
    try {
      const res = await fetch(`/api/customer/search-users?q=${encodeURIComponent(t)}`, { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j?.ok) {
        setGiftHits([])
        return
      }
      setGiftHits((j.users || []) as SearchHit[])
    } finally {
      setGiftLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!giftOpen) return
    const t = window.setTimeout(() => void searchGiftUsers(giftQ), 320)
    return () => clearTimeout(t)
  }, [giftQ, giftOpen, searchGiftUsers])

  const openGiftModal = async () => {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) {
      router.push('/login?redirect=/cart')
      return
    }
    if (!selectedLines.length) {
      setToast('선물할 상품을 선택해 주세요')
      return
    }
    setGiftQ('')
    setGiftHits([])
    setGiftPick('')
    setGiftOpen(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 200 }}>
      <DashboardHeader title="장바구니" right={<CustomerHeaderRight />} />
      <div style={{ padding: '16px 18px 0' }}>
        {toast ? (
          <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12 }}>{toast}</div>
        ) : null}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 12px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>장바구니가 비어 있어요</div>
            <Link
              href="/products"
              style={{
                display: 'inline-block',
                padding: '12px 20px',
                borderRadius: 12,
                background: 'rgba(201,168,76,0.15)',
                border: '1px solid rgba(201,168,76,0.4)',
                color: 'var(--gold)',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              제품 보러가기
            </Link>
          </div>
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 13, color: '#fff', fontWeight: 800 }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => setAllSelected(e.target.checked)}
              />
              전체 선택
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((r) => {
                const checked = selectedIds[r.id] !== false
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: 12,
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setSelected(r.id, e.target.checked)}
                      style={{ marginTop: 4 }}
                    />
                    <div style={{ position: 'relative', width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'rgba(0,0,0,0.25)', flexShrink: 0 }}>
                      <ProductThumbImage src={r.thumb_img} alt={r.name} fill sizes="64px" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.brand_name}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginTop: 2 }}>{r.name}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 800, color: 'var(--gold)', marginTop: 4 }}>
                        ₩{(r.price * r.quantity).toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => setQuantity(r.id, r.quantity - 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#fff',
                          }}
                        >
                          −
                        </button>
                        <span style={{ fontSize: 13, color: '#fff', fontWeight: 800, minWidth: 20, textAlign: 'center' }}>{r.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(r.id, r.quantity + 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.04)',
                            color: '#fff',
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(r.id)}
                          style={{ marginLeft: 'auto', fontSize: 11, color: '#e57373', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {items.length > 0 ? (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 72,
            width: '100%',
            maxWidth: 480,
            zIndex: 45,
            padding: '10px 14px 14px',
            background: 'rgba(10,12,15,0.96)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 800, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>
              선택 {selectedCount}개{selectedCount ? ` · ₩${selectedSubtotal.toLocaleString()}` : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => void openGiftModal()}
              style={{
                height: 46,
                borderRadius: 12,
                border: '1px solid rgba(140,180,255,0.45)',
                background: 'rgba(140,180,255,0.12)',
                color: '#bcd6ff',
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              선물하기 🎁
            </button>
            <button
              type="button"
              onClick={() => void onBuyClick()}
              disabled={!selectedCount}
              style={{
                height: 46,
                borderRadius: 12,
                border: 'none',
                background: !selectedCount ? '#55606f' : '#c9a84c',
                color: !selectedCount ? '#c8d0db' : '#111',
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              구매하기
            </button>
          </div>
        </div>
      ) : null}

      {giftOpen ? (
        <div onClick={() => setGiftOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 120 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 0,
              width: '100%',
              maxWidth: 480,
              background: '#11161b',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderTop: '1px solid var(--border)',
              padding: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 10 }}>🎁 선물할 회원 검색</div>
            <input
              value={giftQ}
              onChange={(e) => setGiftQ(e.target.value)}
              placeholder="이름 / 이메일 (2글자 이상)"
              style={{
                width: '100%',
                marginBottom: 10,
                padding: '12px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                fontSize: 14,
              }}
            />
            <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 8, marginBottom: 12 }}>
              {giftLoading ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>검색 중...</div> : null}
              {!giftLoading &&
                giftHits.map((u) => (
                  <label
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      border: giftPick === u.id ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)',
                      background: giftPick === u.id ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="radio" name="giftu" checked={giftPick === u.id} onChange={() => setGiftPick(u.id)} />
                    <div style={{ fontSize: 13, color: '#fff' }}>
                      {u.name} · {u.email}
                    </div>
                  </label>
                ))}
              {!giftLoading && giftQ.trim().length >= 2 && giftHits.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>검색 결과가 없어요</div>
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" onClick={() => setGiftOpen(false)} style={{ height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 800 }}>
                취소
              </button>
              <button
                type="button"
                disabled={!giftPick}
                onClick={() => {
                  setGiftOpen(false)
                  goCheckout(giftPick)
                }}
                style={{
                  height: 44,
                  borderRadius: 10,
                  border: 'none',
                  background: !giftPick ? '#55606f' : '#c9a84c',
                  color: !giftPick ? '#c8d0db' : '#111',
                  fontWeight: 900,
                }}
              >
                선물하기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <DashboardBottomNav role="customer" />
    </div>
  )
}
