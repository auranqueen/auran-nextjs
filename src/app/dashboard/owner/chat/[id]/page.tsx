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

type OwnerCouponRow = {
  id: string
  name: string
  discount_type: string
  discount_value: number
  min_order_amount: number | null
  expires_at: string | null
}

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
  const [notifSound, setNotifSound] = useState('violet')
  const notifSoundRef = useRef('violet')
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
  const [couponList, setCouponList] = useState<OwnerCouponRow[]>([])
  const [couponName, setCouponName] = useState('')
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [minOrder, setMinOrder] = useState(0)
  const [validDays, setValidDays] = useState(30)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSkinLog, setShowSkinLog] = useState(false)
  const [historyOrders, setHistoryOrders] = useState<
    {
      id: string
      created_at: string
      final_amount: number | null
      status: string | null
      items?: any
      thumbUrl?: string | null
    }[]
  >([])
  const [productThumbs, setProductThumbs] = useState<Record<string, string>>({})
  const [skinLogs, setSkinLogs] = useState<any[]>([])

  const [isPC, setIsPC] = useState(false)
  const [showGradePopup, setShowGradePopup] = useState(false)
  const [customerGrade, setCustomerGrade] = useState<string>('PETAL')
  const [customerTotalPurchase, setCustomerTotalPurchase] = useState<number>(0)
  const [customerSkinInfo, setCustomerSkinInfo] = useState<{
    skin_type: string | null
    skin_concerns: string[]
    hormone_phase: string | null
    points: number
    is_founder: boolean
    avatar_url: string | null
  } | null>(null)
  const [showHistoryList, setShowHistoryList] = useState(false)
  const [channels, setChannels] = useState<
    { id: string; title: string; preview_text: string; last_message_at: string | null; unread_count: number; user_id?: string | null; customer_name?: string }[]
  >([])
  const [channelsLoading, setChannelsLoading] = useState(true)

  const scrollBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    })
  }, [])

  useEffect(() => {
    scrollBottom()
  }, [messages, scrollBottom])

  useEffect(() => {
    const handleResize = () => setIsPC(window.innerWidth >= 768)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!customerUserId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('orders')
        .select(
          'id,created_at,final_amount,status,items'
        )
        .eq('customer_id', customerUserId)
        .order('created_at', { ascending: false })
        .limit(10)
        .eq('payment_applied', true)
        .eq('payment_status', 'paid')
      if (!cancelled)
        setHistoryOrders(
          (
            (data as {
              id: string
              created_at: string
              final_amount: number | null
              status: string | null
              items?: any
              thumbUrl?: string | null
            }[]) || []
          ).filter((r) => r?.id)
        )
      const productIds = (data || [])
        .flatMap((o: any) => {
          try {
            const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]')
            return items.map((it: any) => it.product_id).filter(Boolean)
          } catch {
            return []
          }
        })
        .filter((id: string, i: number, arr: string[]) => arr.indexOf(id) === i)

      if (productIds.length > 0) {
        const { data: thumbData } = await supabase
          .from('products')
          .select('id, storage_thumb_url, thumb_img')
          .in('id', productIds)
        if (thumbData) {
          const map: Record<string, string> = {}
          thumbData.forEach((p: any) => {
            if (p.storage_thumb_url) map[p.id] = p.storage_thumb_url
            else if (p.thumb_img) map[p.id] = p.thumb_img
          })
          if (!cancelled) setProductThumbs(map)
        }
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable for this effect
  }, [customerUserId])

  useEffect(() => {
    notifSoundRef.current = notifSound
  }, [notifSound])

  useEffect(() => {
    if (!customerUserId) return
    const load = async () => {
      const { data: uRow } = await supabase.from('users').select('auth_id,points,is_founder').eq('id', customerUserId).maybeSingle()
      if (!uRow) return
      const authId = uRow.auth_id
      const [profileRes, cycleRes] = await Promise.all([
        supabase.from('profiles').select('skin_type,skin_concerns,avatar_url,notification_sound').eq('auth_id', authId).maybeSingle(),
        supabase
          .from('skin_cycle_analysis')
          .select('hormone_stage')
          .eq('auth_id', authId)
          .order('analysis_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      const profile = profileRes.data as { notification_sound?: string | null } | null
      if (profile?.notification_sound) {
        setNotifSound(String(profile.notification_sound))
      }
      setCustomerSkinInfo({
        skin_type: (profile as any)?.skin_type ?? null,
        skin_concerns: (profileRes.data as any)?.skin_concerns ?? [],
        hormone_phase: cycleRes.data?.hormone_stage ?? null,
        points: uRow.points ?? 0,
        is_founder: uRow.is_founder ?? false,
        avatar_url: profileRes.data?.avatar_url ?? null,
      })
    }
    void load()
  }, [customerUserId])

  useEffect(() => {
    if (!customerUserId) return
    let cancelled = false
    void (async () => {
      const { data: userData } = await supabase
        .from('users')
        .select('customer_grade')
        .eq('id', customerUserId)
        .maybeSingle()
      if (!cancelled && userData?.customer_grade) {
        setCustomerGrade(userData.customer_grade)
      }
      const { data: orderData } = await supabase
        .from('orders')
        .select('final_amount')
        .eq('customer_id', customerUserId)
        .eq('payment_applied', true)
        .eq('payment_status', 'paid')
      if (!cancelled && orderData) {
        const total = orderData.reduce((sum, o) => sum + (o.final_amount || 0), 0)
        setCustomerTotalPurchase(total)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerUserId])

  useEffect(() => {
    if (!showSkinLog || !customerUserId) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('daily_skin_log')
        .select('id, created_at, sleep_hours, uv_exposure, stress_level, skin_conditions, memo')
        .eq('user_id', customerUserId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (!cancelled) setSkinLogs((data as any[]) || [])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable for this effect
  }, [showSkinLog, customerUserId])

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

      const [{ data: ch, error: chErr }, , { data: msgs }] = await Promise.all([
        supabase.from('chat_channels').select('id,title,owner_memo,user_id').eq('id', channelId).maybeSingle(),
        supabase.from('chat_channels').update({ unread_count: 0 }).eq('id', channelId),
        supabase.from('consultation_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }),
      ])

      if (cancelled) return
      if (chErr || !ch) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setChannelTitle(String(ch.title || '상담'))
      setMemoText(String((ch as { owner_memo?: string | null }).owner_memo ?? ''))
      setCustomerUserId((ch as { user_id?: string | null }).user_id ? String((ch as { user_id: string }).user_id) : null)

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
            try {
              const _ac = new (window.AudioContext || (window as any).webkitAudioContext)()
              const playSound = (sound: string) => {
                if (sound === 'violet') {
                  const notes = [523, 659, 784, 1047]
                  notes.forEach((freq, i) => {
                    const o = _ac.createOscillator(); const g = _ac.createGain()
                    o.connect(g); g.connect(_ac.destination)
                    o.frequency.value = freq; o.type = 'sine'
                    const t = _ac.currentTime + i * 0.15
                    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3, t + 0.05)
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
                    o.start(t); o.stop(t + 0.6)
                  })
                } else if (sound === 'toast') {
                  const o = _ac.createOscillator(); const g = _ac.createGain()
                  o.connect(g); g.connect(_ac.destination)
                  o.frequency.setValueAtTime(800, _ac.currentTime)
                  o.frequency.exponentialRampToValueAtTime(1200, _ac.currentTime + 0.1)
                  o.type = 'sine'
                  g.gain.setValueAtTime(0.4, _ac.currentTime)
                  g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + 0.3)
                  o.start(_ac.currentTime); o.stop(_ac.currentTime + 0.3)
                } else if (sound === 'luxury') {
                  [440, 554, 659].forEach((freq, i) => {
                    const o = _ac.createOscillator(); const g = _ac.createGain()
                    o.connect(g); g.connect(_ac.destination)
                    o.frequency.value = freq; o.type = 'triangle'
                    const t = _ac.currentTime + i * 0.08
                    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.02)
                    g.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
                    o.start(t); o.stop(t + 1.2)
                  })
                } else if (sound === 'magic') {
                  const freqs = [1047, 1319, 1568, 2093, 1568, 1319]
                  freqs.forEach((freq, i) => {
                    const o = _ac.createOscillator(); const g = _ac.createGain()
                    o.connect(g); g.connect(_ac.destination)
                    o.frequency.value = freq; o.type = 'sine'
                    const t = _ac.currentTime + i * 0.1
                    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2, t + 0.03)
                    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
                    o.start(t); o.stop(t + 0.25)
                  })
                } else if (sound === 'aube') {
                  const o = _ac.createOscillator(); const g = _ac.createGain()
                  o.connect(g); g.connect(_ac.destination)
                  o.frequency.setValueAtTime(392, _ac.currentTime)
                  o.frequency.linearRampToValueAtTime(523, _ac.currentTime + 0.3)
                  o.type = 'sine'
                  g.gain.setValueAtTime(0, _ac.currentTime); g.gain.linearRampToValueAtTime(0.15, _ac.currentTime + 0.1)
                  g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + 1.5)
                  o.start(_ac.currentTime); o.stop(_ac.currentTime + 1.5)
                }
              }
              playSound(notifSoundRef.current)
            } catch {}
            setMessages((prev) => {
              if (prev.some((p) => p.id === row.id)) return prev
              return [...prev, row]
            })
            setChannels((prev) => {
              const idx = prev.findIndex((c) => c.id === channelId)
              if (idx < 0) return prev
              const updated = {
                ...prev[idx],
                preview_text: msgText(row) || (row.image_url ? '이미지' : ''),
                last_message_at: row.created_at ?? null,
              }
              const rest = prev.filter((_, i) => i !== idx)
              return [updated, ...rest]
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
  }, [channelId, router])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const q = productSearch.trim()
      const base = supabase
        .from('products')
        .select('id,name,retail_price,thumb_img')
        .eq('status', 'active')
      const { data } = q
        ? await base.ilike('name', `%${q}%`).limit(30)
        : await base.limit(50)
      if (!cancelled && data) setProducts((data as ProductRow[]) || [])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable
  }, [productSearch])

  useEffect(() => {
    if (!ownerUserId) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('owner_coupons')
        .select('id,name,discount_type,discount_value,min_order_amount,expires_at')
        .eq('owner_id', ownerUserId)
        .eq('is_active', true)
      if (cancelled || error) return
      setCouponList(((data as OwnerCouponRow[]) || []).filter((r) => r?.id))
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable
  }, [ownerUserId])

  useEffect(() => {
    if (!ownerUserId) return
    supabase.auth.getUser().then(({ data: authData }) => {
      supabase.from('users').select('role').eq('auth_id', authData.user?.id ?? '').maybeSingle()
        .then(({ data: roleData }) => {
          let q = supabase
            .from('chat_channels')
            .select('id,title,preview_text,last_message_at,unread_count,user_id')
            .eq('channel_type', 'owner')
            .order('last_message_at', { ascending: false })
          if (roleData?.role !== 'admin') {
            q = q.eq('owner_id', ownerUserId)
          }
          q.then(({ data }) => {
            setChannels(data ?? [])
            setChannelsLoading(false)
            const userIds = (data ?? []).map((c: { user_id?: string | null }) => c.user_id).filter(Boolean) as string[]
            if (userIds.length > 0) {
              supabase
                .from('users')
                .select('id,name,email')
                .in('id', userIds)
                .then(({ data: uData }) => {
                  const nameMap: Record<string, string> = {}
                  for (const u of uData ?? []) {
                    const row = u as { id: string; name?: string | null; email?: string | null }
                    nameMap[row.id] = row.name || row.email?.split('@')[0] || '고객'
                  }
                  setChannels((prev) =>
                    prev.map((c) => ({
                      ...c,
                      customer_name: nameMap[String(c.user_id ?? '')] || c.title || '고객',
                    }))
                  )
                })
            }
          })
        })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client stable for this effect
  }, [ownerUserId])

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
      const { data: memoRow } = await supabase.from('chat_channels').select('owner_memo').eq('id', channelId).maybeSingle()
      const prevMemo = String((memoRow as { owner_memo?: string | null } | null)?.owner_memo ?? '')
      const dn = new Date()
      const stamp = `[${dn.getFullYear()}.${String(dn.getMonth() + 1).padStart(2, '0')}.${String(dn.getDate()).padStart(2, '0')}]`
      const nextMemo = `${stamp}\n${memoText}\n\n${prevMemo}`
      const { error } = await supabase.from('chat_channels').update({ owner_memo: nextMemo }).eq('id', channelId)
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

  const resolveChannelCustomerId = async (): Promise<string | null> => {
    if (customerUserId) return customerUserId
    if (!channelId) return null
    const { data } = await supabase.from('chat_channels').select('user_id').eq('id', channelId).maybeSingle()
    const uid = data && (data as { user_id?: string | null }).user_id ? String((data as { user_id: string }).user_id) : null
    if (uid) setCustomerUserId(uid)
    return uid
  }

  const sendOwnerCouponToCustomer = async (coupon: OwnerCouponRow) => {
    if (!channelId || !ownerUserId) return
    const uid = await resolveChannelCustomerId()
    if (!uid) return
    setSending(true)
    try {
      const { error: e1 } = await supabase.from('customer_coupons').insert({
        owner_coupon_id: coupon.id,
        user_id: uid,
        channel_id: channelId,
        expires_at: coupon.expires_at,
      } as any)
      if (e1) {
        console.warn('[customer_coupons]', e1)
        return
      }
      const { error: e2 } = await supabase.from('benefit_history').insert({
        user_id: uid,
        giver_id: ownerUserId,
        giver_type: 'owner',
        benefit_type: 'coupon',
        benefit_name: coupon.name,
        benefit_value: coupon.discount_value,
      } as any)
      if (e2) {
        console.warn('[benefit_history]', e2)
        return
      }
      const { error: e3 } = await supabase.from('consultation_messages').insert({
        channel_id: channelId,
        sender_id: ownerUserId,
        message: JSON.stringify({
          id: coupon.id,
          name: coupon.name,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          min_order_amount: coupon.min_order_amount,
          expires_at: coupon.expires_at,
        }),
        is_from_customer: false,
        message_kind: 'coupon_gift',
      } as any)
      if (!e3) setToolPanel(null)
    } finally {
      setSending(false)
    }
  }

  const createOwnerCoupon = async () => {
    if (!ownerUserId || !couponName.trim() || sending) return
    const val = Number(discountValue)
    if (!Number.isFinite(val)) return
    setSending(true)
    try {
      const expires_at = new Date(Date.now() + validDays * 86400000).toISOString()
      const { data, error } = await supabase
        .from('owner_coupons')
        .insert({
          owner_id: ownerUserId,
          name: couponName.trim(),
          discount_type: discountType,
          discount_value: val,
          min_order_amount: minOrder,
          expires_at,
          is_active: true,
          code: Math.random().toString(36).slice(2, 10).toUpperCase(),
        } as any)
        .select('id,name,discount_type,discount_value,min_order_amount,expires_at')
        .maybeSingle()
      if (error || !data) {
        console.warn('[owner_coupons insert]', error)
        return
      }
      const row = data as OwnerCouponRow
      setCouponList((prev) => [...prev, row])
      await sendOwnerCouponToCustomer(row)
      setShowCouponForm(false)
      setCouponName('')
      setDiscountValue('')
      setDiscountType('percent')
      setMinOrder(0)
      setValidDays(30)
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
      {
        const { error: ttErr } = await supabase.from('toast_transactions').insert({
          user_id: customerUserId,
          amount: n,
          transaction_type: 'gift',
          source_type: 'gift',
          reference_id: channelId,
        } as any)
        if (ttErr) console.warn('[toast_transactions gift]', ttErr)
      }
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
    <div style={{ height: '100dvh', overflow: 'hidden', background: BG, color: '#fff', display: 'flex', flexDirection: isPC ? 'row' : 'column' }}>
      {isPC && (
        <div
          style={{
            width: 260,
            flexShrink: 0,
            borderRight: '1px solid rgba(255,255,255,0.08)',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '16px 14px 10px', fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em' }}>상담 채널</div>
          {channelsLoading ? (
            <div style={{ padding: '20px 14px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>로딩중...</div>
          ) : channels.length === 0 ? (
            <div style={{ padding: '20px 14px', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>채널 없음</div>
          ) : (
            channels.map((ch) => {
              const isActive = ch.id === channelId
              return (
                <div
                  key={ch.id}
                  onClick={() => router.push('/dashboard/owner/chat/' + ch.id)}
                  style={{
                    padding: '11px 14px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(123,94,167,0.25)' : 'transparent',
                    borderLeft: isActive ? '2px solid #7B5EA7' : '2px solid transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: 13, color: isActive ? '#fff' : 'rgba(255,255,255,0.75)', marginBottom: 3, fontWeight: 500 }}>
                    {(ch as any).customer_name || ch.title || '고객'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.38)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ch.preview_text || '메시지 없음'}
                  </div>
                  {ch.unread_count > 0 && (
                    <div
                      style={{
                        marginTop: 4,
                        display: 'inline-block',
                        background: '#7B5EA7',
                        borderRadius: 8,
                        padding: '1px 7px',
                        fontSize: 10,
                        color: '#fff',
                      }}
                    >
                      {ch.unread_count}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontFamily: "'Noto Serif KR', serif", fontSize: 16, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {channelTitle}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                background: customerGrade === 'CÉLESTE' ? '#3C3489' : customerGrade === 'NOIR' ? '#2C2C2A' : customerGrade === 'REINE' ? '#F1EFE8' : customerGrade === 'LUMIÈRE' ? '#FBEAF0' : customerGrade === 'VELVET' ? '#FAEEDA' : customerGrade === 'BLOOM' ? '#EAF3DE' : '#EEEDFE',
                color: customerGrade === 'CÉLESTE' ? '#EEEDFE' : customerGrade === 'NOIR' ? '#D3D1C7' : customerGrade === 'REINE' ? '#5F5E5A' : customerGrade === 'LUMIÈRE' ? '#993556' : customerGrade === 'VELVET' ? '#854F0B' : customerGrade === 'BLOOM' ? '#3B6D11' : '#534AB7',
              }}>
                {customerGrade}
              </div>
              <div
                onClick={() => setShowGradePopup(true)}
                style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', flexShrink: 0 }}
              >?</div>
            </div>
            {(() => {
              const gradeMap: Record<string, { next: string; threshold: number; prev: number }> = {
                PETAL: { next: 'BLOOM', threshold: 3000000, prev: 0 },
                BLOOM: { next: 'VELVET', threshold: 6000000, prev: 3000000 },
                VELVET: { next: 'LUMIÈRE', threshold: 12000000, prev: 6000000 },
                LUMIÈRE: { next: 'REINE', threshold: 24000000, prev: 12000000 },
              }
              const info = gradeMap[customerGrade]
              if (!info) return null
              const remaining = Math.max(0, info.threshold - customerTotalPurchase)
              const progress = Math.min(100, ((customerTotalPurchase - info.prev) / (info.threshold - info.prev)) * 100)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    {info.next}까지 {remaining.toLocaleString()}원
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2, width: 120, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: '#AFA9EC', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })()}
          </div>
          <button
            type="button"
            aria-label="피부기록"
            onClick={() => { setShowHistory(false); setShowSkinLog((v) => !v) }}
            style={{
              flexShrink: 0,
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid rgba(123,94,167,0.45)`,
              background: 'rgba(123,94,167,0.18)',
              color: '#e8dff5',
              fontSize: 11,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            🌿 피부기록
          </button>
          <button
            type="button"
            aria-label="원장 메모"
            onClick={() => setMemoOpen(true)}
            style={{
              flexShrink: 0,
              width: 'auto',
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
              padding: '0 10px',
            }}
          >
            <span style={{ fontSize: 11 }}>📝 메모</span>
          </button>
          <button
            type="button"
            disabled={!customerUserId}
            onClick={() => {
              void (async () => {
                if (!customerUserId) return
                const { error } = await supabase.from('users').update({ renobel_unlocked: true }).eq('id', customerUserId)
                if (error) {
                  console.warn('[renobel_unlocked]', error)
                  return
                }
                alert('르노벨이 오픈됐어요 💜')
              })()
            }}
            style={{
              flexShrink: 0,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(123,94,167,0.5)',
              background: 'rgba(76,173,126,0.15)',
              color: '#b8e6c8',
              fontSize: 11,
              fontWeight: 500,
              cursor: !customerUserId ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            💜 르노벨 오픈
          </button>
          <button
            type="button"
            disabled={!channelId || !customerUserId || sending}
            onClick={() => {
              void (async () => {
                if (!channelId || !customerUserId || sending) return
                setSending(true)
                try {
                  const { error: stErr } = await supabase
                    .from('chat_channels')
                    .update({ status: 'completed' } as any)
                    .eq('id', channelId)
                  if (stErr) return
                } finally {
                  setSending(false)
                }
              })()
            }}
            style={{
              flexShrink: 0,
              padding: '6px 10px',
              borderRadius: 8,
              border: `1px solid rgba(76,173,126,0.45)`,
              background: 'rgba(76,173,126,0.15)',
              color: '#b8e6c8',
              fontSize: 11,
              fontWeight: 500,
              cursor: sending || !customerUserId ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            상담 완료
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#e8dff5', border: '1px solid rgba(123,94,167,0.45)', background: 'rgba(123,94,167,0.2)', borderRadius: 999, padding: '4px 10px' }}>
          원장
        </div>
      </div>

      {showSkinLog && customerUserId ? (
        <div
          style={{
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.25)',
            padding: '10px 16px 12px',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginBottom: 8 }}>최근 피부 기록 (10건)</div>
          {skinLogs.length === 0 ? (
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>아직 피부 기록이 없어요</div>
          ) : (
            skinLogs.map((l) => {
              const cd = new Date(l.created_at)
              const dateStr = `${cd.getFullYear()}.${String(cd.getMonth() + 1).padStart(2, '0')}.${String(cd.getDate()).padStart(2, '0')}`
              const conds = Array.isArray(l.skin_conditions) ? l.skin_conditions : []
              return (
                <div
                  key={String(l.id)}
                  style={{
                    marginBottom: 10,
                    background: 'rgba(255,255,255,0.04)',
                    padding: '10px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.82)',
                    lineHeight: 1.55,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>{dateStr}</span>
                  </div>
                  <div>수면: {Number(l.sleep_hours ?? 0)}h</div>
                  <div>자외선: {Number(l.uv_exposure ?? 0)}</div>
                  <div>스트레스: {Number(l.stress_level ?? 0)}</div>
                  <div>피부상태: {conds.length ? conds.join(', ') : '-'}</div>
                  <div>메모: {String(l.memo || '-')}</div>
                </div>
              )
            })
          )}
        </div>
      ) : null}

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 140px', minWidth: 0 }}>
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
                    m.message_kind === 'product_recommend' || m.message_kind === 'routine_card' ? '8px 8px 14px' : '10px 12px 16px',
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
                      🧴 원장님 추천 제품
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
                        onClick={() => void sendProductRecommend()}
                        disabled={sending || basket.length === 0}
                        style={{
                          flex: 1,
                          padding: '8px 6px',
                          borderRadius: 8,
                          border: `1px solid rgba(123,94,167,0.45)`,
                          background: 'rgba(123,94,167,0.15)',
                          color: '#e8dff5',
                          fontSize: 11,
                          cursor: sending || basket.length === 0 ? 'default' : 'pointer',
                          opacity: sending || basket.length === 0 ? 0.5 : 1,
                        }}
                      >
                        추천 전송
                      </button>
                    </div>
                  </div>
                ) : m.message_kind === 'routine_card' ? (
                  <div
                    style={{
                      maxWidth: '85%',
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
                        wordBreak: 'break-word',
                      }}
                    >
                      {msgText(m)}
                    </div>
                  </div>
                ) : m.message_kind === 'coupon_gift' ? (() => {
                  let cp: Record<string, unknown> = {}
                  try {
                    cp = JSON.parse(m.message ?? '')
                  } catch {}
                  const isShip = !!cp.user_coupon_id
                  return (
                    <div
                      style={{
                        background: 'rgba(123,94,167,0.15)',
                        border: '1px solid rgba(123,94,167,0.4)',
                        borderRadius: 12,
                        padding: '12px 14px 16px',
                        minWidth: 180,
                        maxWidth: 260,
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#C084FC', marginBottom: 4 }}>🎁 쿠폰 발송</div>
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
                  )
                })() : m.message_kind === 'toast_gift' ? (
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid rgba(255,180,50,0.4)',
                      padding: '10px 14px',
                      background: 'rgba(255,180,50,0.08)',
                      minWidth: 160,
                    }}
                  >
                    <div style={{ fontSize: 11, color: 'rgba(255,200,80,0.8)', marginBottom: 4 }}>
                      🍓 달콤한 딸기잼 선물!
                    </div>
                    <div style={{ fontSize: 15, color: '#ffe08a', fontWeight: 500 }}>
                      🍞 {msgText(m)}
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
          background: '#0D0B09',
          borderTop: '1px solid rgba(255,255,255,0.08)',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, maxWidth: '100%' }}>
              {couponList.length === 0 ? (
                <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '4px 0' }}>아직 만든 쿠폰이 없어요</div>
              ) : (
                couponList.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void sendOwnerCouponToCustomer(c)}
                    disabled={sending}
                    style={{
                      flexShrink: 0,
                      maxWidth: 220,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid rgba(123,94,167,0.35)`,
                      background: 'rgba(123,94,167,0.1)',
                      color: '#f5e6c8',
                      fontSize: 12,
                      textAlign: 'left',
                      cursor: sending ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4 }}>
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : `${Number(c.discount_value).toLocaleString()}원`}{' '}
                      · 최소 {c.min_order_amount ? `${Number(c.min_order_amount).toLocaleString()}원` : '없음'}
                    </div>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCouponForm((v) => !v)}
              style={{
                alignSelf: 'flex-start',
                padding: '6px 12px',
                borderRadius: 8,
                border: `1px dashed ${GOLD}`,
                background: 'rgba(201,169,110,0.08)',
                color: GOLD,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              + 새 쿠폰 만들기
            </button>
            {showCouponForm ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid rgba(123,94,167,0.35)',
                  background: 'rgba(0,0,0,0.25)',
                }}
              >
                <input
                  value={couponName}
                  onChange={(e) => setCouponName(e.target.value)}
                  placeholder="쿠폰 이름"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: 13,
                    padding: '8px 10px',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: discountType === 'percent' ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.15)',
                      background: discountType === 'percent' ? 'rgba(201,169,110,0.15)' : 'transparent',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('amount')}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: 8,
                      border: discountType === 'amount' ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.15)',
                      background: discountType === 'amount' ? 'rgba(201,169,110,0.15)' : 'transparent',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    금액
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percent' ? '할인율' : '할인 금액'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: 13,
                    padding: '8px 10px',
                    outline: 'none',
                  }}
                />
                <div style={{ fontSize: 10, color: TEXT_MUTED }}>최소 주문</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { v: 0, label: '없음' },
                    { v: 50000, label: '5만' },
                    { v: 100000, label: '10만' },
                  ].map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMinOrder(v)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: minOrder === v ? `1px solid ${GOLD}` : '1px solid rgba(123,94,167,0.35)',
                        background: minOrder === v ? 'rgba(201,169,110,0.12)' : 'rgba(123,94,167,0.08)',
                        color: '#e8dff5',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: TEXT_MUTED }}>유효 기간</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setValidDays(d)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: validDays === d ? `1px solid ${GOLD}` : '1px solid rgba(123,94,167,0.35)',
                        background: validDays === d ? 'rgba(201,169,110,0.12)' : 'rgba(123,94,167,0.08)',
                        color: '#e8dff5',
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                    >
                      {d}일
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void createOwnerCoupon()}
                  disabled={sending || !couponName.trim()}
                  style={{
                    alignSelf: 'flex-end',
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: sending || !couponName.trim() ? 'rgba(123,94,167,0.25)' : PURPLE,
                    color: '#fff',
                    fontSize: 13,
                    cursor: sending || !couponName.trim() ? 'default' : 'pointer',
                  }}
                >
                  바로 발행하기
                </button>
              </div>
            ) : null}
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
      </div>

      {(isPC || showHistory) && customerUserId ? (
        <div
          style={
            isPC
              ? {
                  width: 280,
                  flexShrink: 0,
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  borderBottom: 'none',
                  background: 'rgba(0,0,0,0.25)',
                  overflowY: 'auto',
                  padding: '16px',
                  maxHeight: '100dvh',
                }
              : {
                  flexShrink: 0,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.25)',
                  padding: '10px 16px 12px',
                  maxHeight: 200,
                  overflowY: 'auto',
                }
          }
        >
          {customerSkinInfo && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {customerSkinInfo.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={customerSkinInfo.avatar_url}
                    alt=""
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid rgba(192,132,252,0.3)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: '#7B5EA7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
                    {channelTitle?.slice(0, 1) ?? '고'}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: '#C084FC',
                        background: 'rgba(192,132,252,0.15)',
                        padding: '1px 7px',
                        borderRadius: 8,
                      }}
                    >
                      ✦ {customerGrade || 'PETAL'}
                    </span>
                    {customerSkinInfo.is_founder && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#C9A96E',
                          background: 'rgba(201,169,110,0.15)',
                          padding: '1px 7px',
                          borderRadius: 8,
                        }}
                      >
                        👑 Founders
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
                    누적 {customerTotalPurchase.toLocaleString()}원 · 토스트 {customerSkinInfo.points}T
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>호르몬 페이즈</div>
                  <div style={{ fontSize: 11, color: '#C084FC' }}>
                    {customerSkinInfo.hormone_phase === 'menstrual' && '🌙 달빛기'}
                    {customerSkinInfo.hormone_phase === 'follicular' && '✨ 황금기'}
                    {customerSkinInfo.hormone_phase === 'ovulation' && '🌸 만개기'}
                    {customerSkinInfo.hormone_phase === 'luteal' && '🍂 물들기'}
                    {!customerSkinInfo.hormone_phase && '— 미등록'}
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>피부타입</div>
                  <div style={{ fontSize: 11, color: '#fff' }}>{customerSkinInfo.skin_type ?? '미등록'}</div>
                </div>
              </div>
              {customerSkinInfo.skin_concerns.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 5 }}>피부 고민</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>
                    {customerSkinInfo.skin_concerns.map((c: string, i: number) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 10,
                          background: 'rgba(123,94,167,0.2)',
                          color: 'rgba(255,255,255,0.7)',
                          padding: '2px 8px',
                          borderRadius: 10,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div
            onClick={() => setShowHistoryList((v) => !v)}
            style={{
              padding: '10px 14px',
              fontSize: 12,
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: showHistoryList ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}
          >
            <span>구매 히스토리</span>
            <span style={{ fontSize: 10 }}>{showHistoryList ? '▲' : '▼'}</span>
          </div>
          {showHistoryList &&
            (historyOrders.length === 0 ? (
            <div style={{ fontSize: 12, color: TEXT_MUTED }}>아직 구매 내역이 없어요</div>
          ) : (
            historyOrders.map((o) => {
              const cd = new Date(o.created_at)
              const dateStr = `${cd.getFullYear()}.${String(cd.getMonth() + 1).padStart(2, '0')}.${String(cd.getDate()).padStart(2, '0')}`
              const items = (() => {
                try {
                  const raw = o.items
                  if (Array.isArray(raw)) return raw
                  if (typeof raw === 'string') return JSON.parse(raw)
                  return []
                } catch {
                  return []
                }
              })()
              return (
                <div
                  key={o.id}
                  style={{
                    marginBottom: 10,
                    background: 'rgba(255,255,255,0.04)',
                    padding: '10px 12px',
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: items.length > 0 ? 8 : 0,
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>{dateStr}</span>
                    {(() => {
                      const s = String(o.status ?? '')
                      const map: Record<string, { bg: string; color: string }> = {
                        주문확인: { bg: '#EAF3DE', color: '#3B6D11' },
                        발송준비: { bg: '#E6F1FB', color: '#185FA5' },
                        배송중: { bg: '#E6F1FB', color: '#185FA5' },
                        배송완료: { bg: '#EEEDFE', color: '#534AB7' },
                        구매확정: { bg: '#EEEDFE', color: '#3C3489' },
                        취소: { bg: '#FCEBEB', color: '#A32D2D' },
                        반품요청: { bg: '#FAEEDA', color: '#854F0B' },
                      }
                      const c = map[s] || { bg: '#F1EFE8', color: '#5F5E5A' }
                      return (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500, background: c.bg, color: c.color }}>
                          {s || '—'}
                        </span>
                      )
                    })()}
                  </div>
                  {items.length > 0
                    ? (() => {
                        const firstItem = items[0]
                        const thumbUrl = firstItem?.product_id ? productThumbs[firstItem.product_id] : null
                        const more = items.length - 1
                        return (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              marginTop: 0,
                              padding: '8px 0 0',
                            }}
                          >
                            {thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumbUrl}
                                alt=""
                                style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', display: 'block' }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 8,
                                  flexShrink: 0,
                                  background: '#EEEDFE',
                                }}
                              />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: 'rgba(255,255,255,0.9)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.35,
                                }}
                              >
                                {firstItem.product_name}
                              </div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>수량 {Number(firstItem.quantity ?? 0)}</div>
                              {more > 0 ? (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>외 {more}개 상품</div>
                              ) : null}
                            </div>
                          </div>
                        )
                      })()
                    : null}
                  <div
                    style={{
                      marginTop: items.length > 0 ? 8 : 0,
                      textAlign: 'right',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.9)',
                    }}
                  >
                    총 ₩{Number(o.final_amount ?? 0).toLocaleString()}
                  </div>
                </div>
              )
            })
          ))}
        </div>
      ) : null}

      {showGradePopup && (
        <div onClick={() => setShowGradePopup(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1a2e', borderRadius: 16, overflow: 'hidden', width: '90%', maxWidth: 340, border: '0.5px solid rgba(255,255,255,0.1)' }}>
            <div style={{ background: '#7B5EA7', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>AURAN 등급 안내</span>
              <span onClick={() => setShowGradePopup(false)} style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>✕</span>
            </div>
            {[
              { grade: 'PETAL', amount: '0원 ~', benefits: '기본 혜택 · 토스트 적립 0%', bg: '#EEEDFE', color: '#534AB7' },
              { grade: 'BLOOM', amount: '300만원 ~', benefits: '등급 할인 1% · 토스트 적립 0.5% · 충전 보너스 0.2%', bg: '#EAF3DE', color: '#3B6D11' },
              { grade: 'VELVET', amount: '600만원 ~', benefits: '등급 할인 2% · 토스트 적립 1% · 충전 보너스 0.4%', bg: '#FAEEDA', color: '#854F0B' },
              { grade: 'LUMIÈRE', amount: '1,200만원 ~', benefits: '등급 할인 3% · 토스트 적립 1.5% · 충전 보너스 0.6%', bg: '#FBEAF0', color: '#993556' },
              { grade: 'REINE', amount: '2,400만원 ~', benefits: '등급 할인 4% · 토스트 적립 2% · 충전 보너스 0.8%', bg: '#F1EFE8', color: '#5F5E5A' },
              { grade: 'NOIR', amount: '초대제', benefits: '등급 할인 5% · 토스트 적립 2.5% · 충전 보너스 1.0%', bg: '#2C2C2A', color: '#D3D1C7' },
              { grade: 'CÉLESTE', amount: '초대제 · 상위 1%', benefits: '등급 할인 6% · 토스트 적립 3% · 충전 보너스 1.2% · VIP 전용 혜택', bg: '#3C3489', color: '#EEEDFE' },
            ].map((g) => (
              <div key={g.grade} style={{ padding: '10px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.08)', background: g.grade === customerGrade ? 'rgba(123,94,167,0.2)' : 'transparent', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500, background: g.bg, color: g.color, flexShrink: 0, marginTop: 2 }}>{g.grade}{g.grade === customerGrade ? ' ←' : ''}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{g.amount}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{g.benefits}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
