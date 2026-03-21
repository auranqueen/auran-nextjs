'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import LoginRequiredModal from '@/components/LoginRequiredModal'
import ProductThumbImage from '@/components/ProductThumbImage'
import { createClient } from '@/lib/supabase/client'
import { useAdminSettings } from '@/hooks/useAdminSettings'
import { useCartStore } from '@/stores/cartStore'

const PENDING_GIFT_KEY = 'auran_pending_gift_after_login'

type GiftHit = { id: string; name: string; email: string }

export default function ProductDetailClient({ product }: { product: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shareJournalId = searchParams.get('share_journal_id')
  const supabase = createClient()
  const { getSettingNum } = useAdminSettings()
  const giftEnabled = getSettingNum('gift', 'gift_enabled', 1) === 1
  const giftMessageMax = Math.max(1, Math.min(500, getSettingNum('gift', 'gift_message_max_length', 100)))

  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [openGuestSheet, setOpenGuestSheet] = useState(false)
  const [toast, setToast] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [giftQ, setGiftQ] = useState('')
  const [giftHits, setGiftHits] = useState<GiftHit[]>([])
  const [giftPick, setGiftPick] = useState('')
  const [giftLoading, setGiftLoading] = useState(false)
  const [giftMessage, setGiftMessage] = useState('')
  const addToCart = useCartStore((s) => s.addItem)

  const returnPath = useMemo(() => {
    if (typeof window === 'undefined') return `/products/${product.id}`
    return `${window.location.pathname}${window.location.search || ''}`
  }, [product.id])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        try {
          if (sessionStorage.getItem(PENDING_GIFT_KEY) === '1') {
            sessionStorage.removeItem(PENDING_GIFT_KEY)
            setLoginModalOpen(false)
            void openGiftSheetAfterLogin()
          } else {
            setLoginModalOpen(false)
          }
        } catch {
          setLoginModalOpen(false)
        }
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  const giftOpenOnce = useRef(false)
  useEffect(() => {
    const open = searchParams.get('open')
    if (open !== 'gift' || !giftEnabled || giftOpenOnce.current) return
    giftOpenOnce.current = true
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) void openGiftSheetAfterLogin()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, giftEnabled])

  const detailImgs = Array.isArray(product.detail_imgs) ? product.detail_imgs : []
  const rawPrice = product.retail_price
  const price = Number(rawPrice) || 0
  const isPriceUnset = rawPrice === null || rawPrice === undefined || price === 0

  async function openGiftSheetAfterLogin() {
    if (!giftEnabled) {
      setToast('선물 기능이 비활성화되어 있어요')
      return
    }
    setGiftQ('')
    setGiftHits([])
    setGiftPick('')
    setGiftOpen(true)
  }

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
      setGiftHits((j.users || []) as GiftHit[])
    } finally {
      setGiftLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!giftOpen) return
    const t = window.setTimeout(() => void searchGiftUsers(giftQ), 320)
    return () => clearTimeout(t)
  }, [giftQ, giftOpen, searchGiftUsers])

  const onAddCart = () => {
    if (isPriceUnset) {
      setToast('가격이 설정된 후 담을 수 있어요')
      return
    }
    const { wasNewLine } = addToCart({
      product_id: String(product.id),
      name: String(product.name || '제품'),
      price,
      thumb_img: product.thumb_img ?? null,
      brand_name: product.brands?.name || '',
      quantity,
    })
    setToast(wasNewLine ? '🛒 장바구니에 담겼어요!' : '수량이 +1 되었습니다')
  }

  const onOpenGift = async () => {
    if (!giftEnabled) {
      setToast('선물 기능이 비활성화되어 있어요')
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      try {
        sessionStorage.setItem(PENDING_GIFT_KEY, '1')
      } catch {}
      setLoginModalOpen(true)
      return
    }
    await openGiftSheetAfterLogin()
  }

  const onBuy = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setOpenGuestSheet(true)
      return
    }
    const total = price * quantity
    if (total < 1000) {
      setToast('결제 금액은 1,000원 이상이어야 합니다.')
      return
    }
    setSubmitting(true)
    try {
      const params = new URLSearchParams()
      params.set('products', String(product.id))
      params.set('qty', String(quantity))
      if (shareJournalId) params.set('share_journal_id', shareJournalId)
      router.push(`/checkout?${params.toString()}`)
    } catch (e: any) {
      setToast(e?.message || '오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmGiftCheckout = () => {
    if (!giftPick) return
    const params = new URLSearchParams()
    params.set('products', String(product.id))
    params.set('qty', String(quantity))
    params.set('gift_to', giftPick)
    const trimmed = giftMessage.trim()
    if (trimmed) params.set('gift_message', trimmed)
    setGiftOpen(false)
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 200 }}>
      <DashboardHeader title={product.name || '제품'} right={<CustomerHeaderRight />} />
      <div style={{ padding: '0 18px 24px' }}>
        {toast ? (
          <div
            style={{
              margin: '0 0 10px',
              padding: '9px 10px',
              borderRadius: 10,
              border: '1px solid rgba(201,168,76,0.35)',
              background: 'rgba(201,168,76,0.12)',
              color: 'var(--gold)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {toast}
          </div>
        ) : null}
        <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', aspectRatio: '1', maxHeight: 360, position: 'relative' }}>
          <ProductThumbImage key={String(product.id)} src={product.thumb_img} alt={product.name || ''} fill sizes="(max-width:480px) 100vw, 360px" priority />
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{product.brands?.name || ''}</div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>{product.name}</h1>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 18,
            fontWeight: 800,
            color: isPriceUnset ? 'var(--text3)' : 'var(--gold)',
            marginBottom: 16,
          }}
        >
          {isPriceUnset ? '준비 중' : `₩${price.toLocaleString()}`}
        </div>
        {!isPriceUnset && (
          <div style={{ marginBottom: 20, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setQuantity((v) => Math.max(1, v - 1))}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}
                >
                  -
                </button>
                <div style={{ minWidth: 24, textAlign: 'center', fontSize: 14, color: '#fff', fontWeight: 800 }}>{quantity}</div>
                <button
                  type="button"
                  onClick={() => setQuantity((v) => Math.min(99, v + 1))}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
        {product.description ? (
          <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.description}</div>
        ) : null}
        {detailImgs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {detailImgs.map((url: string, i: number) => (
              <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`${product.name} ${i + 1}`} style={{ width: '100%', verticalAlign: 'top', display: 'block' }} />
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link
            href="/products"
            style={{
              display: 'inline-block',
              padding: '12px 20px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
            }}
          >
            ← 제품 목록
          </Link>
        </div>
      </div>

      {!isPriceUnset && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            transform: 'translateX(-50%)',
            bottom: 72,
            width: '100%',
            maxWidth: 480,
            zIndex: 40,
            padding: '10px 12px 12px',
            background: 'rgba(10,12,15,0.96)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--border)',
            display: 'grid',
            gridTemplateColumns: giftEnabled ? '1fr 1fr 1fr' : '1fr 1fr',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onAddCart}
            disabled={submitting}
            style={{
              height: 44,
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            🛒 장바구니
          </button>
          {giftEnabled ? (
            <button
              type="button"
              onClick={() => void onOpenGift()}
              disabled={submitting}
              style={{
                height: 44,
                borderRadius: 12,
                border: '1px solid rgba(140,180,255,0.45)',
                background: 'rgba(140,180,255,0.12)',
                color: '#bcd6ff',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              🎁 선물하기
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onBuy()}
            disabled={submitting}
            style={{
              height: 44,
              borderRadius: 12,
              border: '1px solid rgba(201,168,76,0.55)',
              background: 'linear-gradient(135deg, rgba(201,168,76,0.28), rgba(201,168,76,0.1))',
              color: 'var(--gold)',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            구매하기
          </button>
        </div>
      )}

      {openGuestSheet && (
        <div onClick={() => setOpenGuestSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 120 }}>
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
            <div style={{ fontSize: 16, color: '#fff', fontWeight: 800, marginBottom: 6 }}>로그인 후 구매 가능해요</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>첫 가입 8,888P 지급</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => router.push('/login?role=customer')}
                style={{ height: 40, borderRadius: 10, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontWeight: 800 }}
              >
                로그인
              </button>
              <button onClick={() => router.push('/signup')} style={{ height: 40, borderRadius: 10, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}>
                회원가입
              </button>
            </div>
          </div>
        </div>
      )}
      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false)
          try {
            sessionStorage.removeItem(PENDING_GIFT_KEY)
          } catch {}
        }}
        returnPath={`${returnPath}${returnPath.includes('?') ? '&' : '?'}open=gift`}
      />
      {giftOpen && (
        <div onClick={() => setGiftOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 130 }}>
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
            <div style={{ fontSize: 16, color: '#fff', fontWeight: 900, marginBottom: 10 }}>🎁 선물할 회원 검색</div>
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
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'grid', gap: 8, marginBottom: 10 }}>
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
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 6 }}>💌 메시지 (선택 · 최대 {giftMessageMax}자)</div>
            <textarea
              value={giftMessage}
              maxLength={giftMessageMax}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder="따뜻한 한마디를 남겨보세요"
              style={{
                width: '100%',
                minHeight: 64,
                marginBottom: 12,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                padding: 10,
                resize: 'none',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" onClick={() => setGiftOpen(false)} style={{ height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', fontWeight: 800 }}>
                취소
              </button>
              <button
                type="button"
                disabled={!giftPick}
                onClick={confirmGiftCheckout}
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
      )}
      <DashboardBottomNav role="customer" />
    </div>
  )
}
