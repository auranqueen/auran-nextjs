'use client'

import { compressImage } from '@/lib/imageUpload'
import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const GOLD = '#C9A96E'
const TEXT_MUTED = 'rgba(255,255,255,0.45)'

const CARD_LIB = [
  { card_type: 'skin', title: '😣 피부 이상해요', chips: ['🔥 따갑고 예민함', '💧 너무 건조함', '😣 트러블 났어요', '🫧 번들거려요', '🌫 칙칙해졌어요'], has_text: false, sos: false },
  { card_type: 'routine', title: '📋 루틴 점검해주세요', chips: ['아침 루틴 함', '저녁 루틴 함', '자주 스킵해요', '뭘 발라야 할지 모르겠어요'], has_text: false, sos: false },
  { card_type: 'recommend', title: '💜 제품 추천해주세요', chips: ['진정 제품', '수분 제품', '피지 조절', '영양 크림', '특별 케어'], has_text: false, sos: false },
  { card_type: 'sample', title: '🎁 샘플 받고싶어요', chips: ['시바산 토너', '르노벨 에센스', '제네틱 크림', '이타카 오일'], has_text: false, sos: false },
  { card_type: 'sos', title: '🆘 피부 SOS', chips: ['갑자기 뒤집어짐', '새 제품 쓰고 반응', '시술 후 트러블', '극심한 건조함'], has_text: true, sos: true },
] as const

type MsgRow = {
  id: string
  channel_id: string
  user_id: string
  sender_id?: string | null
  message?: string | null
  content?: string | null
  image_url?: string | null
  is_from_customer?: boolean | null
  message_kind?: string | null
  created_at: string
  coupon_title?: string | null
  coupon_subtitle?: string | null
  order_id?: string | null
  tracking_no?: string | null
  courier?: string | null
}

type RoutineCardRow = {
  id: string
  channel_id?: string | null
  user_id?: string | null
  title?: string | null
  steps?: any
  memo?: string | null
  created_at?: string | null
}

function msgText(m: MsgRow): string {
  return String(m.message ?? m.content ?? '').trim()
}

type RecommendItem = { id: string; name: string; price: number; thumb: string }

