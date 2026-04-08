'use client'

import { compressImage } from '@/lib/imageUpload'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

type ToolPanel = 'product' | 'routine' | 'coupon' | 'toast' | null

type BasketItem = { id: string; name: string; price: number; thumb: string }

type ProductRow = { id: string; name: string; retail_price: number; thumb_img: string | null }

const SAMPLE_COUPON_OPTIONS: { id: string; title: string }[] = [
  { id: 'sample_welcome', title: '웰컴 5% 쿠폰 (샘플)' },
  { id: 'sample_ship', title: '배송비 무료 (샘플)' },
]

type MsgRow = {
  id: string
  channel_id: string
  sender_id?: string | null
  body?: string | null
  message?: string | null
  content?: string | null
  image_url?: string | null
  is_from_customer?: boolean | null
  message_kind?: string | null
  created_at: string
}

function msgText(m: MsgRow): string {
  return String(m.body ?? m.message ?? m.content ?? '').trim()
}

export default function OwnerChatRoomPage() {
  const supabase = createClient()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const channelId = params?.id ? String(params.id) : ''

  const fileRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rtRef = useRef<any>(null)

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [channelTitle, setChannelTitle] = useState('상담')
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [memoOpen, setMemoOpen] = useState(false)
  const [memoText, setMemoText] = useState('')
  const [memoSaving, setMemoSaving] = useState(false)

  const [toolPanel, setToolPanel] = useState<ToolPanel>(null)
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<ProductRow[]>([])
  const [routineText, setRoutineText] = useState('')
  const [toastAmount, setToastAmount] = useState('')
  const [toastMemo, setToastMemo] = useState('')
  const [customerUserId, setCustomerUserId] = useState<string | null>(null)
  const [couponOptions, setCouponOptions] = useState<{ id: string; title: string }[]>(SAMPLE_COUPON_OPTIONS)
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null)

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    scrollBottom()
  }, [messages, scrollBottom])

  useEffect(() => {
    if (!channelId) {
      setLoading(false)
      setForbidden(true)
      return
    }

    let cancelled = false

    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login?role=owner')
        return
      }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!urow?.id) {
        router.replace('/login?role=owner')
        return
      }
      const uid = String(urow.id)
      if (cancelled) return
      setOwnerUserId(uid)

      const { data: ch, error: chErr } = await supabase
        .from('chat_channels')
        .select('id,title,owner_memo,user_id')
        .eq('id', channelId)
        .maybeSingle()

      if (cancelled) return
      if (chErr || !ch) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setChannelTitle(String(ch.title || '상담'))
      setMemoText(String((ch as { owner_memo?: string | null }).owner_memo ?? ''))
      setCustomerUserId((ch as { user_id?: string | null }).user_id ? String((ch as { user_id: string }).user_id) : null)

      await supabase.from('chat_channels').update({ unread_count: 0 }).eq('id', channelId)

      const { data: msgs } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      setMessages((msgs || []) as MsgRow[])

      const rt = supabase.channel(`consultation_messages:owner:${channelId}`)
      ;(rt as any)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'consultation_messages', filter: `channel_id=eq.${channelId}` },
          (payload: { new?: MsgRow }) => {
            const row = payload?.new
            if (!row?.id) return
            setMessages((prev) => {
              if (prev.some((p) => p.id === row.id)) return prev
              return [...prev, row]
            })
          }
        )
        .subscribe()

      rtRef.current = rt
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
      const ch = rtRef.current
      rtRef.current = null
      if (ch) {
        void supabase.removeChannel(ch)
      }
    }
  }, [channelId, router, supabase])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('products')
        .select('id,name,retail_price,thumb_img')
        .eq('status', 'active')
        .limit(50)
      if (!cancelled && data) setProducts((data as ProductRow[]) || [])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable; mount once
  }, [])

  useEffect(() => {
    if (toolPanel !== 'coupon' || !customerUserId) {
      if (toolPanel !== 'coupon') setSelectedCouponId(null)
      return
    }
    let cancelled = false
    void (async () => {
      const { data: u } = await supabase.from('users').select('auth_id').eq('id', customerUserId).maybeSingle()
      const authId = u && (u as { auth_id?: string | null }).auth_id ? String((u as { auth_id: string }).auth_id) : null
      if (!authId) {
        if (!cancelled) {
          setCouponOptions(SAMPLE_COUPON_OPTIONS)
          setSelectedCouponId(SAMPLE_COUPON_OPTIONS[0]?.id ?? null)
        }
        return
      }
      const { data: ucs, error } = await supabase.from('user_coupons').select('id,coupon_id,status').eq('user_id', authId).eq('status', 'active').limit(30)
      if (cancelled) return
      if (error || !ucs?.length) {
        setCouponOptions(SAMPLE_COUPON_OPTIONS)
        setSelectedCouponId(SAMPLE_COUPON_OPTIONS[0]?.id ?? null)
        return
      }
      const ids = Array.from(new Set(ucs.map((r: { coupon_id: string }) => r.coupon_id).filter(Boolean)))
      const { data: cps } = ids.length ? await supabase.from('coupons').select('id,name').in('id', ids) : { data: null }
      const map = new Map((cps as { id: string; name: string }[] | null)?.map((c) => [c.id, c.name]) || [])
      const opts = ucs.map((r: { id: string; coupon_id: string }) => ({
        id: r.id,
        title: map.get(r.coupon_id) || `쿠폰 ${r.coupon_id.slice(0, 8)}…`,
      }))
      setCouponOptions(opts.length ? opts : SAMPLE_COUPON_OPTIONS)
      setSelectedCouponId((opts.length ? opts : SAMPLE_COUPON_OPTIONS)[0]?.id ?? null)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable
  }, [toolPanel, customerUserId])

  const sendText = async () => {
    const text = draft.trim()
    if (!text || !ownerUserId || !channelId || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: text,
        is_from_customer: false,
        message_kind: 'text',
      } as any)
      if (!error) setDraft('')
    } finally {
      setSending(false)
    }
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !ownerUserId || !channelId || sending) return
    setSending(true)
    try {
      const compressed = await compressImage(file, 'community')
      const path = `consultation-chat/${ownerUserId}/${channelId}/${Date.now()}_${compressed.name.replace(/[^\w.-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('community').upload(path, compressed, { upsert: true })
      if (upErr) return
      const { data: pub } = supabase.storage.from('community').getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) return
      await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: null,
        image_url: url,
        is_from_customer: false,
        message_kind: 'image',
      } as any)
    } finally {
      setSending(false)
    }
  }

  const saveMemo = async () => {
    if (!channelId || memoSaving) return
    setMemoSaving(true)
    try {
      const { error } = await supabase.from('chat_channels').update({ owner_memo: memoText }).eq('id', channelId)
      if (!error) setMemoOpen(false)
    } finally {
      setMemoSaving(false)
    }
  }

  const toggleTool = (p: Exclude<ToolPanel, null>) => {
    setToolPanel((cur) => (cur === p ? null : p))
  }

  const toggleProductInBasket = (p: ProductRow) => {
    setBasket((prev) => {
      const i = prev.findIndex((b) => b.id === p.id)
      if (i >= 0) return prev.filter((_, j) => j !== i)
      return [
        ...prev,
        {
          id: p.id,
          name: p.name,
          price: Number(p.retail_price ?? 0),
          thumb: String(p.thumb_img || ''),
        },
      ]
    })
  }

  const removeFromBasket = (id: string) => {
    setBasket((prev) => prev.filter((b) => b.id !== id))
  }

  const sendProductRecommend = async () => {
    if (!channelId || !ownerUserId || !basket.length || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: JSON.stringify(basket),
        is_from_customer: false,
        message_kind: 'product_recommend',
      } as any)
      if (!error) {
        setBasket([])
        setToolPanel(null)
      }
    } finally {
      setSending(false)
    }
  }

  const sendRoutineCard = async () => {
    const t = routineText.trim()
    if (!channelId || !ownerUserId || !t || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: t,
        is_from_customer: false,
        message_kind: 'routine_card',
      } as any)
      if (!error) {
        setRoutineText('')
        setToolPanel(null)
      }
    } finally {
      setSending(false)
    }
  }

  const sendCouponGift = async () => {
    if (!channelId || !ownerUserId || !selectedCouponId || sending) return
    const opt = couponOptions.find((c) => c.id === selectedCouponId)
    if (!opt) return
    setSending(true)
    try {
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: JSON.stringify({ user_coupon_id: opt.id, title: opt.title }),
        is_from_customer: false,
        message_kind: 'coupon_gift',
      } as any)
      if (!error) setToolPanel(null)
    } finally {
      setSending(false)
    }
  }

  const sendToastGift = async () => {
    const n = Math.floor(Number(toastAmount))
    if (!channelId || !ownerUserId || !customerUserId || !Number.isFinite(n) || n <= 0 || sending) return
    setSending(true)
    try {
      const { data: u } = await supabase.from('users').select('points').eq('id', customerUserId).maybeSingle()
      const cur = Number((u as { points?: number } | null)?.points || 0)
      const next = cur + n
      const { error: upErr } = await supabase.from('users').update({ points: next }).eq('id', customerUserId)
      if (upErr) return
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: '🍓 달콤한 딸기잼 선물! 🍞 ' + toastAmount + 'T가 쌓였어요',
        is_from_customer: false,
        message_kind: 'toast_gift',
      } as any)
      if (!error) {
        setToastAmount('')
        setToastMemo('')
        setToolPanel(null)
      }
    } finally {
      setSending(false)
    }
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.trim().toLowerCase())
  )

  const chipBtnStyle = (active: boolean) => ({
    flexShrink: 0,
    padding: '6px 10px',
    borderRadius: 999,
    border: active ? `1px solid ${GOLD}` : `1px solid rgba(123,94,167,0.4)`,
    background: active ? 'rgba(201,169,110,0.2)' : 'rgba(123,94,167,0.12)',
    color: active ? '#f5e6c8' : '#e8dff5',
    fontSize: 11,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, padding: 24, fontSize: 13 }}>
        불러오는 중...
      </div>
    )
  }

  if (forbidden) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24, fontSize: 13 }}>
        <p style={{ marginBottom: 16 }}>채팅방을 열 수 없어요</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/owner')}
          style={{
            padding: '10px 16px',
            borderRadius: 10,
            border: `1px solid ${PURPLE}`,
            background: 'rgba(123,94,167,0.15)',
            color: '#e8dff5',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          대시보드로
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'linear-gradient(160deg,#0a0c0f,#111318)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            aria-label="목록으로"
            onClick={() => router.push('/dashboard/owner')}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ‹
          </button>
          <div
            style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 16,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {channelTitle}
          </div>
          <button
            type="button"
            aria-label="원장 메모"
            onClick={() => setMemoOpen(true)}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 8,
              border: `1px solid rgba(123,94,167,0.45)`,
              background: 'rgba(123,94,167,0.18)',
              color: '#e8dff5',
              fontSize: 13,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            📝
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#e8dff5', border: '1px solid rgba(123,94,167,0.45)', background: 'rgba(123,94,167,0.2)', borderRadius: 999, padding: '4px 10px' }}>
          원장
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {messages.map((m) => {
          const mine = !m.is_from_customer
          const isImage = m.message_kind === 'image' && m.image_url
          let productItems: { id: string; name: string; price: number; thumb: string }[] = []
          if (m.message_kind === 'product_recommend') {
            try {
              const raw = String(m.message ?? '')
              const p = raw ? JSON.parse(raw) : null
              productItems = Array.isArray(p) ? p : []
            } catch {
              productItems = []
            }
          }
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div
                style={{
                  maxWidth: '85%',
                  borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding:
                    m.message_kind === 'product_recommend' || m.message_kind === 'routine_card' ? 8 : '10px 12px',
                  background: mine ? 'rgba(123,94,167,0.45)' : 'rgba(201,169,110,0.15)',
                  border: mine ? 'none' : '1px solid rgba(201,169,110,0.3)',
                }}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image_url!} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
                ) : m.message_kind === 'product_recommend' ? (
                  <div
                    style={{
                      maxWidth: 260,
                      borderRadius: 12,
                      border: '1px solid rgba(123,94,167,0.55)',
                      overflow: 'hidden',
                      background: 'rgba(123,94,167,0.08)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: '#e8dff5',
                        padding: '8px 10px',
                        borderBottom: '1px solid rgba(123,94,167,0.25)',
                      }}
                    >
                      🧴 추천 제품 {productItems.length}개
                    </div>
                    {productItems.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: TEXT_MUTED }}>표시할 제품이 없어요</div>
                    ) : (
                      productItems.map((it, idx) => (
                        <div
                          key={it.id || String(idx)}
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            padding: '10px',
                            borderBottom:
                              idx < productItems.length - 1 ? '1px solid rgba(123,94,167,0.2)' : undefined,
                          }}
                        >
                          {it.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.thumb}
                              alt=""
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                objectFit: 'cover',
                                flexShrink: 0,
                                background: 'rgba(255,255,255,0.06)',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                flexShrink: 0,
                                background: 'rgba(255,255,255,0.08)',
                              }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.35 }}>{it.name}</div>
                            <div style={{ fontSize: 10, color: PURPLE, marginTop: 2 }}>
                              {Number(it.price ?? 0).toLocaleString()}원
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderTop: '1px solid rgba(123,94,167,0.25)',
                        color: PURPLE,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      장바구니 담기 →
                    </button>
                  </div>
                ) : m.message_kind === 'routine_card' ? (
                  <div
                    style={{
                      maxWidth: 260,
                      borderRadius: 12,
                      border: '1px solid rgba(123,94,167,0.55)',
                      padding: 10,
                      background: 'rgba(123,94,167,0.08)',
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#e8dff5', marginBottom: 8 }}>💜 루틴 알림장</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: mine ? '#f3e9ff' : '#f5e6c8',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                      }}
                    >
                      {msgText(m)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: mine ? '#f3e9ff' : '#f5e6c8', lineHeight: 1.5 }}>{msgText(m)}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          padding: '10px 12px',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)',
          background: 'linear-gradient(180deg, transparent, #0D0B09 28%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          maxHeight: '72vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {toolPanel ? (
          <div
            style={{
              marginTop: 8,
              marginBottom: 0,
              padding: 12,
              maxHeight: 220,
              overflowY: 'auto',
              flexShrink: 0,
              boxSizing: 'border-box',
              WebkitOverflowScrolling: 'touch',
            }}
          >
        {toolPanel === 'product' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="제품 검색"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 13,
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <div
              style={{
                borderRadius: 10,
                border: '1px solid rgba(123,94,167,0.25)',
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              {filteredProducts.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: TEXT_MUTED }}>검색 결과가 없어요</div>
              ) : (
                filteredProducts.map((p) => {
                  const on = basket.some((b) => b.id === p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProductInBasket(p)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: on ? 'rgba(123,94,167,0.2)' : 'transparent',
                        color: '#fff',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {on ? '✓ ' : ''}
                      {p.name}{' '}
                      <span style={{ color: GOLD }}>{Number(p.retail_price ?? 0).toLocaleString()}원</span>
                    </button>
                  )
                })
              )}
            </div>
            {basket.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {basket.map((b) => (
                  <span
                    key={b.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: 'rgba(201,169,110,0.15)',
                      border: '1px solid rgba(201,169,110,0.35)',
                      fontSize: 11,
                      color: '#f5e6c8',
                    }}
                  >
                    {b.name}
                    <button
                      type="button"
                      aria-label="제거"
                      onClick={() => removeFromBasket(b.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void sendProductRecommend()}
              disabled={sending || basket.length === 0}
              style={{
                alignSelf: 'flex-end',
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: sending || basket.length === 0 ? 'rgba(123,94,167,0.25)' : PURPLE,
                color: '#fff',
                fontSize: 13,
                cursor: sending || basket.length === 0 ? 'default' : 'pointer',
              }}
            >
              전송{basket.length > 1 ? ' (묶음)' : ''}
            </button>
          </div>
        ) : null}

        {toolPanel === 'routine' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              value={routineText}
              onChange={(e) => setRoutineText(e.target.value)}
              placeholder="루틴 알림장 내용"
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                maxHeight: 120,
                resize: 'none',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 13,
                padding: '10px 12px',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void sendRoutineCard()}
              disabled={sending || !routineText.trim()}
              style={{
                alignSelf: 'flex-end',
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: sending || !routineText.trim() ? 'rgba(123,94,167,0.25)' : PURPLE,
                color: '#fff',
                fontSize: 13,
                cursor: sending || !routineText.trim() ? 'default' : 'pointer',
              }}
            >
              전송
            </button>
          </div>
        ) : null}

        {toolPanel === 'coupon' ? (
          <div>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 6 }}>쿠폰 선택 후 전송</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, maxWidth: '100%' }}>
              {couponOptions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCouponId(c.id)}
                  style={{
                    flexShrink: 0,
                    maxWidth: 200,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border:
                      selectedCouponId === c.id ? `1px solid ${GOLD}` : '1px solid rgba(123,94,167,0.35)',
                    background: selectedCouponId === c.id ? 'rgba(201,169,110,0.15)' : 'rgba(123,94,167,0.1)',
                    color: '#f5e6c8',
                    fontSize: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {c.title}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void sendCouponGift()}
              disabled={sending || !selectedCouponId}
              style={{
                marginTop: 8,
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: sending || !selectedCouponId ? 'rgba(123,94,167,0.25)' : PURPLE,
                color: '#fff',
                fontSize: 13,
                cursor: sending || !selectedCouponId ? 'default' : 'pointer',
              }}
            >
              쿠폰 선물 전송
            </button>
          </div>
        ) : null}

        {toolPanel === 'toast' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={toastAmount}
              onChange={(e) => setToastAmount(e.target.value)}
              placeholder="딸기잼 (T)"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 13,
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <textarea
              value={toastMemo}
              onChange={(e) => setToastMemo(e.target.value)}
              placeholder="메모 (선택)"
              rows={2}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                resize: 'none',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 12,
                padding: '8px 10px',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => void sendToastGift()}
              disabled={sending || !customerUserId}
              style={{
                alignSelf: 'flex-end',
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: sending || !customerUserId ? 'rgba(123,94,167,0.25)' : PURPLE,
                color: '#fff',
                fontSize: 13,
                cursor: sending || !customerUserId ? 'default' : 'pointer',
              }}
            >
              적립 전송
            </button>
          </div>
        ) : null}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, minHeight: 0 }}>
          <div
            style={{
              display: 'flex',
              width: '100%',
              minWidth: 0,
              gap: 6,
              overflowX: 'auto',
              paddingBottom: 2,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <button type="button" onClick={() => toggleTool('product')} style={chipBtnStyle(toolPanel === 'product')}>
              🧴 제품추천
            </button>
            <button type="button" onClick={() => toggleTool('routine')} style={chipBtnStyle(toolPanel === 'routine')}>
              📋 루틴알림장
            </button>
            <button type="button" onClick={() => toggleTool('coupon')} style={chipBtnStyle(toolPanel === 'coupon')}>
              🎫 쿠폰선물
            </button>
            <button type="button" onClick={() => toggleTool('toast')} style={chipBtnStyle(toolPanel === 'toast')}>
              🍓 딸기잼 적립
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%', minHeight: 0 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending}
              style={{
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 10,
                border: `1px solid rgba(123,94,167,0.35)`,
                background: 'rgba(123,94,167,0.12)',
                color: PURPLE,
                fontSize: 18,
                cursor: sending ? 'default' : 'pointer',
              }}
              aria-label="사진"
            >
              🖼
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="메시지를 입력하세요"
              rows={1}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 40,
                maxHeight: 120,
                resize: 'none',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 13,
                padding: '10px 12px',
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendText()
                }
              }}
            />
            <button
              type="button"
              onClick={() => void sendText()}
              disabled={sending || !draft.trim()}
              style={{
                flexShrink: 0,
                padding: '10px 14px',
                borderRadius: 12,
                border: 'none',
                background: sending || !draft.trim() ? 'rgba(123,94,167,0.25)' : PURPLE,
                color: '#fff',
                fontSize: 13,
                cursor: sending || !draft.trim() ? 'default' : 'pointer',
              }}
            >
              보내기
            </button>
          </div>
        </div>
      </div>

      {memoOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 400,
              borderRadius: 14,
              border: '1px solid rgba(123,94,167,0.35)',
              background: '#151218',
              padding: 16,
              boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 10 }}>원장님만 볼 수 있는 메모예요</div>
            <textarea
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              rows={6}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: 13,
                padding: '10px 12px',
                outline: 'none',
                resize: 'vertical',
                marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setMemoOpen(false)}
                disabled={memoSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent',
                  color: TEXT_MUTED,
                  fontSize: 13,
                  cursor: memoSaving ? 'default' : 'pointer',
                }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => void saveMemo()}
                disabled={memoSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: memoSaving ? 'rgba(123,94,167,0.35)' : PURPLE,
                  color: '#fff',
                  fontSize: 13,
                  cursor: memoSaving ? 'default' : 'pointer',
                }}
              >
                {memoSaving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
