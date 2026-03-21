'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import DashboardHeader from '@/components/DashboardHeader'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import LoginRequiredModal from '@/components/LoginRequiredModal'
import { createClient } from '@/lib/supabase/client'
import { broadcastCartCountRefresh } from '@/lib/cartEvents'
import { useAdminSettings } from '@/hooks/useAdminSettings'

const PENDING_GIFT_KEY = 'auran_pending_gift_after_login'

function skinLineLabel(skinType: string | null | undefined) {
  const s = (skinType || '').trim()
  if (!s) return '미설정 ✨'
  const low = s.toLowerCase()
  let emoji = '✨'
  if (low.includes('건성')) emoji = '🌱'
  else if (low.includes('민감')) emoji = '🌸'
  else if (low.includes('복합')) emoji = '✨'
  else if (low.includes('지성')) emoji = '💧'
  else if (low.includes('중성')) emoji = '✨'
  return `${s} ${emoji}`
}

export default function ProductDetailClient({ product }: { product: any }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shareJournalId = searchParams.get('share_journal_id')
  const supabase = createClient()
  const { getSettingNum } = useAdminSettings()
  const giftEnabled = getSettingNum('gift', 'gift_enabled', 1) === 1
  const giftMessageMax = Math.max(1, Math.min(500, getSettingNum('gift', 'gift_message_max_length', 100)))

  const [thumbError, setThumbError] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [openGuestSheet, setOpenGuestSheet] = useState(false)
  const [toast, setToast] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [loginFor, setLoginFor] = useState<'cart' | 'gift' | null>(null)
  const [meId, setMeId] = useState('')
  const [friends, setFriends] = useState<any[]>([])
  const [friendQuery, setFriendQuery] = useState('')
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [giftMessage, setGiftMessage] = useState('')

  const returnPath = useMemo(() => {
    if (typeof window === 'undefined') return `/products/${product.id}`
    return `${window.location.pathname}${window.location.search || ''}`
  }, [product.id])

  const refreshMe = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setMeId('')
      return
    }
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    if (me?.id) setMeId(String(me.id))
    else setMeId('')
  }

  useEffect(() => {
    void refreshMe()
  }, [supabase])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        void refreshMe()
        try {
          if (sessionStorage.getItem(PENDING_GIFT_KEY) === '1') {
            sessionStorage.removeItem(PENDING_GIFT_KEY)
            setLoginModalOpen(false)
            setLoginFor(null)
            void openGiftSheetAfterLogin()
          } else {
            setLoginModalOpen(false)
            setLoginFor(null)
          }
        } catch {
          setLoginModalOpen(false)
          setLoginFor(null)
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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) void openGiftSheetAfterLogin()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, giftEnabled])

  const thumbUrl = product.thumb_img && !thumbError ? product.thumb_img : null
  const detailImgs = Array.isArray(product.detail_imgs) ? product.detail_imgs : []
  const rawPrice = product.retail_price
  const price = Number(rawPrice) || 0
  const isPriceUnset = rawPrice === null || rawPrice === undefined || price === 0

  const filteredFriends = useMemo(() => {
    const q = friendQuery.trim().toLowerCase()
    if (!q) return friends
    return friends.filter((f: any) => String(f.name || '').toLowerCase().includes(q))
  }, [friends, friendQuery])

  async function openGiftSheetAfterLogin() {
    if (!giftEnabled) {
      setToast('선물 기능이 비활성화되어 있어요')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const uid = me?.id ? String(me.id) : ''
    if (!uid) return
    setMeId(uid)
    const { data: rows } = await supabase.from('follows').select('following_id').eq('follower_id', uid)
    const ids = (rows || []).map((r: any) => r.following_id).filter(Boolean)
    if (!ids.length) {
      setFriends([])
      setSelectedFriendId('')
      setGiftOpen(true)
      return
    }
    const { data: users } = await supabase.from('users').select('id,name,avatar_url,skin_type').in('id', ids)
    const list = users || []
    setFriends(list)
    setSelectedFriendId(String(list[0]?.id || ids[0]))
    setGiftOpen(true)
  }

  const onAddCart = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoginFor('cart')
      setLoginModalOpen(true)
      return
    }
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const uid = me?.id ? String(me.id) : ''
    if (!uid) {
      setToast('회원 정보를 불러오지 못했어요')
      return
    }
    setMeId(uid)
    setSubmitting(true)
    try {
      const { data: found } = await supabase
        .from('cart_items')
        .select('id,quantity')
        .eq('user_id', uid)
        .eq('product_id', product.id)
        .maybeSingle()
      if (found?.id) {
        const nextQty = Number(found.quantity || 0) + quantity
        const { error: upErr } = await supabase.from('cart_items').update({ quantity: nextQty }).eq('id', found.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from('cart_items').insert({ user_id: uid, product_id: product.id, quantity } as any)
        if (insErr) throw insErr
      }
      broadcastCartCountRefresh()
      setToast('🛒 장바구니에 담았어요!')
    } catch (e: any) {
      setToast(e?.message || '장바구니 저장 중 오류가 발생했어요')
    } finally {
      setSubmitting(false)
    }
  }

  const onOpenGift = async () => {
    if (!giftEnabled) {
      setToast('선물 기능이 비활성화되어 있어요')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      try {
        sessionStorage.setItem(PENDING_GIFT_KEY, '1')
      } catch {}
      setLoginFor('gift')
      setLoginModalOpen(true)
      return
    }
    await openGiftSheetAfterLogin()
  }

  const onBuy = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setOpenGuestSheet(true)
      return
    }
    const total = price * quantity
    if (total < 1000) {
      alert('결제 금액은 1,000원 이상이어야 합니다.')
      return
    }
    if (!confirm(`${product.name} ${quantity}개 · ₩${total.toLocaleString()} 결제하시겠습니까?`)) return
    setSubmitting(true)
    try {
      const params = new URLSearchParams()
      params.set('products', String(product.id))
      params.set('qty', String(quantity))
      if (shareJournalId) params.set('share_journal_id', shareJournalId)
      router.push(`/checkout?${params.toString()}`)
    } catch (e: any) {
      alert(e?.message || '오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 110 }}>
      <DashboardHeader title={product.name || '제품'} right={<CustomerHeaderRight />} />
      <div style={{ padding: '0 18px 24px' }}>
        {toast ? (
          <div style={{ margin: '0 0 10px', padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12, fontWeight: 700 }}>
            {toast}
          </div>
        ) : null}
        <div style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', aspectRatio: '1', maxHeight: 360 }}>
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={() => setThumbError(true)} />
          ) : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 64, opacity: 0.3 }}>🧴</span></div>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{product.brands?.name || ''}</div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8, lineHeight: 1.35 }}>{product.name}</h1>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 800, color: isPriceUnset ? 'var(--text3)' : 'var(--gold)', marginBottom: 16 }}>
          {isPriceUnset ? '준비 중' : `₩${price.toLocaleString()}`}
        </div>
        {!isPriceUnset && (
          <div style={{ marginBottom: 20, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>수량</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => setQuantity((v) => Math.max(1, v - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>-</button>
                <div style={{ minWidth: 24, textAlign: 'center', fontSize: 14, color: '#fff', fontWeight: 800 }}>{quantity}</div>
                <button type="button" onClick={() => setQuantity((v) => Math.min(99, v + 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>+</button>
              </div>
            </div>
            <button type="button" onClick={onAddCart} disabled={submitting} style={{ height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, fontWeight: 800 }}>🛒 장바구니 담기</button>
            {giftEnabled ? (
              <button type="button" onClick={onOpenGift} disabled={submitting} style={{ height: 44, borderRadius: 12, border: '1px solid rgba(140,180,255,0.4)', background: 'rgba(140,180,255,0.12)', color: '#bcd6ff', fontSize: 14, fontWeight: 800 }}>🎁 오랜일촌에게 선물하기</button>
            ) : null}
            <button type="button" onClick={onBuy} disabled={submitting} style={{ height: 46, borderRadius: 12, border: '1px solid rgba(201,168,76,0.5)', background: 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.12))', color: 'var(--gold)', fontSize: 14, fontWeight: 900 }}>
              {submitting ? '처리 중...' : `⚡ 바로 구매하기  ₩${(price * quantity).toLocaleString()}`}
            </button>
          </div>
        )}
        {product.description ? <div style={{ marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{product.description}</div> : null}
        {detailImgs.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>{detailImgs.map((url: string, i: number) => <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}><img src={url} alt={`${product.name} ${i + 1}`} style={{ width: '100%', verticalAlign: 'top', display: 'block' }} /></div>)}</div> : null}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link href="/products" style={{ display: 'inline-block', padding: '12px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>← 제품 목록</Link>
        </div>
      </div>
      {openGuestSheet && (
        <div onClick={() => setOpenGuestSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 120 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 16 }}>
            <div style={{ fontSize: 16, color: '#fff', fontWeight: 800, marginBottom: 6 }}>로그인 후 구매 가능해요</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>첫 가입 8,888P 지급</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => router.push('/login?role=customer')} style={{ height: 40, borderRadius: 10, border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontWeight: 800 }}>로그인</button>
              <button onClick={() => router.push('/signup')} style={{ height: 40, borderRadius: 10, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}>회원가입</button>
            </div>
          </div>
        </div>
      )}
      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false)
          setLoginFor(null)
          try {
            sessionStorage.removeItem(PENDING_GIFT_KEY)
          } catch {}
        }}
        returnPath={loginFor === 'gift' ? `${returnPath}${returnPath.includes('?') ? '&' : '?'}open=gift` : returnPath}
      />
      {giftOpen && (
        <div onClick={() => setGiftOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 130 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 16, color: '#fff', fontWeight: 800, marginBottom: 8 }}>🎁 오랜일촌에게 선물하기</div>
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 10 }} />
            <input
              value={friendQuery}
              onChange={(e) => setFriendQuery(e.target.value)}
              placeholder="🔍 친구 검색..."
              style={{ width: '100%', marginBottom: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 13 }}
            />
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 10 }} />
            <div style={{ display: 'grid', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {filteredFriends.length === 0 ? (
                friends.length === 0 ? (
                  <div style={{ padding: '12px 8px', fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                    아직 오랜일촌이 없어요
                    <br />
                    <button type="button" onClick={() => { setGiftOpen(false); router.push('/myworld') }} style={{ marginTop: 10, background: 'none', border: 'none', color: '#bcd6ff', fontWeight: 800, cursor: 'pointer', padding: 0 }}>
                      마이월드에서 맺어보세요 →
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>검색 결과가 없어요</div>
                )
              ) : (
                filteredFriends.map((f: any) => (
                  <button key={f.id} type="button" onClick={() => setSelectedFriendId(String(f.id))} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, border: selectedFriendId === String(f.id) ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)', background: selectedFriendId === String(f.id) ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: '#fff', padding: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                      {f.avatar_url ? <img src={f.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ fontSize: 13, textAlign: 'left' }}>
                      {f.name} · {skinLineLabel(f.skin_type)}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 0 10px' }} />
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>💌 메시지 (선택 · 최대 {giftMessageMax}자)</div>
            <textarea value={giftMessage} maxLength={giftMessageMax} onChange={e => setGiftMessage(e.target.value)} placeholder="따뜻한 한마디를 남겨보세요" style={{ width: '100%', minHeight: 74, marginTop: 6, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 10, resize: 'none' }} />
            <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.08)', margin: '10px 0 10px' }} />
            <button
              type="button"
              disabled={!selectedFriendId}
              onClick={() => {
                if (!selectedFriendId) return
                const params = new URLSearchParams()
                params.set('products', String(product.id))
                params.set('qty', String(quantity))
                params.set('gift_to', selectedFriendId)
                const trimmed = giftMessage.trim()
                if (trimmed) params.set('gift_message', trimmed)
                setGiftOpen(false)
                router.push(`/checkout?${params.toString()}`)
              }}
              style={{ marginTop: 2, width: '100%', height: 42, borderRadius: 10, border: 'none', background: selectedFriendId ? '#c9a84c' : '#55606f', color: selectedFriendId ? '#111' : '#c8d0db', fontWeight: 900 }}
            >
              🎁 선물하기 · ₩{(price * quantity).toLocaleString()}
            </button>
          </div>
        </div>
      )}
      <DashboardBottomNav role="customer" />
    </div>
  )
}