function parseRecommendItems(m: MsgRow): RecommendItem[] {
  try {
    const raw = String(m.message ?? '')
    const p = raw ? JSON.parse(raw) : null
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

function toastLabel(type: string, _source: string) {
  if (type === 'gift') return '🍓 원장님 딸기잼 선물'
  if (type === 'review') return '⭐ 리뷰 작성'
  if (type === 'attendance') return '🧈 출석 체크인'
  if (type === 'purchase') return '🛒 구매 적립'
  if (type === 'signup') return '🎁 가입 환영'
  return '🍞 토스트 적립'
}

export default function CustomerChatRoomPage() {
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
  const [internalUserId, setInternalUserId] = useState<string | null>(null)
  const [notifSound, setNotifSound] = useState('violet')
  const notifSoundRef = useRef('violet')
  useEffect(() => {
    notifSoundRef.current = notifSound
  }, [notifSound])
  const [messages, setMessages] = useState<MsgRow[]>([])
  const [routineCards, setRoutineCards] = useState<RoutineCardRow[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [slideOpen, setSlideOpen] = useState(false)
  const [profileInfo, setProfileInfo] = useState<{
    username: string
    avatar_url: string | null
    grade: string
    total_purchase: number
    hormone_phase: string | null
    hormone_label: string | null
  } | null>(null)
  const [orderHistory, setOrderHistory] = useState<any[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<{
    product_name: string
    created_at: string
    product_id: string | null
  }[]>([])
  const [toastBalance, setToastBalance] = useState(0)
  const [userCoupons, setUserCoupons] = useState<any[]>([])
  const [toastHistory, setToastHistory] = useState<any[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'toast' | 'coupon' | 'history' | 'orders'>('toast')
  const [showCycleBanner, setShowCycleBanner] = useState(false)
  const [cycleModalOpen, setCycleModalOpen] = useState(false)
  const [cycleDateInput, setCycleDateInput] = useState('')
  const [cycleSaving, setCycleSaving] = useState(false)
  const [customerAuthId, setCustomerAuthId] = useState<string | null>(null)
  const [ownerInfo, setOwnerInfo] = useState<{
    username: string
    avatar_url: string | null
  } | null>(null)
  const [showCardLib, setShowCardLib] = useState(false)
  const [cardModal, setCardModal] = useState<{
    card_type: string
    title: string
    chips: string[]
    has_text: boolean
    sos?: boolean
  } | null>(null)
  const [cardModalPicks, setCardModalPicks] = useState<string[]>([])
  const [cardModalText, setCardModalText] = useState('')
  const [inlineCardPicks, setInlineCardPicks] = useState<Record<string, string[]>>({})
  const [inlineCardText, setInlineCardText] = useState<Record<string, string>>({})
  const [inlineCardSent, setInlineCardSent] = useState<Record<string, boolean>>({})
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voiceType, setVoiceType] = useState<'bug' | 'idea' | 'praise' | null>(null)
  const [voiceContent, setVoiceContent] = useState('')
  const [voiceSending, setVoiceSending] = useState(false)
  const [voiceDone, setVoiceDone] = useState(false)
  const [chatBanner, setChatBanner] = useState<{
    enabled: boolean
    event_enabled: boolean
    main_text: string
    sub_text: string
    phase_auto: boolean
    link: string
    expires_at: string
  } | null>(null)
  const [chatQuickBtns, setChatQuickBtns] = useState<{
    skin_report: boolean
    owner_pick: boolean
    toast_wallet: boolean
  }>({ skin_report: true, owner_pick: true, toast_wallet: true })

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [])

  useEffect(() => {
    scrollBottom()
  }, [messages, routineCards, scrollBottom])

  useEffect(() => {
    if (!internalUserId) return
    const load = async () => {
      const { data: userRow } = await supabase
        .from('users')
        .select('auth_id,total_orders,points')
        .eq('id', internalUserId)
        .maybeSingle()
      if (!userRow) return
      const { data: orderSum } = await supabase
        .from('orders')
        .select('final_amount')
        .eq('customer_id', internalUserId)
        .in('status', ['주문확인', '발송준비', '배송중', '배송완료'])
      const totalPurchase = (orderSum ?? []).reduce((acc: number, o: any) => acc + (Number(o.final_amount) || 0), 0)
      const authId = userRow.auth_id
      const [profileRes, cycleRes, recRes] = await Promise.all([
        supabase.from('profiles').select('username,avatar_url,grade,notification_sound').eq('auth_id', authId).maybeSingle(),
        supabase
          .from('skin_cycle_analysis')
          .select('hormone_stage')
          .eq('auth_id', authId)
          .order('analysis_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('consultation_messages')
          .select('message,created_at')
          .eq('channel_id', channelId)
          .eq('message_kind', 'product_recommend')
          .order('created_at', { ascending: false })
          .limit(3),
      ])
      const p = profileRes.data
      if ((p as any)?.notification_sound) {
        setNotifSound(String((p as any).notification_sound))
      }
      const phaseMap: Record<string, string> = {
        menstrual: '달빛기',
        follicular: '황금기',
        ovulation: '만개기',
        luteal: '물들기',
      }
      const phase = cycleRes.data?.hormone_stage ?? null
      setCustomerAuthId(authId)
      setShowCycleBanner(!phase)
      setProfileInfo({
        username: p?.username ?? '고객',
        avatar_url: p?.avatar_url ?? null,
        grade: p?.grade ?? 'PETAL',
        total_purchase: totalPurchase,
        hormone_phase: phase,
        hormone_label: phase ? (phaseMap[phase] ?? phase) : null,
      })
      void supabase
        .from('chat_channels')
        .select('owner_id')
        .eq('id', channelId)
        .maybeSingle()
        .then(({ data: chData }) => {
          if (!(chData as { owner_id?: string | null } | null)?.owner_id) return
          void supabase
            .from('users')
            .select('auth_id')
            .eq('id', String((chData as { owner_id: string }).owner_id))
            .maybeSingle()
            .then(({ data: uData }) => {
              if (!uData?.auth_id) return
              void supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('auth_id', uData.auth_id)
                .maybeSingle()
                .then(({ data: oData }) => {
                  if (oData) {
                    setOwnerInfo({
                      username: oData.username ?? '원장님',
                      avatar_url: oData.avatar_url ?? null,
                    })
                  }
                })
            })
        })
      if (recRes.data) {
        const parsed = recRes.data.map((m: any) => {
          try {
            const arr = JSON.parse(m.message ?? '[]')
            const first = Array.isArray(arr) ? arr[0] : arr
            return { product_name: first?.name ?? '추천 제품', created_at: m.created_at, product_id: first?.id ?? null }
          } catch {
            return { product_name: '추천 제품', created_at: m.created_at, product_id: null }
          }
        })
        setRecommendedProducts(parsed)
      }
      const { data: bannerRows } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['chat_banner_enabled', 'chat_banner_event_enabled', 'chat_banner', 'chat_quick_btns'])
      if (bannerRows) {
        const map = Object.fromEntries(bannerRows.map((r) => [r.key, r.value]))
        if (map.chat_banner_enabled === 'true' && map.chat_banner) {
          const b = typeof map.chat_banner === 'string' ? JSON.parse(map.chat_banner) : map.chat_banner
          setChatBanner({
            enabled: map.chat_banner_enabled === 'true',
            event_enabled: map.chat_banner_event_enabled === 'true',
            ...b,
          })
        }
        if (map.chat_quick_btns) {
          const q = typeof map.chat_quick_btns === 'string' ? JSON.parse(map.chat_quick_btns) : map.chat_quick_btns
          setChatQuickBtns(q)
        }
      }
    }
    void load()
  }, [internalUserId, channelId])

  useEffect(() => {
    if (!internalUserId) return
    supabase
      .from('toast_transactions')
      .select('id, amount, transaction_type, source_type, created_at')
      .eq('user_id', internalUserId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) {
          const total = data.reduce((sum, t) => sum + (t.amount || 0), 0)
          setToastBalance(total)
          setToastHistory(data)
        }
      })
    supabase
      .from('user_coupons')
      .select('*, coupons(*)')
      .eq('user_id', internalUserId)
      .eq('status', 'unused')
      .then(({ data }) => {
        const base = data || []
        setUserCoupons(base)
        supabase
          .from('coupons')
          .select('id, name, code, discount_rate, discount_amount, discount_value, scope, scope_brand_ids, min_order, coupon_type, description')
          .eq('is_active', true)
          .eq('coupon_type', 'regular')
          .eq('scope', 'brand')
          .then(({ data: brandCoupons }) => {
            if (brandCoupons && brandCoupons.length > 0) {
              const virtualCoupons = brandCoupons.map((c: any) => ({
                id: `brand_${c.id}`,
                status: 'unused',
                issued_at: null,
                used_at: null,
                expired_at: null,
                coupon_id: c.id,
                coupons: c,
                is_brand_coupon: true,
              }))
              setUserCoupons([...base, ...virtualCoupons])
            }
          })
      })
    supabase
      .from('orders')
      .select('id, order_no, final_amount, status, created_at, items')
      .eq('customer_id', internalUserId)
      .eq('payment_applied', true)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setOrderHistory(data)
      })
  }, [internalUserId])

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
        router.replace('/login?role=customer')
        return
      }
      const { data: urow } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      if (!urow?.id) {
        router.replace('/login?role=customer')
        return
      }
      const uid = String(urow.id)
      if (cancelled) return
      setInternalUserId(uid)

      const { data: ch, error: chErr } = await supabase
        .from('chat_channels')
        .select('id,title,user_id')
        .eq('id', channelId)
        .eq('user_id', uid)
        .maybeSingle()

      if (cancelled) return
      if (chErr || !ch) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setChannelTitle(String(ch.title || '상담'))

      await supabase.from('chat_channels').update({ unread_count: 0 }).eq('id', channelId).eq('user_id', uid)

      const { data: msgs } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true })

      if (cancelled) return
      setMessages((msgs || []) as MsgRow[])

      const { data: rc } = await supabase
        .from('routine_cards')
        .select('id,channel_id,user_id,title,steps,memo,created_at')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (cancelled) return
      setRoutineCards((rc || []) as RoutineCardRow[])

      const rt = supabase.channel(`consultation_messages:${channelId}`)
      ;(rt as any)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'consultation_messages', filter: `channel_id=eq.${channelId}` },
          (payload: { new?: MsgRow }) => {
            const row = payload?.new
            if (!row?.id) return
            const _senderId = String(row?.sender_id || '')
            if (_senderId && _senderId === uid) {
              // 본인이 보낸 메시지면 알림음 안 냄
            } else {
              try {
                const _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
                const _s = notifSoundRef.current
                if (_s === 'violet') {
                  ;[523, 659, 784, 1047].forEach((freq, i) => {
                    const o = _ac.createOscillator(),
                      g = _ac.createGain()
                    o.connect(g)
                    g.connect(_ac.destination)
                    o.frequency.value = freq
                    o.type = 'sine'
                    const t = _ac.currentTime + i * 0.15
                    g.gain.setValueAtTime(0, t)
                    g.gain.linearRampToValueAtTime(0.3, t + 0.05)
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
                    o.start(t)
                    o.stop(t + 0.6)
                  })
                } else if (_s === 'toast') {
                  const o = _ac.createOscillator(),
                    g = _ac.createGain()
                  o.connect(g)
                  g.connect(_ac.destination)
                  o.frequency.setValueAtTime(800, _ac.currentTime)
                  o.frequency.exponentialRampToValueAtTime(1200, _ac.currentTime + 0.1)
                  o.type = 'sine'
                  g.gain.setValueAtTime(0.4, _ac.currentTime)
                  g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + 0.3)
                  o.start(_ac.currentTime)
                  o.stop(_ac.currentTime + 0.3)
                } else if (_s === 'luxury') {
                  ;[440, 554, 659].forEach((freq, i) => {
                    const o = _ac.createOscillator(),
                      g = _ac.createGain()
                    o.connect(g)
                    g.connect(_ac.destination)
                    o.frequency.value = freq
                    o.type = 'triangle'
                    const t = _ac.currentTime + i * 0.08
                    g.gain.setValueAtTime(0, t)
                    g.gain.linearRampToValueAtTime(0.25, t + 0.02)
                    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
                    o.start(t)
                    o.stop(t + 1.2)
                  })
                } else if (_s === 'magic') {
                  ;[1047, 1319, 1568, 2093, 1568, 1319].forEach((freq, i) => {
                    const o = _ac.createOscillator(),
                      g = _ac.createGain()
                    o.connect(g)
                    g.connect(_ac.destination)
                    o.frequency.value = freq
                    o.type = 'sine'
                    const t = _ac.currentTime + i * 0.1
                    g.gain.setValueAtTime(0, t)
                    g.gain.linearRampToValueAtTime(0.2, t + 0.03)
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
                    o.start(t)
                    o.stop(t + 0.25)
                  })
                } else {
                  const o = _ac.createOscillator(),
                    g = _ac.createGain()
                  o.connect(g)
                  g.connect(_ac.destination)
                  o.frequency.setValueAtTime(392, _ac.currentTime)
                  o.frequency.linearRampToValueAtTime(523, _ac.currentTime + 0.3)
                  o.type = 'sine'
                  g.gain.setValueAtTime(0, _ac.currentTime)
                  g.gain.linearRampToValueAtTime(0.15, _ac.currentTime + 0.1)
                  g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + 1.5)
                  o.start(_ac.currentTime)
                  o.stop(_ac.currentTime + 1.5)
                }
              } catch {}
            }
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
  }, [channelId])

  const sendText = async () => {
    const text = draft.trim()
    if (!text || !internalUserId || !channelId || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: internalUserId,
        message: text,
        is_from_customer: true,
        message_kind: 'text',
      } as any)
      if (!error) {
        supabase.from('chat_channels').update({
          last_message_at: new Date().toISOString(),
          preview_text: draft.trim(),
        }).eq('id', channelId)
        setDraft('')
      }
    } finally {
      setSending(false)
    }
  }

  const sendQuickText = async (text: string) => {
    if (!text || !internalUserId || !channelId || sending) return
    setSending(true)
    try {
      await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: internalUserId,
        message: text,
        is_from_customer: true,
        message_kind: 'text',
      } as any)
      supabase.from('chat_channels').update({
        last_message_at: new Date().toISOString(),
        preview_text: text,
      }).eq('id', channelId)
    } finally {
      setSending(false)
    }
  }

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !internalUserId || !channelId || sending) return
    setSending(true)
    try {
      const compressed = await compressImage(file, 'community')
      const path = `consultation-chat/${internalUserId}/${channelId}/${Date.now()}_${compressed.name.replace(/[^\w.-]+/g, '_')}`
      const { error: upErr } = await supabase.storage.from('community').upload(path, compressed, { upsert: true })
      if (upErr) return
      const { data: pub } = supabase.storage.from('community').getPublicUrl(path)
      const url = pub?.publicUrl
      if (!url) return
      await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: internalUserId,
        message: null,
        image_url: url,
        is_from_customer: true,
        message_kind: 'image',
      } as any)
      supabase.from('chat_channels').update({
        last_message_at: new Date().toISOString(),
        preview_text: '이미지',
      }).eq('id', channelId)
    } finally {
      setSending(false)
    }
  }

  const addRecommendItemsToCart = async (items: RecommendItem[]) => {
    if (!items.length) return
    if (!internalUserId) {
      router.push('/login?redirect=' + encodeURIComponent('/dashboard/customer/chat/' + channelId))
      return
    }
    for (const it of items) {
      if (!it.id) continue
      const { error } = await supabase
        .from('cart_items')
        .insert({ user_id: internalUserId, product_id: it.id, quantity: 1 } as any)
      if (
        error &&
        !String(error.message || '').toLowerCase().includes('duplicate') &&
        String((error as { code?: string }).code || '') !== '23505'
      ) {
        console.warn('[chat recommend cart]', error)
      }
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TEXT_MUTED, padding: 24, fontSize: 13 }}>
        불러오는 중…
      </div>
    )
  }

  if (forbidden) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: '#fff', padding: 24, fontSize: 13 }}>
        <p style={{ marginBottom: 16 }}>채팅방을 열 수 없어요</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard/customer/chat')}
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
          목록으로
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', overflow: 'hidden', background: BG, color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
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
            onClick={() => router.push('/dashboard/customer/chat')}
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div
            onClick={() => setDrawerOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              borderRadius: 20,
              background: 'rgba(201,169,110,0.1)',
              border: '1px solid rgba(201,169,110,0.2)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 14 }}>🍞</span>
            <span style={{ fontSize: 11, color: '#C9A96E' }}>{toastBalance.toLocaleString()}T</span>
            {userCoupons.length > 0 && (
              <span
                style={{
                  background: 'rgba(123,94,167,0.2)',
                  color: '#9B7EC8',
                  fontSize: 9,
                  padding: '1px 5px',
                  borderRadius: 10,
                }}
              >
                {userCoupons.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setSlideOpen((v) => !v)}
            style={{
              fontSize: 11,
              color: '#C084FC',
              background: slideOpen ? 'rgba(123,94,167,0.35)' : 'rgba(123,94,167,0.15)',
              border: 'none',
              borderRadius: 12,
              padding: '4px 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            내 정보
          </button>
        </div>
      </div>

      {showCycleBanner ? (
        <div
          style={{
            flexShrink: 0,
            padding: '10px 14px',
            background: 'rgba(123,94,167,0.12)',
            borderBottom: '1px solid rgba(123,94,167,0.35)',
            fontSize: 12,
            color: '#e8dff5',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span>생리 시작일을 입력하면 맞춤 상담을 받을 수 있어요 💜</span>
          <button
            type="button"
            onClick={() => setCycleModalOpen(true)}
            style={{
              flexShrink: 0,
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              background: PURPLE,
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            입력하기
          </button>
        </div>
      ) : null}

      {!voiceOpen ? (
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          aria-label="고객목소리"
          style={{
            position: 'fixed',
            top: 70,
            right: 16,
            zIndex: 30,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(123,94,167,0.2)',
            border: '1px solid rgba(123,94,167,0.45)',
            color: '#C084FC',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          💜
        </button>
      ) : null}
      {voiceOpen ? (
        <div
          style={{
            position: 'fixed',
            top: 118,
            right: 16,
            zIndex: 31,
            width: 280,
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
            padding: '18px 16px',
          }}
        >
          {voiceDone ? (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 13, color: '#7B5EA7' }}>
              맑원장이 확인할게요 💜
            </div>
          ) : !voiceType ? (
            <>
              <div style={{ fontSize: 13, color: '#333', marginBottom: 12 }}>오랜에게 말하기</div>
              {[
                { key: 'bug', label: '🐛 뭔가 안 돼요' },
                { key: 'idea', label: '💡 이런 기능 있으면 좋겠어요' },
                { key: 'praise', label: '💜 칭찬할게요' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setVoiceType(item.key as 'bug' | 'idea' | 'praise')}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    marginBottom: 6,
                    borderRadius: 10,
                    border: '1px solid rgba(123,94,167,0.2)',
                    background: 'rgba(123,94,167,0.04)',
                    fontSize: 13,
                    color: '#444',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setVoiceOpen(false)}
                style={{ fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}
              >
                닫기
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#7B5EA7', marginBottom: 8 }}>
                {voiceType === 'bug' ? '🐛 어떤 문제가 있었나요?' : voiceType === 'idea' ? '💡 어떤 기능이 있으면 좋을까요?' : '💜 칭찬해주세요!'}
              </div>
              <textarea
                value={voiceContent}
                onChange={(e) => setVoiceContent(e.target.value)}
                placeholder="자유롭게 적어주세요"
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(123,94,167,0.3)',
                  fontSize: 12,
                  color: '#111',
                  fontFamily: 'inherit',
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setVoiceType(null)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #eee', fontSize: 12, cursor: 'pointer', background: '#fff' }}
                >
                  이전
                </button>
                <button
                  type="button"
                  disabled={voiceSending || !voiceContent.trim()}
                  onClick={() => {
                    void (async () => {
                      if (!voiceType || !voiceContent.trim() || voiceSending) return
                      setVoiceSending(true)
                      try {
                        const { data: { user } } = await supabase.auth.getUser()
                        await supabase.from('voice_box').insert({
                          user_id: user?.id || null,
                          type: voiceType,
                          content: voiceContent.trim(),
                          page_url: window.location.pathname,
                        } as any)
                        setVoiceDone(true)
                        setTimeout(() => {
                          setVoiceOpen(false)
                          setVoiceDone(false)
                          setVoiceType(null)
                          setVoiceContent('')
                        }, 1500)
                      } finally {
                        setVoiceSending(false)
                      }
                    })()
                  }}
                  style={{
                    flex: 2,
                    padding: '8px 0',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 12,
                    cursor: 'pointer',
                    background: '#7B5EA7',
                    color: '#fff',
                    opacity: voiceSending || !voiceContent.trim() ? 0.5 : 1,
                  }}
                >
                  {voiceSending ? '전송 중...' : '전송'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '80px 16px 160px', paddingBottom: chatBanner ? 220 : 100 }}>
        {routineCards.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 8 }}>루틴 알림장</div>
            {routineCards.map((c) => (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${PURPLE}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  marginBottom: 8,
                  background: 'rgba(123,94,167,0.06)',
                }}
              >
                <div style={{ fontSize: 13, color: '#fff', marginBottom: 6 }}>{c.title || '루틴'}</div>
                <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>{c.steps || c.memo || ''}</div>
              </div>
            ))}
          </div>
        ) : null}

        {messages.map((m, index) => {
          const mine = Boolean(m.is_from_customer)
          const prevMsg = messages[index - 1]
          const showProfile = !mine && (!prevMsg || Boolean(prevMsg.is_from_customer))
          const isCoupon = m.message_kind === 'coupon' || m.message_kind === 'coupon_gift'
          const isImage = m.message_kind === 'image' && m.image_url
          const kstDate = new Date(new Date(m.created_at).getTime() + 9 * 60 * 60 * 1000)
          const kstYear = kstDate.getUTCFullYear()
          const kstMonth = kstDate.getUTCMonth() + 1
          const kstDay = kstDate.getUTCDate()
          const kstWeek = ['일', '월', '화', '수', '목', '금', '토'][kstDate.getUTCDay()]
          const kstDayKey = Date.UTC(kstYear, kstMonth - 1, kstDay)
          const prevKstDate = prevMsg ? new Date(new Date(prevMsg.created_at).getTime() + 9 * 60 * 60 * 1000) : null
          const prevKstDayKey = prevKstDate
            ? Date.UTC(prevKstDate.getUTCFullYear(), prevKstDate.getUTCMonth(), prevKstDate.getUTCDate())
            : null
          const showDateDivider = prevKstDayKey !== kstDayKey
          const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
          const nowKstDayKey = Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate())
          const dayDiff = Math.floor((nowKstDayKey - kstDayKey) / (24 * 60 * 60 * 1000))
          const dateText = dayDiff === 0
            ? `오늘 · ${kstYear}년 ${kstMonth}월 ${kstDay}일 ${kstWeek}요일`
            : dayDiff === 1
              ? `어제 · ${kstYear}년 ${kstMonth}월 ${kstDay}일 ${kstWeek}요일`
              : `${kstYear}년 ${kstMonth}월 ${kstDay}일 ${kstWeek}요일`
          const hour24 = kstDate.getUTCHours()
          const minute = String(kstDate.getUTCMinutes()).padStart(2, '0')
          const timeText = `${hour24 >= 12 ? '오후' : '오전'} ${hour24 % 12 || 12}:${minute}`
          const ownerTimeNode = (
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginTop: '3px', display: 'block' }}>
              {timeText}
            </span>
          )
          const mineTimeNode = (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '3px' }}>
              {(m as any).is_read === true ? <span style={{ fontSize: '9px', color: '#C9A96E' }}>읽음</span> : null}
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>{timeText}</span>
            </div>
          )
          const dateDividerNode = showDateDivider ? (
            <div key={`d-${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0 8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', fontFamily: 'var(--font-cormorant)', letterSpacing: '0.03em', whiteSpace: 'nowrap', padding: '0 4px' }}>
                {dateText}
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
            </div>
          ) : null

          if (m.message_kind === 'routine_card') {
            return [
              dateDividerNode,
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                {showProfile ? (
                  ownerInfo?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ownerInfo.avatar_url}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#7B5EA7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: '#fff',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {(ownerInfo?.username ?? '원').slice(0, 1)}
                    </div>
                  )
                ) : (
                  <div style={{ width: 40, flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '85%' }}>
                  {showProfile ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{ownerInfo?.username ?? '원장님'}</span>
                  ) : null}
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid rgba(123,94,167,0.55)',
                      padding: '10px 14px',
                      background: 'rgba(123,94,167,0.08)',
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#e8dff5', marginBottom: 6 }}>💜 루틴 알림장</div>
                    <div
                      style={{
                        fontSize: 13,
                        color: '#f3e9ff',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6,
                        wordBreak: 'break-word',
                      }}
                    >
                      {msgText(m)}
                    </div>
                    {mine ? mineTimeNode : ownerTimeNode}
                  </div>
                </div>
              </div>,
            ]
          }

          if (m.message_kind === 'toast_gift') {
            return [
              dateDividerNode,
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                  width: '100%',
                }}
              >
                <div
                  style={{
                    maxWidth: 320,
                    width: '100%',
                    textAlign: 'center',
                    borderRadius: 16,
                    border: `2px solid ${GOLD}`,
                    padding: '18px 16px',
                    background: 'rgba(123,94,167,0.42)',
                    animation: 'fadeOut 0.8s ease 2.2s forwards',
                  }}
                >
                  <div style={{ fontSize: 24, lineHeight: 1.2 }}>🍓</div>
                  <div style={{ fontSize: 24, lineHeight: 1.2, marginTop: 2 }}>🍞</div>
                  <div
                    style={{
                      fontSize: 14,
                      color: '#f5e6c8',
                      marginTop: 12,
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msgText(m)}
                  </div>
                </div>
                {mine ? mineTimeNode : ownerTimeNode}
              </div>,
            ]
          }

          if (m.message_kind === 'card_request') {
            let card: {
              card_type?: string
              title?: string
              desc?: string
              chips?: string[]
              selected_chips?: string[]
              text_content?: string
              has_text?: boolean
            } = {}
            try {
              card = JSON.parse(String(m.message ?? ''))
            } catch {
              card = {}
            }
            const isSos = card.card_type === 'sos'
            const libRow = CARD_LIB.find((c) => c.card_type === card.card_type)
            const ownerCardLabels: Record<string, string> = {
              hormone: '🌙 호르몬 주기',
              skin: '✨ 피부 상태 체크',
              routine_check: '📋 루틴 점검',
              feedback: '⭐ 제품 피드백',
              stress: '🧘 스트레스 체크',
              custom: '✏️ 커스텀 카드',
            }
            const cardEmojiTitle = libRow
              ? libRow.title
              : card.card_type && ownerCardLabels[card.card_type]
                ? `${ownerCardLabels[card.card_type]} · ${card.title || '카드'}`
                : card.title || '카드'
            const selectedChips = Array.isArray(card.selected_chips) ? card.selected_chips : []
            const textContent = String(card.text_content ?? '').trim()
            const chipList = Array.isArray(card.chips) ? card.chips : []
            const localPicks = inlineCardPicks[m.id] || []
            const localText = inlineCardText[m.id] || ''
            const localSent = !!inlineCardSent[m.id]
            const cardBubble = mine ? (
              <div>
                <div
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isSos ? 'rgba(163,45,45,0.45)' : 'rgba(254,229,0,0.45)'}`,
                    padding: '12px 14px',
                    background: isSos ? 'rgba(252,235,235,0.08)' : 'rgba(254,229,0,0.08)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 8 }}>{cardEmojiTitle}</div>
                  {selectedChips.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {selectedChips.map((c) => (
                        <span
                          key={c}
                          style={{
                            borderRadius: 999,
                            border: `1px solid ${isSos ? 'rgba(163,45,45,0.35)' : 'rgba(254,229,0,0.35)'}`,
                            background: isSos ? 'rgba(252,235,235,0.15)' : 'rgba(254,229,0,0.15)',
                            color: isSos ? '#FCEBEB' : '#FEE500',
                            fontSize: 11,
                            padding: '6px 10px',
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {textContent ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#fff',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {textContent}
                    </div>
                  ) : null}
                </div>
                {mineTimeNode}
              </div>
            ) : (
              <div>
                <div
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isSos ? 'rgba(163,45,45,0.45)' : 'rgba(254,229,0,0.45)'}`,
                    padding: '12px 14px',
                    background: isSos ? 'rgba(252,235,235,0.08)' : 'rgba(254,229,0,0.08)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{cardEmojiTitle}</div>
                  {card.desc ? (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>{card.desc}</div>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {chipList.map((c) => {
                      const on = localPicks.includes(c)
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={localSent || sending}
                          onClick={() => {
                            if (localSent || sending) return
                            setInlineCardPicks((prev) => {
                              const cur = prev[m.id] || []
                              return {
                                ...prev,
                                [m.id]: on ? cur.filter((x) => x !== c) : [...cur, c],
                              }
                            })
                          }}
                          style={{
                            borderRadius: 999,
                            border: on ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.15)',
                            background: on ? 'rgba(123,94,167,0.15)' : 'transparent',
                            color: on ? '#e8dff5' : 'rgba(255,255,255,0.4)',
                            fontSize: 11,
                            padding: '6px 10px',
                            cursor: localSent || sending ? 'default' : 'pointer',
                          }}
                        >
                          {c}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    value={localText}
                    disabled={localSent || sending}
                    onChange={(e) => setInlineCardText((prev) => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder="하고 싶은 말을 자유롭게 적어주세요 (선택사항)"
                    rows={3}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      minHeight: 60,
                      marginBottom: 10,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      fontSize: 12,
                      padding: '10px 12px',
                      resize: 'vertical',
                    }}
                  />
                  <button
                    type="button"
                    disabled={sending || localSent || localPicks.length === 0}
                    onClick={() => {
                      void (async () => {
                        if (inlineCardSent[m.id]) return
                        if (!internalUserId || !channelId || sending || localPicks.length === 0) return
                        setSending(true)
                        try {
                          await supabase.from('consultation_messages').insert({
                            channel_id: channelId,
                            sender_id: internalUserId,
                            is_from_customer: true,
                            message_kind: 'card_request',
                            message: JSON.stringify({
                              card_type: card.card_type,
                              title: card.title,
                              chips: card.chips,
                              selected_chips: inlineCardPicks[m.id] || [],
                              text_content: inlineCardText[m.id] || '',
                              has_text: true,
                            }),
                          } as any)
                          setInlineCardSent((prev) => ({ ...prev, [m.id]: true }))
                        } finally {
                          setSending(false)
                        }
                      })()
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      borderRadius: 8,
                      border: 'none',
                      background: '#FEE500',
                      color: '#3A1D1D',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: sending || localSent || localPicks.length === 0 ? 'default' : 'pointer',
                      opacity: sending || localSent || localPicks.length === 0 ? 0.5 : 1,
                    }}
                  >
                    전송
                  </button>
                </div>
                {ownerTimeNode}
              </div>
            )
            if (mine) {
              return [
                dateDividerNode,
                <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <div style={{ maxWidth: '88%' }}>{cardBubble}</div>
                </div>,
              ]
            }
            return [
              dateDividerNode,
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                {showProfile ? (
                  ownerInfo?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ownerInfo.avatar_url}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#7B5EA7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: '#fff',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {(ownerInfo?.username ?? '원').slice(0, 1)}
                    </div>
                  )
                ) : (
                  <div style={{ width: 40, flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '88%' }}>
                  {showProfile ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{ownerInfo?.username ?? '원장님'}</span>
                  ) : null}
                  {cardBubble}
                </div>
              </div>,
            ]
          }

          if (m.message_kind === 'product_recommend') {
            const productItems = parseRecommendItems(m)
            const productBubble = (
                <div>
                  <div
                    style={{
                      borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: 8,
                      background: mine ? 'rgba(123,94,167,0.45)' : 'rgba(201,169,110,0.15)',
                      border: mine ? 'none' : '1px solid rgba(201,169,110,0.3)',
                    }}
                  >
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
                      🧴 원장님 추천 제품
                    </div>
                    {productItems.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 12, color: TEXT_MUTED }}>표시할 제품이 없어요</div>
                    ) : (
                      productItems.map((it, idx) => (
                        <div
                          key={it.id || String(idx)}
                          role="button"
                          tabIndex={0}
                          onClick={() => it.id && router.push('/products/' + it.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              if (it.id) router.push('/products/' + it.id)
                            }
                          }}
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            padding: '10px',
                            borderBottom:
                              idx < productItems.length - 1 ? '1px solid rgba(123,94,167,0.2)' : undefined,
                            cursor: it.id ? 'pointer' : 'default',
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
                                background: 'rgba(123,94,167,0.35)',
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
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        padding: '8px',
                        borderTop: '1px solid rgba(123,94,167,0.25)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void addRecommendItemsToCart(productItems)
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${PURPLE}`,
                          background: 'rgba(123,94,167,0.2)',
                          color: '#e8dff5',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        담기
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void (async () => {
                            if (!internalUserId) {
                              router.push('/login?redirect=' + encodeURIComponent('/dashboard/customer/chat/' + channelId))
                              return
                            }
                            for (const it of productItems) {
                              if (!it.id) continue
                              await supabase.from('cart_items').insert({
                                user_id: internalUserId,
                                product_id: it.id,
                                quantity: 1,
                                gift_to: internalUserId,
                              } as any)
                            }
                            router.push('/cart')
                          })()
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${GOLD}`,
                          background: 'rgba(201,169,110,0.12)',
                          color: '#f5e6c8',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        선물
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/products/${productItems[0]?.id ?? ''}`)
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${PURPLE}`,
                          background: 'rgba(123,94,167,0.2)',
                          color: '#e8dff5',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        구매
                      </button>
                    </div>
                  </div>
                  {mine ? mineTimeNode : ownerTimeNode}
                </div>
            )
            if (mine) {
              return [
                dateDividerNode,
                <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <div style={{ maxWidth: '85%' }}>{productBubble}</div>
                </div>,
              ]
            }
            return [
              dateDividerNode,
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                {showProfile ? (
                  ownerInfo?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ownerInfo.avatar_url}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#7B5EA7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: '#fff',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {(ownerInfo?.username ?? '원').slice(0, 1)}
                    </div>
                  )
                ) : (
                  <div style={{ width: 40, flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '85%' }}>
                  {showProfile ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{ownerInfo?.username ?? '원장님'}</span>
                  ) : null}
                  {productBubble}
                </div>
              </div>,
            ]
          }

          if (m.message_kind === 'order_paid') {
            return [
              dateDividerNode,
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                <div style={{ background: '#EEEDFE', borderRadius: 12, padding: '12px 16px', maxWidth: '80%', textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: '#3C3489', fontWeight: 500 }}>💜 주문이 확인됐어요</div>
                  <div style={{ fontSize: 12, color: '#534AB7', marginTop: 4 }}>
                    {m.content || '결제가 완료됐어요'}
                  </div>
                </div>
                {mine ? mineTimeNode : ownerTimeNode}
                <div
                  style={{ fontSize: 12, color: '#7B5EA7', border: '0.5px solid #AFA9EC', borderRadius: 8, padding: '5px 14px', cursor: 'pointer' }}
                  onClick={() => router.push('/my/orders')}
                >
                  주문 상세보기 →
                </div>
              </div>,
            ]
          }

          if (isCoupon) {
            if (m.message_kind === 'coupon_gift') {
              let cp: Record<string, unknown> = {}
              try {
                cp = JSON.parse(m.message ?? '')
              } catch {}
              const isShip = !!cp.user_coupon_id
              const couponGiftBubble = (
                  <div>
                    <div
                      style={{
                        background: 'rgba(123,94,167,0.15)',
                        border: '1px solid rgba(123,94,167,0.4)',
                        borderRadius: 12,
                        padding: '12px 14px 16px',
                        minWidth: 160,
                      }}
                    >
                    <div style={{ fontSize: 11, color: '#C084FC', marginBottom: 4 }}>🎁 쿠폰 도착</div>
                    <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
                      {isShip ? '배송비 무료' : String(cp.name ?? '')}
                    </div>
                    {!isShip && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                        {cp.discount_type === 'percent'
                          ? `${cp.discount_value}% 할인`
                          : `${Number(cp.discount_value).toLocaleString()}원 할인`}
                        {cp.min_order_amount ? ` · ${Number(cp.min_order_amount).toLocaleString()}원 이상` : ''}
                      </div>
                    )}
                    {Boolean(cp.expires_at) ? (
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                        ~ {new Date(String(cp.expires_at)).toLocaleDateString('ko-KR')} 까지
                      </div>
                    ) : null}
                    </div>
                    {ownerTimeNode}
                  </div>
              )
              return [
                dateDividerNode,
                <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  {showProfile ? (
                    ownerInfo?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ownerInfo.avatar_url}
                        alt=""
                        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: '#7B5EA7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          color: '#fff',
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {(ownerInfo?.username ?? '원').slice(0, 1)}
                      </div>
                    )
                  ) : (
                    <div style={{ width: 40, flexShrink: 0 }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '85%' }}>
                    {showProfile ? (
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{ownerInfo?.username ?? '원장님'}</span>
                    ) : null}
                    {couponGiftBubble}
                  </div>
                </div>,
              ]
            }
            const couponBubble = (
                <div>
                  <div
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${GOLD}`,
                      padding: '10px 12px',
                      background: 'rgba(201,169,110,0.08)',
                    }}
                  >
                    <div style={{ fontSize: 12, color: GOLD, marginBottom: 4 }}>쿠폰</div>
                    <div style={{ fontSize: 13, color: '#fff' }}>{m.coupon_title || msgText(m) || '쿠폰이 도착했어요'}</div>
                    {m.coupon_subtitle ? (
                      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>{m.coupon_subtitle}</div>
                    ) : null}
                  </div>
                  {mine ? mineTimeNode : ownerTimeNode}
                </div>
            )
            if (mine) {
              return [
                dateDividerNode,
                <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <div style={{ maxWidth: '85%' }}>{couponBubble}</div>
                </div>,
              ]
            }
            return [
              dateDividerNode,
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                {showProfile ? (
                  ownerInfo?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ownerInfo.avatar_url}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#7B5EA7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: '#fff',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {(ownerInfo?.username ?? '원').slice(0, 1)}
                    </div>
                  )
                ) : (
                  <div style={{ width: 40, flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '85%' }}>
                  {showProfile ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{ownerInfo?.username ?? '원장님'}</span>
                  ) : null}
                  {couponBubble}
                </div>
              </div>,
            ]
          }

          const defaultBubble = (
              <div>
                <div
                  style={{
                    borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    padding: '10px 12px',
                    background: mine ? 'rgba(123,94,167,0.45)' : 'rgba(201,169,110,0.15)',
                    border: mine ? 'none' : '1px solid rgba(201,169,110,0.3)',
                  }}
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image_url!} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
                  ) : (
                    <div style={{ fontSize: 13, color: mine ? '#f3e9ff' : '#f5e6c8', lineHeight: 1.5 }}>{msgText(m)}</div>
                  )}
                </div>
                {mine ? mineTimeNode : ownerTimeNode}
              </div>
          )
          if (mine) {
            return [
              dateDividerNode,
              <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <div style={{ maxWidth: '85%' }}>{defaultBubble}</div>
              </div>,
            ]
          }
          return [
            dateDividerNode,
            <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              {showProfile ? (
                ownerInfo?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ownerInfo.avatar_url}
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: '#7B5EA7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      color: '#fff',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {(ownerInfo?.username ?? '원').slice(0, 1)}
                  </div>
                )
              ) : (
                <div style={{ width: 40, flexShrink: 0 }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, maxWidth: '85%' }}>
                {showProfile ? (
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{ownerInfo?.username ?? '원장님'}</span>
                ) : null}
                {defaultBubble}
              </div>
            </div>,
          ]
        })}
      </div>

      {cycleModalOpen ? (
        <div
          onClick={() => setCycleModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 45 }}
        />
      ) : null}
      {cycleModalOpen ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#16162a',
            borderRadius: 16,
            padding: '18px 16px 20px',
            zIndex: 46,
            width: '88%',
            maxWidth: 340,
            border: `1px solid ${PURPLE}55`,
          }}
        >
          <div style={{ fontSize: 14, color: '#fff', marginBottom: 12, fontWeight: 600 }}>마지막 생리 시작일</div>
          <input
            type="date"
            value={cycleDateInput}
            onChange={(e) => setCycleDateInput(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              fontSize: 13,
              marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCycleModalOpen(false)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: TEXT_MUTED,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!cycleDateInput || cycleSaving || !customerAuthId}
              onClick={() => {
                void (async () => {
                  if (!cycleDateInput || cycleSaving || !customerAuthId) return
                  setCycleSaving(true)
                  try {
                    const s = new Date(cycleDateInput)
                    if (Number.isNaN(s.getTime())) return
                    const now = new Date()
                    const diff = Math.floor(
                      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
                        new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime()) /
                        86400000
                    )
                    const len = 28
                    const d = ((diff % len) + len) % len
                    const cycleDay = d + 1
                    let hormone_stage = 'luteal'
                    if (cycleDay >= 1 && cycleDay <= 5) hormone_stage = 'menstrual'
                    else if (cycleDay <= 13) hormone_stage = 'follicular'
                    else if (cycleDay <= 16) hormone_stage = 'ovulation'
                    const todayIso = new Date().toISOString().slice(0, 10)
                    const { error } = await supabase.from('skin_cycle_analysis').insert({
                      auth_id: customerAuthId,
                      record_date: cycleDateInput,
                      analysis_date: todayIso,
                      cycle_day: cycleDay,
                      hormone_stage,
                      checkin_condition: '',
                      recommended_products: [],
                      updated_at: new Date().toISOString(),
                    } as any)
                    if (error) return
                    const phaseMap: Record<string, string> = {
                      menstrual: '달빛기',
                      follicular: '황금기',
                      ovulation: '만개기',
                      luteal: '물들기',
                    }
                    setProfileInfo((prev) =>
                      prev
                        ? { ...prev, hormone_phase: hormone_stage, hormone_label: phaseMap[hormone_stage] ?? hormone_stage }
                        : prev
                    )
                    setShowCycleBanner(false)
                    setCycleModalOpen(false)
                  } finally {
                    setCycleSaving(false)
                  }
                })()
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: PURPLE,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: !cycleDateInput || cycleSaving ? 'default' : 'pointer',
                opacity: !cycleDateInput || cycleSaving ? 0.5 : 1,
              }}
            >
              {cycleSaving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      ) : null}

      {cardModal !== null ? (
        <div
          onClick={() => setCardModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 55 }}
        />
      ) : null}
      {cardModal !== null ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 56,
            background: '#16162a',
            borderRadius: '16px 16px 0 0',
            padding: '16px 16px 32px',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setCardModal(null)}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, marginBottom: 4 }}>{cardModal.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>항목을 선택한 뒤 전송해주세요</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {cardModal.chips.map((c) => {
              const on = cardModalPicks.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setCardModalPicks((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))
                  }}
                  style={{
                    borderRadius: 999,
                    border: on ? '1px solid #FEE500' : '1px solid rgba(255,255,255,0.15)',
                    background: on ? 'rgba(254,229,0,0.15)' : 'transparent',
                    color: on ? '#FEE500' : 'rgba(255,255,255,0.5)',
                    fontSize: 11,
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              )
            })}
          </div>
          <textarea
            value={cardModalText}
            onChange={(e) => setCardModalText(e.target.value)}
            placeholder="추가로 전하고 싶은 말이 있으면 적어주세요 (선택사항)"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 60,
              marginBottom: 12,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#fff',
              fontSize: 12,
              padding: '10px 12px',
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            disabled={sending || cardModalPicks.length === 0}
            onClick={() => {
              void (async () => {
                if (!internalUserId || !channelId || sending || !cardModal) return
                if (cardModalPicks.length === 0) return
                setSending(true)
                try {
                  await supabase.from('consultation_messages').insert({
                    channel_id: channelId,
                    sender_id: internalUserId,
                    is_from_customer: true,
                    message_kind: 'card_request',
                    message: JSON.stringify({
                      card_type: cardModal.card_type,
                      title: cardModal.title,
                      chips: cardModal.chips,
                      selected_chips: cardModalPicks,
                      text_content: cardModalText,
                      has_text: cardModal.has_text,
                    }),
                  } as any)
                  setCardModal(null)
                  setCardModalPicks([])
                  setCardModalText('')
                } finally {
                  setSending(false)
                }
              })()
            }}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              border: 'none',
              background: cardModal.sos ? '#FCEBEB' : '#FEE500',
              color: cardModal.sos ? '#A32D2D' : '#3A1D1D',
              fontSize: 13,
              fontWeight: 600,
              cursor: sending || cardModalPicks.length === 0 ? 'default' : 'pointer',
              opacity: sending || cardModalPicks.length === 0 ? 0.5 : 1,
            }}
          >
            전송
          </button>
        </div>
      ) : null}

      {slideOpen && (
        <div
          onClick={() => setSlideOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: slideOpen ? 'translate(-50%, -50%)' : 'translate(-50%, -40%)',
          opacity: slideOpen ? 1 : 0,
          pointerEvents: slideOpen ? 'auto' : 'none',
          transition: 'transform 0.25s ease, opacity 0.25s ease',
          background: '#16162a',
          borderRadius: 18,
          padding: '18px 16px 20px',
          zIndex: 50,
          width: '88%',
          maxWidth: 360,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#fff' }}>내 정보</span>
          <button
            onClick={() => setSlideOpen(false)}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
        {profileInfo ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              {profileInfo.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profileInfo.avatar_url}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '2px solid rgba(192,132,252,0.3)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#7B5EA7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    color: '#fff',
                    border: '2px solid rgba(192,132,252,0.3)',
                  }}
                >
                  {profileInfo.username.slice(0, 1)}
                </div>
              )}
              <div>
                <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{profileInfo.username}님</div>
                <span
                  style={{
                    fontSize: 10,
                    color: '#C084FC',
                    background: 'rgba(192,132,252,0.15)',
                    padding: '2px 7px',
                    borderRadius: 8,
                  }}
                >
                  ✦ {profileInfo.grade}
                </span>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  누적 {profileInfo.total_purchase.toLocaleString()}원
                </div>
              </div>
            </div>
            {(() => {
              const gradeOrder = ['PETAL', 'BLOOM', 'VELVET', 'LUMIÈRE', 'REINE', 'NOIR', 'CÉLESTE']
              const threshold = [0, 300000, 1000000, 3000000, 6000000, 10000000, 20000000]
              const gi = gradeOrder.indexOf(profileInfo.grade)
              const nextG = gi >= 0 && gi < gradeOrder.length - 1 ? gradeOrder[gi + 1] : null
              const curBase = gi >= 0 ? threshold[gi] : 0
              const nextBase =
                gi >= 0 && gi < threshold.length - 1 ? threshold[gi + 1] : threshold[threshold.length - 1]
              const remain = nextG ? Math.max(0, nextBase - profileInfo.total_purchase) : 0
              const prog = nextG
                ? Math.max(
                    0,
                    Math.min(100, ((profileInfo.total_purchase - curBase) / Math.max(1, nextBase - curBase)) * 100)
                  )
                : 100
              return nextG ? (
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>다음 등급 {nextG}</span>
                    <span style={{ fontSize: 10, color: '#C084FC' }}>{remain.toLocaleString()}원 남음</span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${prog}%`, height: '100%', background: '#7B5EA7', borderRadius: 3 }} />
                  </div>
                </div>
              ) : null
            })()}
            {profileInfo.hormone_label && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                  오늘의 피부 — {profileInfo.hormone_label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  {profileInfo.hormone_phase === 'menstrual' && '피지 줄고 피부 얇아지는 시기예요. 보습 집중 케어 타이밍!'}
                  {profileInfo.hormone_phase === 'follicular' && '피부 컨디션 최고조! 영양 집중 케어 하기 좋은 시기예요.'}
                  {profileInfo.hormone_phase === 'ovulation' && '피부 화사하고 탄력 있는 시기예요. 수분 유지가 중요해요.'}
                  {profileInfo.hormone_phase === 'luteal' && '피지 분비 늘고 트러블 주의. 진정 케어에 집중하세요.'}
                </div>
              </div>
            )}
            {recommendedProducts.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>원장님 추천 제품</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recommendedProducts.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => p.product_id && router.push('/products/' + p.product_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        cursor: p.product_id ? 'pointer' : 'default',
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          background: 'rgba(123,94,167,0.2)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                        }}
                      >
                        🧴
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.8)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.product_name}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                          {new Date(p.created_at).toLocaleDateString('ko-KR')} 추천
                        </div>
                      </div>
                      {p.product_id && <span style={{ fontSize: 10, color: '#C084FC', flexShrink: 0 }}>보기 →</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>로딩중...</div>
        )}
      </div>

      {/* 토스트 드로어 */}
      {drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
          />
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#1a1625',
              borderRadius: '20px 20px 0 0',
              padding: '16px 16px 80px',
              zIndex: 50,
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ width: 32, height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
              <div
                onClick={() => setDrawerOpen(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                }}
              >
                ×
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {(['toast', 'coupon', 'history', 'orders'] as const).map((t) => (
                <div
                  key={t}
                  onClick={() => setDrawerTab(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 20,
                    fontSize: 10,
                    cursor: 'pointer',
                    background: drawerTab === t ? '#7B5EA7' : 'rgba(255,255,255,0.05)',
                    color: drawerTab === t ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {t === 'toast' ? '🍞 토스트' : t === 'coupon' ? '🎟 쿠폰' : t === 'orders' ? '🛒 구매' : '📊 내역'}
                </div>
              ))}
            </div>
            {drawerTab === 'toast' && (
              <div
                style={{
                  background: 'linear-gradient(135deg,rgba(201,169,110,0.15),rgba(123,94,167,0.1))',
                  border: '1px solid rgba(201,169,110,0.25)',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: 'rgba(201,169,110,0.6)',
                    fontFamily: 'monospace',
                    marginBottom: 4,
                  }}
                >
                  내 토스트 잔액
                </div>
                <div style={{ fontSize: 32, color: '#C9A96E' }}>
                  {toastBalance.toLocaleString()}
                  <span style={{ fontSize: 13, marginLeft: 4 }}>T</span>
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  = ₩{(toastBalance * 100).toLocaleString()}
                </div>
              </div>
            )}
            {drawerTab === 'coupon' && (
              <div>
                {userCoupons.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 16 }}>
                    보유 쿠폰 없음
                  </div>
                ) : (
                  userCoupons.map((uc) => (
                    <div
                      key={uc.id}
                      style={{
                        background: 'rgba(123,94,167,0.1)',
                        border: '1px solid rgba(123,94,167,0.2)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#9B7EC8' }}>{uc.coupons?.name || '쿠폰'}</div>
                      <div style={{ fontSize: 14, color: '#fff', marginTop: 2 }}>
                        {uc.coupons?.discount_rate || uc.coupons?.discount_value}% 할인
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                        {uc.expired_at ? `~ ${uc.expired_at.slice(0, 10)}` : '만료일 없음'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {drawerTab === 'history' && (
              <div>
                {toastHistory.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 16 }}>
                    내역 없음
                  </div>
                ) : (
                  toastHistory.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '7px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                        {toastLabel(String(h.transaction_type || ''), String(h.source_type || ''))}
                      </div>
                      <div style={{ fontSize: 11, color: '#C9A96E' }}>+{(h.amount || 0).toLocaleString()}T</div>
                    </div>
                  ))
                )}
              </div>
            )}
            {drawerTab === 'orders' && (
              <div>
                {orderHistory.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 16 }}>
                    구매 내역 없음
                  </div>
                ) : (
                  orderHistory.map((o) => (
                    <div key={o.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{o.order_no}</div>
                        <div style={{ fontSize: 10, color: '#C9A96E' }}>{o.status}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#fff', marginBottom: 2 }}>
                        {(() => {
                          try {
                            const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items
                            return items?.[0]?.product_name || '상품'
                          } catch {
                            return '상품'
                          }
                        })()}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                        ₩{(o.final_amount || 0).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}

      {chatBanner && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)',
            zIndex: 49,
            background: '#0D0B09',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            <span
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.18)',
                letterSpacing: '0.1em',
                fontFamily: 'var(--font-cormorant, serif)',
                textTransform: 'uppercase',
              }}
            >
              이달의 혜택
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
          </div>
          {chatBanner.event_enabled && (
            <div
              onClick={() => chatBanner.link && router.push(chatBanner.link)}
              style={{
                margin: '8px 13px 0',
                height: 62,
                borderRadius: 13,
                background: 'linear-gradient(120deg, #1e0d38 0%, #3b1d68 55%, #5a3490 100%)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                gap: 10,
                position: 'relative',
                overflow: 'hidden',
                cursor: chatBanner.link ? 'pointer' : 'default',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  right: -16,
                  top: -16,
                  width: 70,
                  height: 70,
                  borderRadius: '50%',
                  background: 'rgba(201,169,110,0.1)',
                }}
              />
              {chatBanner.phase_auto && phase && (
                <div
                  style={{
                    background: 'rgba(201,169,110,0.18)',
                    border: '1px solid rgba(201,169,110,0.35)',
                    color: '#C9A96E',
                    fontSize: 9,
                    padding: '2.5px 7px',
                    borderRadius: 20,
                    fontFamily: 'var(--font-cormorant, serif)',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                >
                  {phaseMap[phase] ?? phase}
                </div>
              )}
              <div style={{ flex: 1, zIndex: 1 }}>
                <div style={{ fontSize: 12, color: '#fff', fontWeight: 400, lineHeight: 1.35 }}>{chatBanner.main_text}</div>
                <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: 'var(--font-cormorant, serif)' }}>
                  {chatBanner.sub_text}
                </div>
              </div>
              <div style={{ color: 'rgba(201,169,110,0.55)', fontSize: 15, zIndex: 1 }}>›</div>
            </div>
          )}
          <div style={{ display: 'flex', padding: '8px 13px 4px' }}>
            {chatQuickBtns.skin_report && (
              <div
                onClick={() => router.push('/dashboard/customer/skin-report')}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px 6px', borderRadius: 11, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: 'rgba(123,94,167,0.18)',
                    border: '1px solid rgba(123,94,167,0.28)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                  }}
                >
                  📊
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.3 }}>
                  내 피부
                  <br />
                  리포트
                </div>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>이달 분석</div>
              </div>
            )}
            {chatQuickBtns.owner_pick && (
              <div
                onClick={() => router.push('/dashboard/customer?tab=owner_pick')}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px 6px', borderRadius: 11, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: 'rgba(201,169,110,0.15)',
                    border: '1px solid rgba(201,169,110,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                  }}
                >
                  ✨
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.3 }}>
                  원장 픽
                  <br />
                  이번 달
                </div>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>내 단계 맞춤</div>
              </div>
            )}
            {chatQuickBtns.toast_wallet && (
              <div
                onClick={() => router.push('/dashboard/customer/toast')}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px 6px', borderRadius: 11, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: 'rgba(74,222,128,0.1)',
                    border: '1px solid rgba(74,222,128,0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    position: 'relative',
                  }}
                >
                  🍞
                  {toastBalance > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -3,
                        background: '#7B5EA7',
                        color: '#fff',
                        fontSize: 7,
                        padding: '1.5px 4px',
                        borderRadius: 8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {toastBalance.toLocaleString()}T
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.3 }}>
                  내 토스트
                  <br />
                  쓰기
                </div>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
                  {toastBalance > 0 ? `₩${(toastBalance * 100).toLocaleString()} 보유` : '잔액 없음'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: chatBanner ? 'calc(env(safe-area-inset-bottom) + 190px)' : 'calc(env(safe-area-inset-bottom) + 60px)',
          background: 'linear-gradient(180deg, transparent, #0D0B09 28%)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {showCardLib ? (
          <div
            className="card-lib-scroll"
            style={{
              marginBottom: 8,
              maxHeight: 220,
              overflowY: 'auto',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {CARD_LIB.map((card) => (
                <button
                  key={card.card_type}
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    setCardModal({
                      card_type: card.card_type,
                      title: card.title,
                      chips: [...card.chips],
                      has_text: card.has_text,
                      sos: card.sos,
                    })
                    setCardModalPicks([])
                    setCardModalText('')
                    setShowCardLib(false)
                  }}
                  style={{
                    borderRadius: 10,
                    border: card.sos ? '1px solid rgba(163,45,45,0.35)' : '1px solid rgba(254,229,0,0.35)',
                    background: card.sos ? '#FCEBEB' : '#FEE500',
                    color: card.sos ? '#A32D2D' : '#3A1D1D',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '10px 8px',
                    cursor: sending ? 'default' : 'pointer',
                    textAlign: 'left',
                    lineHeight: 1.4,
                  }}
                >
                  {card.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowCardLib((v) => !v)}
            disabled={sending}
            aria-label="카드함"
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid #FEE500',
              background: showCardLib ? '#FEE500' : 'rgba(254,229,0,0.12)',
              color: showCardLib ? '#3A1D1D' : '#FEE500',
              fontSize: 16,
              cursor: sending ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            🃏
          </button>
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
      <style jsx global>{`
        .card-lib-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
