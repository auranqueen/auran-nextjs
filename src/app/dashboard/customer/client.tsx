'use client'

import { useEffect, useMemo, useState } from 'react'
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

const SKIN_CONCERNS = [
  { emoji: '💧', label: '속당김·건조' },
  { emoji: '🔥', label: '민감·홍조' },
  { emoji: '✨', label: '미백·기미' },
  { emoji: '💪', label: '탄력·안티에이징' },
  { emoji: '🌊', label: '수분·모공' },
  { emoji: '☀️', label: '자외선차단' },
]

function toNum(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normalizeBrandName(p: any) {
  return (p.brand_name || p.brands?.name || '').toString()
}

function Countdown({ endsAt }: { endsAt: string }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setTime('종료')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTime(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [endsAt])
  return (
    <span
      style={{
        background: '#C9A96E',
        color: '#000',
        padding: '4px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      ⏰ {time}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div
      className="home-shimmer-card"
      style={{
        width: 140,
        height: 200,
        borderRadius: 12,
      }}
    />
  )
}

function HomeProductRowCard({
  p,
  router,
  onCart,
  newBadge,
}: {
  p: any
  router: ReturnType<typeof useRouter>
  onCart: (id: string) => void
  newBadge?: boolean
}) {
  const price = toNum(p.retail_price)
  return (
    <div
      style={{
        width: 140,
        flexShrink: 0,
        border: '1px solid var(--border)',
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      <div onClick={() => router.push(`/products/${p.id}`)} style={{ cursor: 'pointer' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.2)' }}>
          <ProductThumbnail src={p.thumb_img} alt={p.name || ''} fill objectFit="cover" />
          {newBadge ? (
            <div
              style={{
                position: 'absolute',
                top: 6,
                left: 6,
                background: 'linear-gradient(135deg,#ff6b6b,#c9a84c)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 900,
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              NEW
            </div>
          ) : null}
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {normalizeBrandName(p)}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              minHeight: 32,
              display: '-webkit-box',
              WebkitLineClamp: 2 as any,
              WebkitBoxOrient: 'vertical' as any,
              overflow: 'hidden',
            }}
          >
            {p.name}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>₩{price.toLocaleString()}</div>
        </div>
      </div>
      <div style={{ padding: '0 8px 8px' }}>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onCart(p.id)
          }}
          style={{
            width: '100%',
            border: '1px solid rgba(201,168,76,0.35)',
            background: 'rgba(201,168,76,0.1)',
            color: 'var(--gold)',
            borderRadius: 8,
            fontSize: 11,
            padding: '6px 0',
            fontWeight: 700,
          }}
        >
          🛒 담기
        </button>
      </div>
    </div>
  )
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

  const [homeInitLoading, setHomeInitLoading] = useState(true)
  const [wallet, setWallet] = useState({ points: toNum(profile?.points), balance: toNum(profile?.charge_balance) })
  const [brandTab, setBrandTab] = useState('전체')
  const [categoryTab, setCategoryTab] = useState('전체')
  const [productSearch, setProductSearch] = useState('')
  const [products, setProducts] = useState<any[]>([])
  const [meId, setMeId] = useState<string>('')
  const [toast, setToast] = useState('')
  const [giftOpen, setGiftOpen] = useState(false)
  const [giftTargetProduct, setGiftTargetProduct] = useState<any | null>(null)
  const [giftMessage, setGiftMessage] = useState('')
  const [friends, setFriends] = useState<any[]>([])
  const [selectedFriendId, setSelectedFriendId] = useState('')

  const [bannerSlides, setBannerSlides] = useState<{ image: string; caption: string }[]>([])
  const [bannerIdx, setBannerIdx] = useState(0)
  const [timesaleProducts, setTimesaleProducts] = useState<any[]>([])
  const [brandLogos, setBrandLogos] = useState<{ id: string; name: string; logo_url: string }[]>([])
  const [curationBlocks, setCurationBlocks] = useState<{ section: any; products: any[] }[]>([])
  const [newProducts, setNewProducts] = useState<any[]>([])
  const [recentReviews, setRecentReviews] = useState<any[]>([])

  const giftEnabled = getSettingNum('gift', 'gift_enabled', 1) === 1
  const giftMsgMax = getSettingNum('gift', 'gift_message_max_length', 100)
  const giftNotifyEnabled = getSettingNum('gift', 'gift_notification_enabled', 1) === 1
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

  const logAction = (type: string, detail: Record<string, any> = {}) => {
    console.log(`[home-action] ${type} ${JSON.stringify(detail)}`)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.history.pushState(null, '', window.location.href)
    const onPop = () => {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!homeSearchSyncToUrl || typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const q = params.get(homeSearchQueryParam) || ''
    if (q) setProductSearch(q)
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
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

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
    let cancelled = false
    ;(async () => {
      setHomeInitLoading(true)
      const nowIso = new Date().toISOString()
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

      const [
        bannerRes,
        curationRes,
        productsRes,
        timesaleRes,
        brandsRes,
        newRes,
        reviewsRes,
      ] = await Promise.all([
        supabase.from('admin_settings').select('*').eq('category', 'home_banner').order('sort_order', { ascending: true }),
        supabase.from('admin_settings').select('*').eq('category', 'home_curation').order('sort_order', { ascending: true }),
        supabase.from('products').select('*, brands(name)').eq('status', 'active').limit(80),
        supabase
          .from('products')
          .select('*, brands(name)')
          .eq('is_timesale', true)
          .eq('status', 'active')
          .gt('timesale_ends_at', nowIso)
          .limit(10),
        supabase.from('brands').select('id, name, logo_url').not('logo_url', 'is', null).limit(10),
        supabase
          .from('products')
          .select('*, brands(name)')
          .eq('status', 'active')
          .gte('created_at', weekAgo)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('reviews')
          .select('id,rating,content,target_id,created_at')
          .eq('review_type', 'product')
          .eq('status', '게시')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (cancelled) return

      const slides = (bannerRes.data || [])
        .filter((r: any) => r.is_active !== false && String(r.value || '').trim())
        .sort((a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
        .map((r: any) => ({ image: String(r.value), caption: String(r.label || '') }))

      if (slides.length === 0) {
        setBannerSlides([
          {
            image:
              'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=80',
            caption: 'AURAN',
          },
        ])
      } else {
        setBannerSlides(slides)
      }

      let list: any[] = []
      if (!productsRes.error) {
        list = (productsRes.data || []).map((p: any) => ({ ...p, brand_name: p.brands?.name || '' }))
      } else {
        const { data: fallbackData, error: fallbackError } = await supabase.from('products').select('*').eq('status', 'active').limit(40)
        if (fallbackError) console.warn('[customer-home products fallback error]', fallbackError)
        list = (fallbackData || []).map((p: any) => ({ ...p, brand_name: p.brand_name || '' }))
      }
      setProducts(list)

      const ts = (timesaleRes.data || []).map((p: any) => ({ ...p, brand_name: p.brands?.name || '' }))
      setTimesaleProducts(ts)

      setBrandLogos((brandsRes.data || []) as { id: string; name: string; logo_url: string }[])

      const newP = (newRes.data || []).map((p: any) => ({ ...p, brand_name: p.brands?.name || '' }))
      setNewProducts(newP)

      const revs = reviewsRes.data || []
      const pids = Array.from(new Set(revs.map(r => r.target_id).filter(Boolean))) as string[]
      let revRows = revs
      if (pids.length) {
        const { data: pn } = await supabase.from('products').select('id,name').in('id', pids)
        const map: Record<string, string> = Object.fromEntries((pn || []).map(p => [p.id, p.name]))
        revRows = revs.map(r => ({ ...r, product_name: map[r.target_id as string] || '제품' }))
      } else {
        revRows = revs.map(r => ({ ...r, product_name: '제품' }))
      }
      setRecentReviews(revRows)

      const rawSections = (curationRes.data || []).filter((r: any) => r.is_active !== false)
      const sortedSections = [...rawSections].sort(
        (a: any, b: any) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
      )
      const blocks = await Promise.all(
        sortedSections.map(async section => {
          const skinType = String(section.value || '').trim()
          if (!skinType) return { section, products: [] as any[] }
          const { data: prods } = await supabase
            .from('products')
            .select('*, brands(name)')
            .contains('skin_types', [skinType])
            .eq('status', 'active')
            .limit(4)
          return {
            section,
            products: (prods || []).map((p: any) => ({ ...p, brand_name: p.brands?.name || '' })),
          }
        })
      )
      if (!cancelled) setCurationBlocks(blocks)

      setHomeInitLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (bannerSlides.length <= 1) return
    const t = setInterval(() => {
      setBannerIdx(i => (i + 1) % bannerSlides.length)
    }, 3000)
    return () => clearInterval(t)
  }, [bannerSlides.length])

  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const brandName = normalizeBrandName(p)
      const search = productSearch.trim().toLowerCase()
      const skinTypes = Array.isArray(p.skin_types) ? p.skin_types : []
      const brandOk = brandTab === '전체' || brandName.toLowerCase() === brandTab.toLowerCase()
      const categoryOk = categoryTab === '전체' || skinTypes.includes(categoryTab)
      const searchActive = search.length >= homeSearchMinChars
      const inName = homeSearchFields.includes('name') && String(p.name || '').toLowerCase().includes(search)
      const inDescription =
        homeSearchFields.includes('description') && String(p.description || '').toLowerCase().includes(search)
      const inBrand = homeSearchFields.includes('brand') && brandName.toLowerCase().includes(search)
      const searchOk = !searchActive || inName || inDescription || inBrand
      return brandOk && categoryOk && searchOk
    })
  }, [products, brandTab, categoryTab, productSearch, homeSearchFields, homeSearchMinChars])

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

  const currentBanner = bannerSlides[bannerIdx % Math.max(1, bannerSlides.length)] || bannerSlides[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', maxWidth: 480, margin: '0 auto', paddingBottom: 120 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backdropFilter: 'blur(12px)',
          background: 'rgba(10,12,15,0.92)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 20, color: '#fff', letterSpacing: 2 }}>AURAN</div>
        <CustomerHeaderRight />
      </div>

      <div style={{ padding: '0 0 16px' }}>
        {toast && (
          <div
            style={{
              margin: '12px 16px 0',
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
        )}

        {/* 1. 배너 슬라이더 */}
        <div style={{ marginTop: 16, position: 'relative', width: '100%', aspectRatio: '2 / 1', background: '#111' }}>
          {homeInitLoading ? (
            <div className="home-shimmer-card" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
          ) : currentBanner ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentBanner.image}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '14px 16px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 800,
                }}
              >
                {currentBanner.caption}
              </div>
            </>
          ) : null}
          {bannerSlides.length > 1 ? (
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {bannerSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setBannerIdx(i)}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    border: 'none',
                    padding: 0,
                    background: i === bannerIdx ? '#c9a84c' : 'rgba(255,255,255,0.35)',
                  }}
                  aria-label={`배너 ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>안녕하세요, {profile?.name || '고객'}님</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>오늘도 아름다운 하루를 시작해요.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 16px 0' }}>
          <div style={{ border: '1px solid rgba(201,168,76,0.28)', background: 'rgba(201,168,76,0.1)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(201,168,76,0.75)' }}>포인트</div>
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: 'var(--gold)' }}>
              {wallet.points.toLocaleString()}P
            </div>
          </div>
          <div style={{ border: '1px solid rgba(76,173,126,0.28)', background: 'rgba(76,173,126,0.1)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontSize: 10, color: 'rgba(76,173,126,0.75)' }}>충전 잔액</div>
            <div style={{ marginTop: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: '#4cad7e' }}>
              ₩{wallet.balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 2. AI 피부분석 CTA */}
        <div style={{ marginTop: 16 }}>
          <div
            onClick={() => router.push('/skin-analysis')}
            style={{
              margin: '0 16px',
              padding: '16px 20px',
              background: 'linear-gradient(135deg, #C9A96E, #D4A97A)',
              borderRadius: 16,
              cursor: 'pointer',
            }}
          >
            <p style={{ color: '#000', fontWeight: 700, fontSize: 16 }}>✨ 내 피부타입 분석하기</p>
            <p style={{ color: '#333', fontSize: 13, marginTop: 4 }}>AI가 맞춤 제품을 추천해드려요</p>
          </div>
        </div>

        {/* 3. 피부고민 태그 */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            padding: '16px 16px 0',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch' as any,
          }}
        >
          {SKIN_CONCERNS.map(c => (
            <button
              key={c.label}
              type="button"
              onClick={() => router.push(`/products?concern=${encodeURIComponent(c.label)}`)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: 20,
                border: '1px solid #333',
                background: '#1a1a1a',
                color: '#fff',
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* 4. 타임세일 */}
        <section style={{ marginTop: 20, padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>⚡ 타임세일</span>
          </div>
          {homeInitLoading ? (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {[1, 2, 3].map(i => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : timesaleProducts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', paddingBottom: 8 }}>진행 중인 타임세일이 없어요</div>
          ) : (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {timesaleProducts.map(p => (
                <div
                  key={p.id}
                  style={{
                    width: 160,
                    flexShrink: 0,
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}
                >
                  <div onClick={() => router.push(`/products/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: 'rgba(0,0,0,0.2)' }}>
                      <ProductThumbnail src={p.thumb_img} alt={p.name || ''} fill objectFit="cover" />
                      {p.timesale_ends_at ? (
                        <div style={{ position: 'absolute', top: 8, right: 8 }}>
                          <Countdown endsAt={p.timesale_ends_at} />
                        </div>
                      ) : null}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{normalizeBrandName(p)}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginTop: 4, lineHeight: 1.3, minHeight: 32 }}>{p.name}</div>
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)', textDecoration: 'line-through' }}>
                          ₩{toNum(p.retail_price).toLocaleString()}
                        </span>
                        <span style={{ fontSize: 14, color: '#ff6b6b', fontWeight: 900 }}>
                          ₩{toNum(p.sale_price ?? p.retail_price).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '0 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        addToCart(p.id)
                      }}
                      style={{
                        border: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        borderRadius: 8,
                        fontSize: 11,
                        padding: '7px 0',
                      }}
                    >
                      🛒 담기
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        logAction('buy_click', { productId: p.id, source: 'timesale' })
                        router.push(`/checkout?products=${p.id}`)
                      }}
                      style={{
                        border: '1px solid rgba(201,168,76,0.45)',
                        background: 'rgba(201,168,76,0.1)',
                        color: 'var(--gold)',
                        borderRadius: 8,
                        fontSize: 11,
                        padding: '7px 0',
                      }}
                    >
                      ⚡ 구매
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 5. 브랜드관 */}
        <section style={{ marginTop: 20, padding: '0 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 12 }}>브랜드관</div>
          {homeInitLoading ? (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="home-shimmer-card"
                  style={{ width: 64, height: 64, borderRadius: 999, flexShrink: 0 }}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
              {brandLogos.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => router.push(`/products?brandFilter=${encodeURIComponent(b.id)}`)}
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.06)',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                  title={b.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.logo_url} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 6. 큐레이션 */}
        {homeInitLoading
          ? [1, 2].map(i => (
              <section key={i} style={{ padding: '0 16px', marginTop: 24 }}>
                <div className="home-shimmer-card" style={{ width: '60%', height: 20, borderRadius: 8, marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              </section>
            ))
          : curationBlocks.map(({ section, products: cProducts }) => (
              <section key={String(section.key ?? section.id)} style={{ padding: '0 16px', marginBottom: 24, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ color: '#888', fontSize: 11, letterSpacing: '0.12em' }}>PRODUCTS</p>
                    <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginTop: 4 }}>{section.label}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/products?skin=${encodeURIComponent(section.value)}`)}
                    style={{ color: '#C9A96E', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                  >
                    전체보기 &gt;
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    WebkitOverflowScrolling: 'touch' as any,
                  }}
                >
                  {cProducts.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>이 섹션에 표시할 상품이 없어요</div>
                  ) : (
                    cProducts.map(p => (
                      <HomeProductRowCard key={p.id} p={p} router={router} onCart={addToCart} />
                    ))
                  )}
                </div>
              </section>
            ))}

        {/* 7. 신제품 */}
        <section style={{ padding: '0 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 12 }}>🆕 신제품</div>
          {homeInitLoading ? (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
              {[1, 2, 3].map(i => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : newProducts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>최근 일주일 신제품이 없어요</div>
          ) : (
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {newProducts.map(p => (
                <HomeProductRowCard key={p.id} p={p} router={router} onCart={addToCart} newBadge />
              ))}
            </div>
          )}
        </section>

        {/* 8. 실시간 리뷰 */}
        <section style={{ padding: '0 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 12 }}>💬 실시간 리뷰</div>
          {homeInitLoading ? (
            <div className="home-shimmer-card" style={{ width: '100%', height: 88, borderRadius: 12 }} />
          ) : recentReviews.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>아직 등록된 리뷰가 없어요</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentReviews.map(r => (
                <div
                  key={r.id}
                  onClick={() => r.target_id && router.push(`/products/${r.target_id}`)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    padding: 12,
                    cursor: r.target_id ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 4 }}>
                    {'★'.repeat(Math.min(5, Math.max(0, r.rating || 0)))}
                    <span style={{ color: 'var(--text3)', marginLeft: 8, fontSize: 11 }}>{r.product_name}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.5 }}>
                    {(r.content || '').slice(0, 120)}
                    {(r.content || '').length > 120 ? '…' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 9. 전체 제품 */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 12 }}>전체 제품</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 6, scrollbarWidth: 'none' }}>
            {BRAND_TABS.map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBrandTab(b)}
                style={{
                  whiteSpace: 'nowrap',
                  borderRadius: 999,
                  border: brandTab === b ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)',
                  background: brandTab === b ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                  color: brandTab === b ? 'var(--gold)' : '#fff',
                  fontSize: 12,
                  padding: '7px 12px',
                }}
              >
                {b}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 10, scrollbarWidth: 'none' }}>
            {skinTypeChips.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryTab(c)}
                style={{
                  whiteSpace: 'nowrap',
                  borderRadius: 999,
                  border: categoryTab === c ? '1px solid rgba(74,141,192,0.55)' : '1px solid var(--border)',
                  background: categoryTab === c ? 'rgba(74,141,192,0.15)' : 'rgba(255,255,255,0.04)',
                  color: categoryTab === c ? '#8bb9dc' : '#fff',
                  fontSize: 12,
                  padding: '7px 12px',
                }}
              >
                {c}
              </button>
            ))}
          </div>
          {homeSearchEnabled && (
            <div style={{ marginBottom: 10 }}>
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder={homeSearchPlaceholder}
                style={{
                  width: '100%',
                  height: 38,
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  padding: '0 12px',
                  outline: 'none',
                  fontSize: 12,
                }}
              />
              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {homeSearchShowCount ? (
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>검색 결과 {filteredProducts.length}개</div>
                ) : (
                  <div />
                )}
                {!!productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#fff',
                      borderRadius: 999,
                      fontSize: 11,
                      padding: '4px 10px',
                    }}
                  >
                    검색 초기화
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {homeInitLoading
              ? [1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="auran-skeleton-pulse" style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
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
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--gold)', fontWeight: 800 }}>
                          ₩{toNum(p.retail_price).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '0 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          addToCart(p.id)
                        }}
                        style={{
                          border: '1px solid var(--border)',
                          background: 'rgba(255,255,255,0.04)',
                          color: '#fff',
                          borderRadius: 8,
                          padding: '8px 0',
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        🛒 담기
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          openGift(p)
                        }}
                        style={{
                          border: '1px solid rgba(140,180,255,0.4)',
                          background: 'rgba(140,180,255,0.12)',
                          color: '#bcd6ff',
                          borderRadius: 8,
                          padding: '8px 0',
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        🎁 선물
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          logAction('buy_click', { productId: p.id, source: 'all-products' })
                          router.push(`/checkout?products=${p.id}`)
                        }}
                        style={{
                          border: '1px solid rgba(201,168,76,0.45)',
                          background: 'rgba(201,168,76,0.1)',
                          color: 'var(--gold)',
                          borderRadius: 8,
                          padding: '8px 0',
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
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
          <div
            onClick={e => e.stopPropagation()}
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
              padding: 14,
            }}
          >
            <div style={{ fontSize: 14, color: '#fff', fontWeight: 800, marginBottom: 8 }}>오랜일촌에게 선물하기</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
              {friends.map((f: any) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFriendId(String(f.id))}
                  style={{
                    minWidth: 92,
                    borderRadius: 10,
                    border: selectedFriendId === String(f.id) ? '1px solid rgba(201,168,76,0.55)' : '1px solid var(--border)',
                    background: selectedFriendId === String(f.id) ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    padding: 8,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      margin: '0 auto',
                      borderRadius: 999,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.08)',
                    }}
                  >
                    {f.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                </button>
              ))}
            </div>
            <textarea
              value={giftMessage}
              maxLength={giftMsgMax}
              onChange={e => setGiftMessage(e.target.value)}
              placeholder="메시지를 남겨보세요"
              style={{
                width: '100%',
                minHeight: 70,
                marginTop: 8,
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                padding: 10,
                resize: 'none',
              }}
            />
            <button
              type="button"
              onClick={sendGift}
              style={{
                marginTop: 10,
                width: '100%',
                height: 40,
                borderRadius: 10,
                border: 'none',
                background: '#c9a84c',
                color: '#111',
                fontWeight: 900,
              }}
            >
              선물하기
            </button>
          </div>
        </div>
      )}

      <DashboardBottomNav role="customer" />
    </div>
  )
}
