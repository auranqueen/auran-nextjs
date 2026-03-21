'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ProductThumbnail from '@/components/ProductThumbnail'
import { useRouter } from 'next/navigation'
import CustomerHeaderRight from '@/components/CustomerHeaderRight'
import DashboardBottomNav from '@/components/DashboardBottomNav'
import { createClient } from '@/lib/supabase/client'
import { broadcastCartCountRefresh } from '@/lib/cartEvents'
import { createNotification } from '@/lib/notifications/createNotification'
import { useAdminSettings } from '@/hooks/useAdminSettings'

interface Props {
  profile: any
  notifications: any[]
  recentOrders: any[]
  pointHistory: any[]
  featuredProducts?: any[]
}

const BRAND_TABS = ['전체', 'Civasan', 'Gernetic', 'Shopbelle', '보떼덤', 'Dr.Sante']
const QUICK_MENUS = [
  { icon: '🧬', label: 'AI 피부 분석', href: '/ai-analysis' },
  { icon: '📅', label: '살롱 예약', href: '/booking' },
  { icon: '🌍', label: '마이월드', href: '/myworld' },
  { icon: '📦', label: '구매 내역', href: '/orders' },
]

const DEFAULT_COORDS = { lat: 35.8562, lng: 128.6310 }

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function normalizeBrandName(p: any) {
  return (p.brand_name || p.brands?.name || '').toString()
}

export default function CustomerDashboardClient({
  profile,
  notifications: _notifications,
  recentOrders: _recentOrders,
  pointHistory: _pointHistory,
  featuredProducts: _featuredProducts,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { getSettingNum, getSetting } = useAdminSettings()
  const [feedLoading, setFeedLoading] = useState(true)
  const [wallet, setWallet] = useState({ points: toNum(profile?.points), balance: toNum(profile?.charge_balance) })
  const [brandTab, setBrandTab] = useState('전체')
  const [categoryTab, setCategoryTab] = useState('전체')
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [specials, setSpecials] = useState<any[]>([])
  const [stores, setStores] = useState<any[]>([])
  const [specialMeta, setSpecialMeta] = useState<Record<string, { buyers: number; hook: string }>>({})
  const [meId, setMeId] = useState<string>('')
  const [toast, setToast] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftTargetProduct, setGiftTargetProduct] = useState<any | null>(null)
  const [giftMessage, setGiftMessage] = useState('')
  const [friends, setFriends] = useState<any[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [nowTs, setNowTs] = useState(Date.now())
  const [specialIndex, setSpecialIndex] = useState(0)
  const [specialResumeAt, setSpecialResumeAt] = useState(0)
  const [coords, setCoords] = useState(DEFAULT_COORDS)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const reviewThreshold = getSettingNum('product_hook', 'review_threshold', 10)
  const aiHookEnabled = getSettingNum('product_hook', 'ai_hook_enabled', 1) === 1
  const buyerBadgeMin = getSettingNum('product_hook', 'buyer_badge_min', 10)
  const giftEnabled = getSettingNum('gift', 'gift_enabled', 1) === 1
  const giftMsgMax = getSettingNum('gift', 'gift_message_max_length', 100)
  const giftNotifyEnabled = getSettingNum('gift', 'gift_notification_enabled', 1) === 1
  const homeSpecialEnabled = getSettingNum('home_special', 'enabled', 1) === 1
  const homeSpecialMaxItems = Math.max(1, getSettingNum('home_special', 'max_items', 8))
  const homeSpecialRollingSec = Math.max(1, getSettingNum('home_special', 'rolling_interval_sec', 6))
  const homeSpecialShowTimer = getSettingNum('home_special', 'show_timer', 1) === 1
  const homeSpecialAutoplayEnabled = getSettingNum('home_special', 'autoplay_enabled', 1) === 1
  const homeSpecialManualNavEnabled = getSettingNum('home_special', 'manual_nav_enabled', 1) === 1
  const homeSpecialResumeDelaySec = Math.max(0, getSettingNum('home_special', 'autoplay_resume_delay_sec', 8))
  const homeSpecialSwipeEnabled = getSettingNum('home_special', 'swipe_enabled', 1) === 1
  const homeSpecialSwipeThresholdPx = Math.max(10, getSettingNum('home_special', 'swipe_threshold_px', 40))
  const homeSpecialTitle = getSetting('home_special', 'title', '오늘의 특가')
  const flashMaxActiveCount = Math.max(1, getSettingNum('flash_sale', 'max_active_count', 8))
  const flashUrgentMinutes = Math.max(1, getSettingNum('flash_sale', 'badge_urgent_minutes', 60))
  const homeSearchPlaceholder = getSetting('home_search', 'placeholder', '전체상품 검색 (브랜드/상품명/설명)')
  const homeSearchFields = getSetting('home_search', 'fields', 'name,description,brand')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
  const homeSearchMinChars = Math.max(0, getSettingNum('home_search', 'min_chars', 1))
  const homeSearchEnabled = getSettingNum('home_search', 'enabled', 1) === 1
  const homeSearchShowCount = getSettingNum('home_search', 'show_result_count', 1) === 1
  const homeSearchSyncToUrl = getSettingNum('home_search', 'sync_to_url', 1) === 1
  const homeSearchQueryParam = getSetting('home_search', 'query_param', 'q') || 'q'

  const formatRemain = (endAt: string) => {
    const remainMs = new Date(endAt).getTime() - nowTs
    if (remainMs <= 0) return '종료됨'
    const totalSec = Math.floor(remainMs / 1000)
    const dd = Math.floor(totalSec / 86400)
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    if (dd > 0) {
      const hhInDay = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0')
      return `${dd}일 ${hhInDay}:${mm}:${ss}`
    }
    return `${hh}:${mm}:${ss}`
  }

  const logAction = (type: string, detail: Record<string, any> = {}) => {
    const msg = `[home-action] ${type} ${JSON.stringify(detail)}`
    console.log(msg)
  }

  useEffect(() => {
    if (!homeSearchSyncToUrl || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const q = params.get(homeSearchQueryParam) || ''
    if (q) setProductSearch(q)
    // 초기 1회 파싱
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!homeSearchSyncToUrl || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const q = productSearch.trim()
    if (q) url.searchParams.set(homeSearchQueryParam, q)
    else url.searchParams.delete(homeSearchQueryParam)
    const query = url.searchParams.toString()
    window.history.replaceState({}, '', query ? `${url.pathname}?${query}` : url.pathname)
  }, [productSearch, homeSearchSyncToUrl, homeSearchQueryParam])

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getUser()
      const user = auth?.user
      if (!user) return

      const { data: me } = await supabase.from('users').select('id, points, charge_balance').eq('auth_id', user.id).maybeSingle()
      if (me?.id) {
        setMeId(me.id)
        const { data: uw } = await supabase.from('user_wallets').select('points, charge_balance, balance').eq('user_id', me.id).maybeSingle()
        if (uw) {
          setWallet({
            points: toNum(uw.points ?? me.points),
            balance: toNum(uw.charge_balance ?? uw.balance ?? me.charge_balance),
          })
        } else {
          setWallet({ points: toNum(me.points), balance: toNum(me.charge_balance) })
        }
      }
    }
    run()
  }, [supabase, profile?.points, profile?.charge_balance])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const res = await fetch('/api/coupons/birthday-check', { method: 'POST', credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      if (cancelled) return
      if (res.ok && j?.ok && Number(j?.issued || 0) > 0) {
        setToast('🎂 생일 축하해요! 특별 쿠폰이 발급됐어요 🎫')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    const run = async () => {
      setFeedLoading(true)
      const nowIso = new Date().toISOString()
      try {
      const { data, error } = await supabase
        .from('products')
        .select('*, brands(name)')
        .eq('status', 'active')
        .limit(50)

      let list: any[] = []
      if (!error) {
        list = (data || []).map((p: any) => ({ ...p, brand_name: p.brands?.name || '' }))
      } else {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'active')
          .limit(20)
        if (fallbackError) console.warn('[customer-home products fallback error]', fallbackError)
        list = (fallbackData || []).map((p: any) => ({ ...p, brand_name: p.brand_name || '' }))
      }

      if (!list.length) {
        setProducts([])
        setSpecials([])
        return
      }
      setProducts(list)

      const endedIds = list
        .filter((p: any) => p.is_flash_sale && p.flash_sale_end && new Date(p.flash_sale_end).getTime() <= new Date(nowIso).getTime())
        .map((p: any) => p.id)
      if (endedIds.length > 0) {
        await supabase.from('products').update({ is_flash_sale: false }).in('id', endedIds)
      }

      const liveFlash = list
        .filter((p: any) => p.is_flash_sale && p.flash_sale_start && p.flash_sale_end && p.flash_sale_start < nowIso && p.flash_sale_end > nowIso)
        .sort((a: any, b: any) => new Date(a.flash_sale_end).getTime() - new Date(b.flash_sale_end).getTime())
      const nextSpecials = (liveFlash.length > 0 ? liveFlash : [...list].sort((a: any, b: any) => toNum(b.sales_count) - toNum(a.sales_count))).slice(0, Math.min(homeSpecialMaxItems, flashMaxActiveCount))
      setSpecials(nextSpecials)
      setSpecialIndex(0)

      const ids = nextSpecials.map((p: any) => p.id)
      if (ids.length > 0) {
        const [buyerRes, reviewRes] = await Promise.all([
          supabase.from('order_items').select('product_id').in('product_id', ids),
          supabase
            .from('reviews')
            .select('product_id,content,rating')
            .eq('review_type', 'product')
            .eq('status', '게시')
            .gte('rating', 4)
            .in('product_id', ids),
        ])
        const buyerRows = buyerRes.data
        const reviewRows = reviewRes.data
        const buyerCountMap: Record<string, number> = {}
        for (const r of buyerRows || []) {
          const id = String((r as any).product_id || '')
          if (!id) continue
          buyerCountMap[id] = (buyerCountMap[id] || 0) + 1
        }
        const map: Record<string, { buyers: number; hook: string }> = {}
        const keywordPool = ['모공', '피지', '보습', '진정', '탄력', '미백', '트러블', '수분', '촉촉', '깨끗', '개선']
        const skinType = String(profile?.skin_type || '')
        const aiMap: Record<string, string> = {
          건성: '당기는 피부에 수분막을 채워줘요 💧',
          지성: '피지·모공 세척으로 맑은 피부 시작 ✨',
          복합성: 'T존 피지 + U존 수분 동시 케어 🌿',
          민감성: '자극 없이 진정시켜주는 성분 확인 🌸',
          트러블성: '트러블 원인 차단, 맑아지는 피부 🔴→⚪',
          안티에이징형: '탄력·주름 집중 케어 라인 👑',
        }
        for (const id of ids) {
          const rows = (reviewRows || []).filter((r: any) => String(r.product_id) === id)
          let hook = aiMap[skinType] || '내 피부타입 맞춤 추천 제품이에요'
          if (aiHookEnabled && rows.length >= reviewThreshold) {
            const counts: Record<string, number> = {}
            for (const r of rows) {
              const c = String(r.content || '')
              for (const k of keywordPool) {
                if (c.includes(k)) counts[k] = (counts[k] || 0) + 1
              }
            }
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k)
            if (top.length >= 2) hook = `${top[0]}·${top[1]} 케어에 효과적이에요 ✨`
            else if (top.length === 1) hook = `${top[0]} 케어에 효과적이에요 ✨`
          }
          map[id] = { buyers: buyerCountMap[id] || 0, hook }
        }
        setSpecialMeta(map)
      }
      } finally {
        setFeedLoading(false)
      }
    }
    run()
  }, [supabase, profile?.skin_type, aiHookEnabled, reviewThreshold, homeSpecialMaxItems, flashMaxActiveCount])

  useEffect(() => {
    if (!navigator?.geolocation) {
      setCoords(DEFAULT_COORDS)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setCoords(DEFAULT_COORDS)
      },
      { timeout: 5000, maximumAge: 300000 }
    )
  }, [])

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.from('auran_stores').select('*').limit(60)
      if (error || !data) return

      const sorted = data
        .map((s: any) => {
          const lat = toNum(s.lat ?? s.latitude)
          const lng = toNum(s.lng ?? s.longitude)
          return {
            ...s,
            distance_km: lat && lng ? distanceKm(coords.lat, coords.lng, lat, lng) : 9999,
          }
        })
        .sort((a: any, b: any) => a.distance_km - b.distance_km)
        .slice(0, 3)

      setStores(sorted)
    }
    run()
  }, [supabase, coords.lat, coords.lng])

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const brandName = normalizeBrandName(p)
      const search = productSearch.trim().toLowerCase()
      const skinTypes = Array.isArray(p.skin_types) ? p.skin_types : []
      const brandOk = brandTab === '전체' || brandName.toLowerCase() === brandTab.toLowerCase()
      const categoryOk = categoryTab === '전체' || skinTypes.includes(categoryTab)
      const searchActive = search.length >= homeSearchMinChars
      const inName = homeSearchFields.includes('name') && String(p.name || '').toLowerCase().includes(search)
      const inDescription = homeSearchFields.includes('description') && String(p.description || '').toLowerCase().includes(search)
      const inBrand = homeSearchFields.includes('brand') && brandName.toLowerCase().includes(search)
      const searchOk = !searchActive || inName || inDescription || inBrand
      return brandOk && categoryOk && searchOk
    })
  }, [products, brandTab, categoryTab, productSearch, homeSearchFields, homeSearchMinChars])

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!homeSpecialEnabled || !homeSpecialAutoplayEnabled || specials.length <= 1) return
    const t = setInterval(() => {
      setSpecialIndex((prev) => {
        if (Date.now() < specialResumeAt) return prev
        return (prev + 1) % specials.length
      })
    }, homeSpecialRollingSec * 1000)
    return () => clearInterval(t)
  }, [homeSpecialEnabled, homeSpecialAutoplayEnabled, homeSpecialRollingSec, specials.length, specialResumeAt])

  const currentSpecial = specials.length > 0 ? specials[specialIndex % specials.length] : null
  const prevSpecial = () => {
    setSpecialResumeAt(Date.now() + homeSpecialResumeDelaySec * 1000)
    setSpecialIndex((prev) => (prev - 1 + specials.length) % Math.max(1, specials.length))
    logAction('special_prev_click', { index: specialIndex })
  }
  const nextSpecial = () => {
    setSpecialResumeAt(Date.now() + homeSpecialResumeDelaySec * 1000)
    setSpecialIndex((prev) => (prev + 1) % Math.max(1, specials.length))
    logAction('special_next_click', { index: specialIndex })
  }

  const buyerBadge = (n: number) => {
    if (n >= 500) return `👑 ${n}명 구매 · AURAN 베스트`
    if (n >= 100) return `🔥 ${n}명의 선택! 인기 제품`
    if (n >= 50) return `⭐ ${n}명이 만족했어요`
    if (n >= buyerBadgeMin) return `${n}명이 구매했어요`
    return ''
  }

  const addToCart = async (productId: string) => {
    const resolvedMeId = await ensureMeId()
    logAction('cart_click', { productId, meId: resolvedMeId })
    if (!resolvedMeId) {
      router.push('/login?redirect=/dashboard/customer')
      return
    }
    const { error } = await supabase.from('cart_items').insert({ user_id: resolvedMeId, product_id: productId, quantity: 1 } as any)
    if (error) {
      if (String(error.message || '').toLowerCase().includes('duplicate') || String((error as any).code || '') === '23505') {
        setToast('이미 담긴 상품이에요')
        return
      }
      setToast('장바구니 저장 중 오류가 발생했어요')
      return
    }
    broadcastCartCountRefresh()
    setToast('장바구니에 담았어요 🛒')
  }

  const openGift = async (product: any) => {
    const resolvedMeId = await ensureMeId()
    logAction('gift_click', { productId: product?.id, meId: resolvedMeId })
    if (!giftEnabled) {
      setToast('선물 기능이 비활성화되어 있어요')
      return
    }
    if (!resolvedMeId) {
      router.push('/login?redirect=/dashboard/customer')
      return
    }
    const { data: rows } = await supabase.from('follows').select('following_id').eq('follower_id', resolvedMeId)
    const ids = (rows || []).map((r: any) => r.following_id).filter(Boolean)
    if (ids.length === 0) {
      setToast('오랜일촌이 없어요')
      return
    }
    const { data: users } = await supabase.from('users').select('id,name,avatar_url').in('id', ids)
    setFriends(users || [])
    setSelectedFriendId(String(ids[0]))
    setGiftTargetProduct(product)
    setGiftOpen(true)
  }

  const sendGift = async () => {
    logAction('gift_send_click', { productId: giftTargetProduct?.id, selectedFriendId })
    if (!meId || !giftTargetProduct || !selectedFriendId) return
    const target = friends.find((f: any) => String(f.id) === String(selectedFriendId))
    const { error } = await supabase.from('gifts').insert({
      sender_id: meId,
      receiver_id: selectedFriendId,
      product_id: giftTargetProduct.id,
      message: giftMessage.trim(),
      status: 'pending',
    } as any)
    if (error) {
      setToast('선물 전송에 실패했어요')
      return
    }
    if (giftNotifyEnabled) {
      await createNotification(
        supabase,
        selectedFriendId,
        'gift',
        '선물이 도착했어요',
        `${profile?.name || '친구'}님이 선물을 보냈어요 🎁`,
        '/my/gifts'
      )
    }
    setGiftOpen(false)
    setGiftMessage('')
    setToast(`${target?.name || '친구'}님께 선물을 보냈어요 🎁`)
  }

  const ensureMeId = async () => {
    if (meId) return meId
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return ''
    const { data: me } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
    const id = String(me?.id || '')
    if (id) setMeId(id)
    return id
  }

  const skinTypeChips = useMemo(() => {
    const unique: string[] = []
    for (const p of products) {
      const skins = Array.isArray(p.skin_types) ? p.skin_types : []
      for (const s of skins) {
        const label = String(s || '').trim()
        if (!label) continue
        if (!unique.includes(label)) unique.push(label)
      }
    }
    return ['전체', ...unique]
  }, [products])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 120 }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(12px)', background: 'rgba(10,12,15,0.92)', borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 20, color: '#fff', letterSpacing: 2 }}>AURAN</div>
        <CustomerHeaderRight />
      </div>

      <div style={{ padding: 16 }}>
        {toast && (
          <div style={{ marginBottom: 10, padding: '9px 10px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.35)', background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', fontSize: 12, fontWeight: 700 }}>
            {toast}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>안녕하세요, {profile?.name || '고객'}님</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>오늘도 아름다운 하루를 시작해요.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ border: '1px solid rgba(201,168,76,0.28)', background: 'rgba(201,168,76,0.1)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.75)' }}>포인트</div>
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>{wallet.points.toLocaleString()}P</div>
          </div>
          <div style={{ border: '1px solid rgba(76,173,126,0.28)', background: 'rgba(76,173,126,0.1)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.75)' }}>충전 잔액</div>
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: '#4cad7e' }}>₩{wallet.balance.toLocaleString()}</div>
          </div>
        </div>

        <button onClick={() => router.push('/ai-analysis')} style={{ width: '100%', marginBottom: 14, border: '1px solid rgba(201,168,76,0.35)', background: 'linear-gradient(135deg, rgba(201,168,76,0.2), rgba(201,168,76,0.08))', borderRadius: 14, padding: '14px 12px', color: 'var(--gold)', fontWeight: 800, fontSize: 14, textAlign: 'left' }}>
          🧬 AI 피부분석 시작하기
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {QUICK_MENUS.map((m) => (
            <button key={m.label} onClick={() => router.push(m.href)} style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '14px 12px', textAlign: 'left' }}>
              <div style={{ fontSize: 20 }}>{m.icon}</div>
              <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: '#fff' }}>{m.label}</div>
            </button>
          ))}
        </div>

        {feedLoading && (
          <div style={{ marginBottom: 16 }}>
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="auran-skeleton-pulse"
                style={{ height: 88, background: 'rgba(255,255,255,0.06)', borderRadius: 14, marginBottom: 10 }}
              />
            ))}
          </div>
        )}

        {!feedLoading && homeSpecialEnabled && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => router.push(`/products?specialIds=${encodeURIComponent(specials.map((s: any) => s.id).join(','))}`)}
            style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {homeSpecialTitle} 전체보기 ›
          </button>
          <div style={{ paddingBottom: 4 }}>
            {currentSpecial ? (
              <div key={currentSpecial.id} style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', overflow: 'hidden', cursor: 'pointer' }}>
                {(() => {
                  const p = currentSpecial
                  return (
                    <>
                <div
                  onClick={() => router.push(`/products/${p.id}`)}
                  onTouchStart={(e) => {
                    if (!homeSpecialSwipeEnabled || specials.length <= 1) return
                    touchStartXRef.current = e.touches?.[0]?.clientX ?? null
                  }}
                  onTouchEnd={(e) => {
                    if (!homeSpecialSwipeEnabled || specials.length <= 1) return
                    const startX = touchStartXRef.current
                    const endX = e.changedTouches?.[0]?.clientX ?? null
                    touchStartXRef.current = null
                    if (startX == null || endX == null) return
                    const delta = endX - startX
                    if (Math.abs(delta) < homeSpecialSwipeThresholdPx) return
                    if (delta < 0) nextSpecial()
                    else prevSpecial()
                  }}
                  style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'rgba(128,128,128,0.3)' }}
                >
                  <ProductThumbnail src={p.thumb_img} alt={p.name || ''} fill objectFit="cover" />
                  {homeSpecialManualNavEnabled && specials.length > 1 && (
                    <>
                      <button type="button" onClick={(e) => { e.stopPropagation(); prevSpecial() }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>‹</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); nextSpecial() }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 999, border: '1px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontWeight: 900, cursor: 'pointer' }}>›</button>
                    </>
                  )}
                  {homeSpecialShowTimer && p.is_flash_sale && p.flash_sale_end && (
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      background: (() => {
                        const remainMin = (new Date(p.flash_sale_end).getTime() - nowTs) / (1000 * 60)
                        if (remainMin <= 0) return 'rgba(128,128,128,0.9)'
                        if (remainMin <= flashUrgentMinutes) return '#d94f4f'
                        return 'linear-gradient(135deg,#d79ee8,#c9a84c)'
                      })(),
                      color: '#fff',
                      borderRadius: 999,
                      padding: '4px 9px',
                      fontSize: 10,
                      fontWeight: 800,
                    }}>
                      {(() => {
                        const txt = formatRemain(String(p.flash_sale_end))
                        const remainMin = (new Date(p.flash_sale_end).getTime() - nowTs) / (1000 * 60)
                        if (txt === '종료됨') return '종료됨'
                        if (remainMin <= flashUrgentMinutes) return `🔥 ${txt}`
                        return `⏱ ${txt}`
                      })()}
                    </div>
                  )}
                </div>
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{normalizeBrandName(p)}</div>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 700, lineHeight: 1.3, minHeight: 32, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{p.name}</div>
                  {p.is_flash_sale && p.flash_sale_price && p.flash_sale_end && new Date(p.flash_sale_end).getTime() > nowTs ? (
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'line-through' }}>₩{toNum(p.retail_price).toLocaleString()}</span>
                      <span style={{ fontSize: 13, color: '#ff6b6b', fontWeight: 900, marginLeft: 6 }}>₩{toNum(p.flash_sale_price).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>₩{toNum(p.retail_price).toLocaleString()}</div>
                  )}
                  <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6, fontSize: 11, color: '#ffd98a', minHeight: 28 }}>
                    {`${buyerBadge(specialMeta[p.id]?.buyers || 0)} ${specialMeta[p.id]?.hook || ''}`.trim()}
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(p.id) }} style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', borderRadius: 8, color: '#fff', fontSize: 11, padding: '7px 0' }}>🛒 담기</button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openGift(p) }} style={{ border: '1px solid rgba(140,180,255,0.4)', background: 'rgba(140,180,255,0.12)', borderRadius: 8, color: '#bcd6ff', fontSize: 11, padding: '7px 0' }}>🎁 선물</button>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); logAction('buy_click', { productId: p.id, source: 'special' }); router.push(`/checkout?products=${p.id}`) }} style={{ border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', borderRadius: 8, fontSize: 11, padding: '7px 0' }}>⚡ 구매</button>
                  </div>
                </div>
                    </>
                  )
                })()}
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            {specials.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSpecialResumeAt(Date.now() + homeSpecialResumeDelaySec * 1000)
                  setSpecialIndex(idx)
                  logAction('special_dot_click', { index: idx })
                }}
                style={{ width: 8, height: 8, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: idx === specialIndex ? '#c9a84c' : 'rgba(255,255,255,0.25)' }}
              />
            ))}
          </div>
        </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10 }}>내 지역 인기 관리샵</div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {stores.map((s: any, idx) => (
              <div key={s.id || idx} style={{ width: 180, flexShrink: 0, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', padding: 10 }}>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{s.name || s.store_name || `스토어 ${idx + 1}`}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>{s.address || s.region || ''}</div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--gold)' }}>
                  {Number.isFinite(s.distance_km) ? `${s.distance_km.toFixed(1)}km` : ''}
                </div>
              </div>
            ))}
            {/* 위치 권한 없을 때도 기본 좌표로 쿼리 실행되므로 텍스트는 노출하지 않습니다. */}
            {stores.length === 0 ? null : null}
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 10 }}>전체 상품</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 6 }}>
            {BRAND_TABS.map((b) => (
              <button key={b} onClick={() => setBrandTab(b)} style={{ whiteSpace: 'nowrap', borderRadius: 999, border: brandTab === b ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)', background: brandTab === b ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: brandTab === b ? 'var(--gold)' : '#fff', fontSize: 12, padding: '7px 12px' }}>{b}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 10 }}>
            {skinTypeChips.map((c) => (
              <button key={c} onClick={() => setCategoryTab(c)} style={{ whiteSpace: 'nowrap', borderRadius: 999, border: categoryTab === c ? '1px solid rgba(74,141,192,0.55)' : '1px solid var(--border)', background: categoryTab === c ? 'rgba(74,141,192,0.15)' : 'rgba(255,255,255,0.04)', color: categoryTab === c ? '#8bb9dc' : '#fff', fontSize: 12, padding: '7px 12px' }}>{c}</button>
            ))}
          </div>
          {homeSearchEnabled && (
          <div style={{ marginBottom: 10 }}>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={homeSearchPlaceholder}
              style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '0 12px', outline: 'none', fontSize: 12 }}
            />
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {homeSearchShowCount ? (
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>검색 결과 {filteredProducts.length}개</div>
              ) : <div />}
              {!!productSearch && (
                <button type="button" onClick={() => setProductSearch('')} style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', borderRadius: 999, fontSize: 11, padding: '4px 10px' }}>
                  검색 초기화
                </button>
              )}
            </div>
          </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {feedLoading
              ? [1, 2, 3, 4, 5, 6].map(i => (
                  <div
                    key={i}
                    className="auran-skeleton-pulse"
                    style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.25)' }} />
                    <div style={{ padding: 10 }}>
                      <div style={{ height: 10, width: '40%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 8 }} />
                      <div style={{ height: 12, width: '90%', background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 8 }} />
                      <div style={{ height: 12, width: '35%', background: 'rgba(255,255,255,0.08)', borderRadius: 4 }} />
                    </div>
                  </div>
                ))
              : filteredProducts.map((p: any) => (
              <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                <div onClick={() => router.push(`/products/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.2)' }}>
                    <ProductThumbnail src={p.thumb_img} alt={p.name || ''} fill objectFit="cover" />
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{normalizeBrandName(p)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', minHeight: 32 }}>{p.name}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>₩{toNum(p.retail_price).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ padding: '0 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToCart(p.id) }} style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', borderRadius: 8, padding: '8px 0', fontWeight: 700, fontSize: 11 }}>
                    🛒 담기
                  </button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openGift(p) }} style={{ border: '1px solid rgba(140,180,255,0.4)', background: 'rgba(140,180,255,0.12)', color: '#bcd6ff', borderRadius: 8, padding: '8px 0', fontWeight: 700, fontSize: 11 }}>
                    🎁 선물
                  </button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); logAction('buy_click', { productId: p.id, source: 'all-products' }); router.push(`/checkout?products=${p.id}`) }} style={{ border: '1px solid rgba(201,168,76,0.45)', background: 'rgba(201,168,76,0.1)', color: 'var(--gold)', borderRadius: 8, padding: '8px 0', fontWeight: 700, fontSize: 11 }}>
                    ⚡ 구매
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {giftOpen && (
        <div onClick={() => setGiftOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 130 }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 0, width: '100%', maxWidth: 480, background: '#11161b', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderTop: '1px solid var(--border)', padding: 14 }}>
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, marginBottom: 8 }}>오랜일촌에게 선물하기</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {friends.map((f: any) => (
                <button key={f.id} onClick={() => setSelectedFriendId(String(f.id))} style={{ minWidth: 92, borderRadius: 10, border: selectedFriendId === String(f.id) ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)', background: selectedFriendId === String(f.id) ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', color: '#fff', padding: 8 }}>
                  <div style={{ width: 36, height: 36, margin: '0 auto', borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
                    {f.avatar_url ? <img src={f.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                </button>
              ))}
            </div>
            <textarea value={giftMessage} maxLength={giftMsgMax} onChange={e => setGiftMessage(e.target.value)} placeholder="메시지를 남겨보세요" style={{ width: '100%', minHeight: 70, marginTop: 8, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)', color: '#fff', padding: 10, resize: 'none' }} />
            <button onClick={sendGift} style={{ marginTop: 10, width: '100%', height: 40, borderRadius: 10, border: 'none', background: '#c9a84c', color: '#111', fontWeight: 900 }}>선물하기</button>
          </div>
        </div>
      )}

      <DashboardBottomNav role="customer" />
    </div>
  )
}
