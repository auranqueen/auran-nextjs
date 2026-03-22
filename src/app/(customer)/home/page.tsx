'use client'

/**
 * 고객 홈 — 데이터 소스 (Supabase)
 * TODO: user_daily_tracker — 루틴·수분·뷰티 트래커·인사말 보조 지표
 * TODO: user_wallets — AURAN POINT 토스트
 * TODO: friend_activities — 일촌 피드
 * TODO: reviews.is_best, reviews.helpful_count — 어드민 플래그·도움돼요 카운트 (컬럼 추가 시 아래 쿼리/업데이트 연동)
 * TODO: products.is_new, products.skin_concern_id — 신제품·고민별 랭킹 정밀 필터
 * TODO: user_products — 구매 히스토리 (테이블 생성·RLS 후 연동)
 * TODO: salons.is_open — 영업중 표시 (컬럼 추가 시 교체)
 */

import Link from 'next/link'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Cormorant_Garamond, DM_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'

const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400'], display: 'swap' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400'], display: 'swap' })

type ProfileRow = { id: string; name: string; avatar_url: string | null }
type BannerRow = {
  id: string
  title: string
  subtitle: string | null
  emoji: string | null
  gradient_from: string | null
  gradient_to: string | null
  link_url: string | null
  sort_order: number | null
}
type SkinConcernRow = { id: string; name: string; icon: string; sort_order: number | null }
type ProductWithBrand = {
  id: string
  name: string
  retail_price: number
  thumb_img: string | null
  tag: string | null
  skin_types: string[] | null
  /** Supabase FK 조인 — 런타임은 단일 객체, 생성 타입이 배열로 잡히는 경우 있음 */
  brands: { name: string } | { name: string }[] | null
}
type ReviewRow = {
  id: string
  content: string | null
  rating: number
  target_id: string
  helpful_count?: number | null
  is_best?: boolean | null
}
type TimeSaleRow = {
  id: string
  discount_rate: number
  original_price: number
  sale_price: number
  ends_at: string
  products:
    | { id: string; name: string; thumb_img: string | null; retail_price: number }
    | { id: string; name: string; thumb_img: string | null; retail_price: number }[]
    | null
}
type GroupBuyRow = {
  id: string
  target_count: number
  current_count: number | null
  discount_rate: number
  original_price: number
  group_price: number
  ends_at: string
  products:
    | { id: string; name: string; thumb_img: string | null; retail_price: number }
    | { id: string; name: string; thumb_img: string | null; retail_price: number }[]
    | null
}
type SalonRow = {
  id: string
  name: string
  area: string | null
  avatar_url: string | null
  status: string
  avg_rating: number | null
}
type RefillRow = {
  id: string
  usage_percent: number | null
  alert_threshold: number | null
  products: { id: string; name: string; thumb_img: string | null } | { id: string; name: string; thumb_img: string | null }[] | null
}
type BrandRow = { id: string; name: string; logo_url: string | null; origin: string | null }

function cx(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

function pickBrandName(b: ProductWithBrand['brands']): string {
  if (!b) return '—'
  return Array.isArray(b) ? (b[0]?.name ?? '—') : b.name
}

function pickOne<T>(p: T | T[] | null | undefined): T | null {
  if (p == null) return null
  return Array.isArray(p) ? (p[0] ?? null) : p
}

function HScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'flex gap-3 overflow-x-auto pb-2',
        '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-[14px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-[rgba(255,255,255,0.06)]', className)} />
}

export default function CustomerHomePage() {
  const supabase = useMemo(() => createClient(), [])

  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [banners, setBanners] = useState<BannerRow[]>([])
  const [bannersLoading, setBannersLoading] = useState(true)
  const [bannerIdx, setBannerIdx] = useState(0)

  const [skinLatest, setSkinLatest] = useState<{ id: string; skin_score: number | null; skin_type: string | null } | null>(
    null,
  )
  const [skinLoading, setSkinLoading] = useState(true)

  const [aiProducts, setAiProducts] = useState<ProductWithBrand[]>([])
  const [aiLoading, setAiLoading] = useState(true)

  const [concerns, setConcerns] = useState<SkinConcernRow[]>([])
  const [concernsLoading, setConcernsLoading] = useState(true)
  const [selectedConcernId, setSelectedConcernId] = useState<string | null>(null)

  const [bestProducts, setBestProducts] = useState<ProductWithBrand[]>([])
  const [bestLoading, setBestLoading] = useState(true)

  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewIdx, setReviewIdx] = useState(0)
  const [helpfulLocal, setHelpfulLocal] = useState<Record<string, number>>({})

  const [promoTab, setPromoTab] = useState<'timesale' | 'group'>('timesale')
  const [timeSales, setTimeSales] = useState<TimeSaleRow[]>([])
  const [groupBuys, setGroupBuys] = useState<GroupBuyRow[]>([])
  const [promoLoading, setPromoLoading] = useState(true)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const [salons, setSalons] = useState<SalonRow[]>([])
  const [salonsLoading, setSalonsLoading] = useState(true)
  const [salonArea, setSalonArea] = useState<string>('전체')

  const [refills, setRefills] = useState<RefillRow[]>([])
  const [refillsLoading, setRefillsLoading] = useState(true)

  const [historyRows, setHistoryRows] = useState<{ product_id: string; products: ProductWithBrand | null }[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const [newProducts, setNewProducts] = useState<ProductWithBrand[]>([])
  const [newLoading, setNewLoading] = useState(true)

  const [brands, setBrands] = useState<BrandRow[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [brandOriginTab, setBrandOriginTab] = useState<string>('전체')

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const todayLabel = useMemo(() => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(new Date())
  }, [])

  const selectedConcern = useMemo(
    () => concerns.find((c) => c.id === selectedConcernId) ?? null,
    [concerns, selectedConcernId],
  )

  useEffect(() => {
    tickRef.current = setInterval(() => setNowTick(Date.now()), 1000)
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setProfileLoading(true)
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData.session?.user?.id
        if (!uid) {
          if (alive) {
            setProfile(null)
            setProfileLoading(false)
          }
          return
        }
        const { data, error } = await supabase.from('users').select('id, name, avatar_url').eq('auth_id', uid).maybeSingle()
        if (error) throw error
        if (alive) setProfile(data as ProfileRow)
      } catch {
        if (alive) setProfile(null)
      } finally {
        if (alive) setProfileLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setBannersLoading(true)
        const { data, error } = await supabase
          .from('banners')
          .select('id, title, subtitle, emoji, gradient_from, gradient_to, link_url, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
        if (error) throw error
        if (alive) setBanners((data as BannerRow[]) ?? [])
      } catch {
        if (alive) setBanners([])
      } finally {
        if (alive) setBannersLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setSkinLoading(true)
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData.session?.user?.id
        if (!uid) {
          if (alive) setSkinLatest(null)
          return
        }
        const { data: u } = await supabase.from('users').select('id').eq('auth_id', uid).maybeSingle()
        if (!u?.id) {
          if (alive) setSkinLatest(null)
          return
        }
        const { data, error } = await supabase
          .from('skin_analyses')
          .select('id, skin_score, skin_type')
          .eq('user_id', u.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (alive) setSkinLatest(data as { id: string; skin_score: number | null; skin_type: string | null } | null)
      } catch {
        if (alive) setSkinLatest(null)
      } finally {
        if (alive) setSkinLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setAiLoading(true)
        const { data, error } = await supabase
          .from('products')
          .select('id, name, retail_price, thumb_img, tag, skin_types, brands(name)')
          .eq('status', 'active')
          .or('tag.ilike.%AI%,tag.ilike.%추천%,category.ilike.%AI%')
          .limit(24)
        if (error) throw error
        if (alive) setAiProducts((data as unknown as ProductWithBrand[]) ?? [])
      } catch {
        try {
          const { data: d2 } = await supabase
            .from('products')
            .select('id, name, retail_price, thumb_img, tag, skin_types, brands(name)')
            .eq('status', 'active')
            .order('sales_count', { ascending: false })
            .limit(24)
          if (alive) setAiProducts((d2 as unknown as ProductWithBrand[]) ?? [])
        } catch {
          if (alive) setAiProducts([])
        }
      } finally {
        if (alive) setAiLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setConcernsLoading(true)
        const { data, error } = await supabase
          .from('skin_concerns')
          .select('id, name, icon, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
        if (error) throw error
        const rows = (data as SkinConcernRow[]) ?? []
        if (alive) {
          setConcerns(rows)
          if (rows.length) setSelectedConcernId((prev) => prev ?? rows[0]!.id)
        }
      } catch {
        if (alive) setConcerns([])
      } finally {
        if (alive) setConcernsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  const loadBest = useCallback(async () => {
    const concern = concerns.find((c) => c.id === selectedConcernId)
    try {
      setBestLoading(true)
      let q = supabase
        .from('products')
        .select('id, name, retail_price, thumb_img, tag, skin_types, brands(name)')
        .eq('status', 'active')
        .order('sales_count', { ascending: false })
        .limit(24)
      if (concern?.name) {
        q = q.contains('skin_types', [concern.name])
      }
      const { data, error } = await q
      if (error) throw error
      let rows = (data as unknown as ProductWithBrand[]) ?? []
      if (concern && rows.length === 0) {
        const { data: d2 } = await supabase
          .from('products')
          .select('id, name, retail_price, thumb_img, tag, skin_types, brands(name)')
          .eq('status', 'active')
          .ilike('category', `%${concern.name}%`)
          .limit(24)
        rows = (d2 as unknown as ProductWithBrand[]) ?? []
      }
      setBestProducts(rows)
    } catch {
      setBestProducts([])
    } finally {
      setBestLoading(false)
    }
  }, [concerns, selectedConcernId, supabase])

  useEffect(() => {
    void loadBest()
  }, [loadBest])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setReviewsLoading(true)
        const r1 = await supabase
          .from('reviews')
          .select('id, content, rating, target_id, helpful_count, is_best')
          .eq('review_type', 'product')
          .eq('status', '게시')
          .eq('is_best', true)
          .order('created_at', { ascending: false })
          .limit(30)
        let list: ReviewRow[] = []
        if (!r1.error && r1.data?.length) {
          list = r1.data as unknown as ReviewRow[]
        } else {
          const r2 = await supabase
            .from('reviews')
            .select('id, content, rating, target_id')
            .eq('review_type', 'product')
            .eq('status', '게시')
            .order('created_at', { ascending: false })
            .limit(30)
          list = (r2.data as unknown as ReviewRow[]) ?? []
        }
        if (alive) setReviews(list)
      } catch {
        if (alive) setReviews([])
      } finally {
        if (alive) setReviewsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    if (reviews.length <= 1) return
    const t = setInterval(() => {
      setReviewIdx((i) => (i + 1) % reviews.length)
    }, 5000)
    return () => clearInterval(t)
  }, [reviews.length])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setPromoLoading(true)
        const [ts, gb] = await Promise.all([
          supabase
            .from('time_sales')
            .select('id, discount_rate, original_price, sale_price, ends_at, products(id, name, thumb_img, retail_price)')
            .eq('is_active', true)
            .order('ends_at', { ascending: true }),
          supabase
            .from('group_buys')
            .select(
              'id, target_count, current_count, discount_rate, original_price, group_price, ends_at, products(id, name, thumb_img, retail_price)',
            )
            .eq('is_active', true)
            .order('ends_at', { ascending: true }),
        ])
        if (alive) {
          setTimeSales((ts.data as unknown as TimeSaleRow[]) ?? [])
          setGroupBuys((gb.data as unknown as GroupBuyRow[]) ?? [])
        }
      } catch {
        if (alive) {
          setTimeSales([])
          setGroupBuys([])
        }
      } finally {
        if (alive) setPromoLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setSalonsLoading(true)
        const { data, error } = await supabase
          .from('salons')
          .select('id, name, area, avatar_url, status, avg_rating')
          .eq('status', 'active')
          .order('avg_rating', { ascending: false })
          .limit(40)
        if (error) throw error
        if (alive) setSalons((data as SalonRow[]) ?? [])
      } catch {
        if (alive) setSalons([])
      } finally {
        if (alive) setSalonsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setRefillsLoading(true)
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData.session?.user?.id
        if (!uid) {
          if (alive) setRefills([])
          return
        }
        const { data: u } = await supabase.from('users').select('id').eq('auth_id', uid).maybeSingle()
        if (!u?.id) {
          if (alive) setRefills([])
          return
        }
        const { data, error } = await supabase
          .from('refill_alerts')
          .select('id, usage_percent, alert_threshold, products(id, name, thumb_img)')
          .eq('user_id', u.id)
          .eq('is_active', true)
          .limit(20)
        if (error) throw error
        if (alive) setRefills((data as unknown as RefillRow[]) ?? [])
      } catch {
        if (alive) setRefills([])
      } finally {
        if (alive) setRefillsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setHistoryLoading(true)
        const { data: sessionData } = await supabase.auth.getSession()
        const uid = sessionData.session?.user?.id
        if (!uid) {
          if (alive) setHistoryRows([])
          return
        }
        const { data: u } = await supabase.from('users').select('id').eq('auth_id', uid).maybeSingle()
        if (!u?.id) {
          if (alive) setHistoryRows([])
          return
        }
        const { data, error } = await supabase
          .from('user_products')
          .select('product_id, products(id, name, retail_price, thumb_img, tag, skin_types, brands(name))')
          .eq('user_id', u.id)
          .order('updated_at', { ascending: false })
          .limit(4)
        if (error) throw error
        if (alive) {
          const rows = (data as unknown as { product_id: string; products: ProductWithBrand | ProductWithBrand[] | null }[]) ?? []
          setHistoryRows(
            rows
              .map((r) => ({
                product_id: r.product_id,
                products: pickOne(r.products) as ProductWithBrand | null,
              }))
              .filter((r) => r.products),
          )
        }
      } catch {
        if (alive) setHistoryRows([])
      } finally {
        if (alive) setHistoryLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setNewLoading(true)
        const { data, error } = await supabase
          .from('products')
          .select('id, name, retail_price, thumb_img, tag, skin_types, brands(name)')
          .eq('status', 'active')
          .eq('is_new', true)
          .limit(16)
        if (error) throw error
        if (alive) setNewProducts((data as unknown as ProductWithBrand[]) ?? [])
      } catch {
        try {
          const since = new Date()
          since.setDate(since.getDate() - 30)
          const { data: d2 } = await supabase
            .from('products')
            .select('id, name, retail_price, thumb_img, tag, skin_types, brands(name)')
            .eq('status', 'active')
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(16)
          if (alive) setNewProducts((d2 as unknown as ProductWithBrand[]) ?? [])
        } catch {
          if (alive) setNewProducts([])
        }
      } finally {
        if (alive) setNewLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setBrandsLoading(true)
        const { data, error } = await supabase.from('brands').select('id, name, logo_url, origin').eq('status', 'active')
        if (error) throw error
        if (alive) setBrands((data as BrandRow[]) ?? [])
      } catch {
        if (alive) setBrands([])
      } finally {
        if (alive) setBrandsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [supabase])

  const salonAreas = useMemo(() => {
    const s = new Set<string>()
    salons.forEach((x) => {
      if (x.area?.trim()) s.add(x.area.trim())
    })
    return ['전체', ...Array.from(s)]
  }, [salons])

  const filteredSalons = useMemo(() => {
    if (salonArea === '전체') return salons
    return salons.filter((x) => (x.area ?? '').trim() === salonArea)
  }, [salonArea, salons])

  const filteredBrands = useMemo(() => {
    if (brandOriginTab === '전체') return brands
    const map: Record<string, string> = {
      유럽: '유럽',
      국내: '국내',
      일본: '일본',
      클리닉: '클리닉',
      바디: '바디',
    }
    const needle = map[brandOriginTab] ?? brandOriginTab
    return brands.filter((b) => (b.origin ?? '').includes(needle))
  }, [brandOriginTab, brands])

  const formatCountdown = (endsAt: string) => {
    const t = new Date(endsAt).getTime() - nowTick
    if (t <= 0) return '종료'
    const h = Math.floor(t / 3600000)
    const m = Math.floor((t % 3600000) / 60000)
    const s = Math.floor((t % 60000) / 1000)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const onHelpful = async (r: ReviewRow) => {
    try {
      const base = r.helpful_count ?? helpfulLocal[r.id] ?? 0
      const next = base + 1
      setHelpfulLocal((prev) => ({ ...prev, [r.id]: next }))
      const { error } = await supabase.from('reviews').update({ helpful_count: next }).eq('id', r.id)
      if (error) throw error
    } catch {
      // TODO: reviews.helpful_count 컬럼·RLS 업데이트 정책 추가 후 재시도
      setHelpfulLocal((prev) => {
        const copy = { ...prev }
        delete copy[r.id]
        return copy
      })
    }
  }

  const displayName = profile?.name?.trim() || '회원'

  return (
    <div className="relative min-h-screen max-w-[390px] mx-auto bg-[#0D0B09] font-light text-[rgba(255,255,255,0.92)] pb-24">
      {/* 1 탑바 */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0D0B09]/95 backdrop-blur-sm border-b border-[rgba(255,255,255,0.06)]">
        <span
          className={cx(cormorant.className, 'text-[#C9A96E] text-lg tracking-[6px]')}
          style={{ fontWeight: 400 }}
        >
          AURAN
        </span>
        <div className="flex gap-2">
          <Link
            href="/dashboard/customer/products"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-sm"
            aria-label="검색"
          >
            🔍
          </Link>
          <Link
            href="/my/notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-sm"
            aria-label="알림"
          >
            🔔
          </Link>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-5">
        {/* 2 인사말 */}
        <section className="flex items-start justify-between gap-3">
          <div>
            {profileLoading ? (
              <Skeleton className="h-4 w-40 mb-2" />
            ) : (
              <p className="text-[15px] text-white/90" style={{ fontWeight: 400 }}>
                {displayName}님, 안녕하세요
              </p>
            )}
            <p className="text-xs text-white/45 mt-1">{todayLabel}</p>
            {/* TODO: user_daily_tracker — 루틴 완료% · 수분 섭취 */}
            <p className="text-[11px] text-[#C9A96E]/80 mt-2">루틴 · 수분 트래커 연동 예정</p>
          </div>
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)]">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg opacity-40">👤</div>
            )}
          </div>
        </section>

        {/* 3 BEAUTY TRACKER — TODO user_daily_tracker */}
        <section>
          <p className="text-[11px] text-[#C9A96E] mb-2 tracking-wide" style={{ fontWeight: 400 }}>
            BEAUTY TRACKER
          </p>
          <Card>
            <div className="grid grid-cols-2 gap-3 text-xs text-white/70">
              {[
                { k: '💧 수분', v: 0 },
                { k: '🌞 자외선', v: 0 },
                { k: '😴 수면', v: 0 },
                { k: '🧴 루틴', v: 0 },
              ].map((row) => (
                <div key={row.k}>
                  <div className="flex justify-between mb-1">
                    <span>{row.k}</span>
                    <span className="text-white/40">{row.v}%</span>
                  </div>
                  <div className="h-[2px] w-full rounded-full bg-white/10">
                    <div className="h-[2px] rounded-full bg-[#C9A96E]/80" style={{ width: `${row.v}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/35 mt-2">TODO: user_daily_tracker 테이블 연동</p>
          </Card>
        </section>

        {/* 4 히어로 배너 — banners */}
        {bannersLoading ? (
          <Skeleton className="h-[148px] w-full rounded-[14px]" />
        ) : banners.length ? (
          <section className="relative h-[148px] overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.07)]">
            {banners.map((b, i) => (
              <div
                key={b.id}
                className={cx(
                  'absolute inset-0 flex flex-col justify-end p-4 transition-opacity duration-300',
                  i === bannerIdx ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none',
                )}
                style={{
                  background: `linear-gradient(135deg, ${b.gradient_from ?? '#1a0a2a'}, ${b.gradient_to ?? '#2d1545'})`,
                }}
              >
                {b.link_url ? (
                  <Link href={b.link_url} className="block">
                    <span className="text-2xl">{b.emoji}</span>
                    <p className="mt-1 text-sm text-white/95" style={{ fontWeight: 400 }}>
                      {b.title}
                    </p>
                    {b.subtitle ? <p className="text-xs text-white/55 mt-0.5">{b.subtitle}</p> : null}
                  </Link>
                ) : (
                  <>
                    <span className="text-2xl">{b.emoji}</span>
                    <p className="mt-1 text-sm text-white/95" style={{ fontWeight: 400 }}>
                      {b.title}
                    </p>
                    {b.subtitle ? <p className="text-xs text-white/55 mt-0.5">{b.subtitle}</p> : null}
                  </>
                )}
              </div>
            ))}
            <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`배너 ${i + 1}`}
                  className={cx('h-1.5 w-1.5 rounded-full', i === bannerIdx ? 'bg-[#C9A96E]' : 'bg-white/25')}
                  onClick={() => setBannerIdx(i)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* auto-rotate banner */}
        {banners.length > 1 ? <AutoBanner setIdx={setBannerIdx} len={banners.length} /> : null}

        {/* 5 TODAY'S SKIN — skin_analyses */}
        {skinLoading ? (
          <Skeleton className="h-20 w-full rounded-[14px]" />
        ) : skinLatest ? (
          <Link href="/skin-analysis">
            <Card className="active:opacity-90">
              <p className="text-[11px] text-[#C9A96E] mb-1" style={{ fontWeight: 400 }}>
                TODAY&apos;S SKIN
              </p>
              <p className="text-sm text-white/85">
                최근 분석 · {skinLatest.skin_type ?? '타입 미정'}{' '}
                {skinLatest.skin_score != null ? `· 점수 ${skinLatest.skin_score}` : ''}
              </p>
              <p className="text-[11px] text-white/40 mt-1">탭하여 피부분석 (skin_analyses)</p>
            </Card>
          </Link>
        ) : null}

        {/* 6 4대 기능 */}
        <section className="grid grid-cols-2 gap-2">
          {[
            { t: '🔬 피부분석', href: '/skin-analysis' },
            { t: '🌍 MY WORLD', href: '/my-world' },
            { t: '💬 커뮤니티', href: '/community' },
            { t: '💆 살롱예약', href: '/salon' },
          ].map((x) => (
            <Link
              key={x.href}
              href={x.href}
              className="rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-center text-xs text-white/80"
              style={{ fontWeight: 400 }}
            >
              {x.t}
            </Link>
          ))}
        </section>

        {/* 7 AURAN POINT — TODO user_wallets */}
        <Card className="border-[rgba(201,169,110,0.2)]">
          <p className="text-[11px] text-[#C9A96E]" style={{ fontWeight: 400 }}>
            AURAN POINT
          </p>
          <p className="text-xs text-white/45 mt-1">TODO: user_wallets 테이블에서 잔액 조회</p>
        </Card>

        {/* 8 AI 맞춤 추천 — products */}
        <section>
          <p className="text-xs text-white/55 mb-2" style={{ fontWeight: 400 }}>
            내 피부 맞춤 추천
          </p>
          {aiLoading ? (
            <HScroll>
              {[1, 2, 3].map((k) => (
                <Skeleton key={k} className="h-40 w-32 shrink-0" />
              ))}
            </HScroll>
          ) : aiProducts.length ? (
            <HScroll>
              {aiProducts.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/customer/products?focus=${p.id}`}
                  className="w-32 shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] overflow-hidden"
                >
                  <div className="aspect-square bg-black/30">
                    {p.thumb_img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb_img} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className={cx(dmMono.className, 'text-[10px] text-white/45 truncate')}>{pickBrandName(p.brands)}</p>
                    <p className="text-[11px] text-white/80 line-clamp-2 mt-0.5">{p.name}</p>
                    <p className="text-xs text-[#C9A96E] mt-1">{p.retail_price.toLocaleString()}원</p>
                    {p.tag ? (
                      <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] bg-[#C9A96E]/15 text-[#C9A96E]">
                        {p.tag}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </HScroll>
          ) : null}
        </section>

        {/* 9 구분선 */}
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] text-white/40 tracking-widest">DUCHESS.KR STORE</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* 10 피부 고민 — skin_concerns */}
        {concernsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : concerns.length ? (
          <HScroll>
            {concerns.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedConcernId(c.id)}
                className={cx(
                  'shrink-0 rounded-full border px-3 py-2 text-xs transition-colors',
                  selectedConcernId === c.id
                    ? 'border-[#C9A96E] bg-[#C9A96E]/10 text-[#C9A96E]'
                    : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] text-white/65',
                )}
                style={{ fontWeight: 400 }}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </HScroll>
        ) : null}

        {/* 11 BEST 랭킹 — products (+ TODO skin_concern_id) */}
        <section>
          <p className="text-xs text-white/55 mb-2" style={{ fontWeight: 400 }}>
            {selectedConcern?.name ?? '고민'} BEST
          </p>
          {bestLoading ? (
            <HScroll>
              {[1, 2, 3].map((k) => (
                <Skeleton key={k} className="h-48 w-36 shrink-0" />
              ))}
            </HScroll>
          ) : bestProducts.length ? (
            <HScroll>
              {bestProducts.map((p, idx) => {
                const rank = idx + 1
                const badge =
                  rank === 1 ? 'bg-[#C9A96E] text-black' : rank === 2 ? 'bg-[#c0c0c0] text-black' : rank === 3 ? 'bg-[#CD7F32] text-black' : 'bg-white/10 text-white/70'
                return (
                  <div
                    key={p.id}
                    className="w-36 shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] overflow-hidden"
                  >
                    <div className="relative aspect-square bg-black/30">
                      {p.thumb_img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb_img} alt="" className="h-full w-full object-cover" />
                      ) : null}
                      <span className={cx('absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px]', badge)} style={{ fontWeight: 400 }}>
                        {rank}위
                      </span>
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] text-white/80 line-clamp-2">{p.name}</p>
                      <p className="text-xs text-[#C9A96E] mt-1">{p.retail_price.toLocaleString()}원</p>
                      <div className="mt-2 flex gap-1">
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[10px] text-white/70"
                          style={{ fontWeight: 400 }}
                          onClick={() => {
                            /* TODO: 장바구니 담기 — cart API 연동 */
                          }}
                        >
                          🛒 담기
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-white/10 bg-white/5 py-1.5 text-[10px] text-white/70"
                          style={{ fontWeight: 400 }}
                          onClick={() => {
                            /* TODO: 선물하기 플로우 */
                          }}
                        >
                          🎁 선물
                        </button>
                      </div>
                      <Link
                        href={`/dashboard/customer/products?buy=${p.id}`}
                        className="mt-1 block rounded-lg border border-[#C9A96E]/40 bg-[#C9A96E]/10 py-1.5 text-center text-[10px] text-[#C9A96E]"
                        style={{ fontWeight: 400 }}
                      >
                        바로구매
                      </Link>
                    </div>
                  </div>
                )
              })}
            </HScroll>
          ) : null}
        </section>

        {/* 12 롤링 리뷰 — reviews */}
        {reviewsLoading ? (
          <Skeleton className="h-28 w-full rounded-[14px]" />
        ) : reviews.length ? (
          <Card>
            {(() => {
              const r = reviews[reviewIdx % reviews.length]!
              const helpful = helpfulLocal[r.id] ?? r.helpful_count ?? 0
              return (
                <>
                  <p className="text-[11px] text-[#C9A96E] mb-1" style={{ fontWeight: 400 }}>
                    베스트 리뷰
                  </p>
                  <p className="text-xs text-white/75 line-clamp-4">{r.content ?? '내용 없음'}</p>
                  <p className="text-[10px] text-white/35 mt-1">★ {r.rating}</p>
                  <button
                    type="button"
                    className="mt-2 text-[11px] text-[#C9A96E]/90"
                    style={{ fontWeight: 400 }}
                    onClick={() => void onHelpful(r)}
                  >
                    👍 도움돼요 ({helpful})
                  </button>
                </>
              )
            })()}
          </Card>
        ) : null}

        {/* 13 타임세일·공구 */}
        <section>
          <div className="flex gap-2 mb-2">
            {(['timesale', 'group'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setPromoTab(tab)}
                className={cx(
                  'flex-1 rounded-full border py-2 text-xs',
                  promoTab === tab
                    ? 'border-[#C9A96E] text-[#C9A96E]'
                    : 'border-white/10 text-white/45',
                )}
                style={{ fontWeight: 400 }}
              >
                {tab === 'timesale' ? '타임세일' : '공동구매'}
              </button>
            ))}
          </div>
          {promoLoading ? (
            <Skeleton className="h-32 w-full rounded-[14px]" />
          ) : promoTab === 'timesale' && timeSales.length ? (
            <HScroll>
              {timeSales.map((ts) => {
                const tp = pickOne(ts.products)
                return (
                <div
                  key={ts.id}
                  className="w-44 shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-2"
                >
                  <p className="text-[11px] text-white/80 line-clamp-2">{tp?.name ?? '상품'}</p>
                  <p className="text-lg text-[#C9A96E] mt-1" style={{ fontWeight: 400 }}>
                    {ts.sale_price.toLocaleString()}원
                  </p>
                  <p className="text-[10px] text-white/40 line-through">{ts.original_price.toLocaleString()}원</p>
                  <p className="text-[11px] text-[#C9A96E] mt-2 tabular-nums">⏱ {formatCountdown(ts.ends_at)}</p>
                </div>
                )
              })}
            </HScroll>
          ) : promoTab === 'group' && groupBuys.length ? (
            <HScroll>
              {groupBuys.map((g) => {
                const cur = g.current_count ?? 0
                const pct = g.target_count > 0 ? Math.min(100, Math.round((cur / g.target_count) * 100)) : 0
                const gp = pickOne(g.products)
                return (
                  <div
                    key={g.id}
                    className="w-44 shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-2"
                  >
                    <p className="text-[11px] text-white/80 line-clamp-2">{gp?.name ?? '상품'}</p>
                    <p className="text-sm text-[#C9A96E] mt-1" style={{ fontWeight: 400 }}>
                      {g.group_price.toLocaleString()}원
                    </p>
                    <p className="text-[10px] text-white/45 mt-1">
                      참여 {cur} / 목표 {g.target_count}
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-[#C9A96E]/90" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </HScroll>
          ) : null}
        </section>

        {/* 14 살롱 — salons (TODO is_open) */}
        <section>
          <p className="text-xs text-white/55 mb-2" style={{ fontWeight: 400 }}>
            살롱
          </p>
          {salonsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : salons.length ? (
            <>
              <HScroll className="mb-2">
                {salonAreas.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setSalonArea(a)}
                    className={cx(
                      'shrink-0 rounded-full border px-3 py-1.5 text-[11px]',
                      salonArea === a ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-white/10 text-white/45',
                    )}
                    style={{ fontWeight: 400 }}
                  >
                    {a}
                  </button>
                ))}
              </HScroll>
              <div className="space-y-2">
                {filteredSalons.slice(0, 8).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] p-2"
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white/10">
                      {s.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/85 truncate">{s.name}</p>
                      <p className="text-[10px] text-white/40">{s.area}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400/90">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      영업중
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/30 mt-1">TODO: salons.is_open 기준으로 영업 표시 교체</p>
            </>
          ) : null}
        </section>

        {/* 15 소진 알림 — refill_alerts */}
        {refillsLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : refills.length ? (
          <section>
            <p className="text-xs text-white/55 mb-2" style={{ fontWeight: 400 }}>
              소진 알림
            </p>
            <div className="space-y-2">
              {refills.map((r) => {
                const pct = Math.min(100, Math.max(0, r.usage_percent ?? 0))
                const rp = pickOne(r.products)
                return (
                  <Card key={r.id} className="py-2">
                    <p className="text-xs text-white/80">{rp?.name ?? '제품'}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-[#C9A96E]/80" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1">소진율 {pct}% · 임계 {r.alert_threshold ?? 30}%</p>
                  </Card>
                )
              })}
            </div>
          </section>
        ) : null}

        {/* 16 구매 히스토리 — user_products */}
        {historyLoading ? (
          <HScroll>
            {[1, 2, 3].map((k) => (
              <Skeleton key={k} className="h-24 w-24 shrink-0" />
            ))}
          </HScroll>
        ) : historyRows.length ? (
          <section>
            <p className="text-xs text-white/55 mb-2" style={{ fontWeight: 400 }}>
              구매 히스토리
            </p>
            <HScroll>
              {historyRows.map((row) => (
                <div
                  key={row.product_id}
                  className="w-24 shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] overflow-hidden"
                >
                  <div className="aspect-square bg-black/30">
                    {row.products?.thumb_img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.products.thumb_img} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <Link
                    href={`/dashboard/customer/products?focus=${row.product_id}`}
                    className="block py-1.5 text-center text-[9px] text-[#C9A96E]"
                    style={{ fontWeight: 400 }}
                  >
                    🔄 재구매
                  </Link>
                </div>
              ))}
            </HScroll>
          </section>
        ) : null}

        {/* 17 일촌 피드 — TODO friend_activities */}
        <Card>
          <p className="text-[11px] text-[#C9A96E]" style={{ fontWeight: 400 }}>
            일촌 피드
          </p>
          <p className="text-xs text-white/40 mt-1">TODO: friend_activities 테이블</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="text-[10px] text-white/45" style={{ fontWeight: 400 }}>
              ❤️ 공감
            </button>
            <button type="button" className="text-[10px] text-white/45" style={{ fontWeight: 400 }}>
              나도 구매
            </button>
            <button type="button" className="text-[10px] text-white/45" style={{ fontWeight: 400 }}>
              공유
            </button>
          </div>
        </Card>

        {/* 18 신제품 — products.is_new 폴백 created_at */}
        <section>
          <p className="text-xs text-white/55 mb-2" style={{ fontWeight: 400 }}>
            신제품
          </p>
          {newLoading ? (
            <HScroll>
              {[1, 2, 3].map((k) => (
                <Skeleton key={k} className="h-36 w-28 shrink-0" />
              ))}
            </HScroll>
          ) : newProducts.length ? (
            <HScroll>
              {newProducts.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/customer/products?focus=${p.id}`}
                  className="w-28 shrink-0 rounded-[12px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.03)] overflow-hidden relative"
                >
                  <span
                    className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[8px] text-white"
                    style={{
                      fontWeight: 400,
                      background: 'linear-gradient(90deg,#6040E0,#A040E0)',
                    }}
                  >
                    NEW
                  </span>
                  <div className="aspect-square bg-black/30">
                    {p.thumb_img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumb_img} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-1.5">
                    <p className="text-[10px] text-white/80 line-clamp-2">{p.name}</p>
                  </div>
                </Link>
              ))}
            </HScroll>
          ) : null}
        </section>

        {/* 19 브랜드 — brands.origin */}
        <section>
          <p className="text-xs text-white/55 mb-2" style={{ fontWeight: 400 }}>
            브랜드
          </p>
          {brandsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : brands.length ? (
            <>
              <HScroll className="mb-2">
                {['전체', '유럽', '국내', '일본', '클리닉', '바디'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBrandOriginTab(t)}
                    className={cx(
                      'shrink-0 rounded-full border px-3 py-1.5 text-[11px]',
                      brandOriginTab === t ? 'border-[#C9A96E] text-[#C9A96E]' : 'border-white/10 text-white/45',
                    )}
                    style={{ fontWeight: 400 }}
                  >
                    {t}
                  </button>
                ))}
              </HScroll>
              <div className="grid grid-cols-4 gap-2">
                {filteredBrands.slice(0, 7).map((b) => (
                  <div key={b.id} className="flex flex-col items-center gap-1">
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      {b.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-white/30">—</div>
                      )}
                    </div>
                    <p className="text-[9px] text-white/50 text-center line-clamp-2">{b.name}</p>
                  </div>
                ))}
                {filteredBrands.length > 7 ? (
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[10px] text-[#C9A96E]" style={{ fontWeight: 400 }}>
                      +{filteredBrands.length - 7}
                    </span>
                    <span className="text-[9px] text-white/35">더보기</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </main>

      {/* 20 하단 네비 */}
      <nav className="fixed bottom-0 left-1/2 z-50 flex h-[72px] w-full max-w-[390px] -translate-x-1/2 items-end justify-between border-t border-[rgba(255,255,255,0.08)] bg-[#0D0B09]/95 px-4 pb-3 pt-2 backdrop-blur-md safe-area-pb">
        <Link href="/home" className="flex flex-col items-center text-[9px] text-[#C9A96E]" style={{ fontWeight: 400 }}>
          <span className="text-base leading-none mb-0.5">⌂</span>
          HOME
        </Link>
        <Link
          href="/dashboard/customer/products"
          className="flex flex-col items-center text-[9px] text-white/45"
          style={{ fontWeight: 400 }}
        >
          <span className="text-base leading-none mb-0.5">🛒</span>
          SHOP
        </Link>
        <Link
          href="/skin-analysis"
          className="relative -mt-5 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_24px_rgba(201,169,110,0.35)]"
          style={{
            background: 'linear-gradient(145deg, #e8c870, #C9A96E, #8a7040)',
            fontWeight: 400,
          }}
          aria-label="AI 피부분석"
        >
          <span className="text-xl">🔬</span>
        </Link>
        <Link
          href="/dashboard/customer/booking"
          className="flex flex-col items-center text-[9px] text-white/45"
          style={{ fontWeight: 400 }}
        >
          <span className="text-base leading-none mb-0.5">📅</span>
          예약
        </Link>
        <Link href="/my" className="flex flex-col items-center text-[9px] text-white/45" style={{ fontWeight: 400 }}>
          <span className="text-base leading-none mb-0.5">👤</span>
          MY
        </Link>
      </nav>
    </div>
  )
}

function AutoBanner({ setIdx, len }: { setIdx: Dispatch<SetStateAction<number>>; len: number }) {
  useEffect(() => {
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % len)
    }, 4500)
    return () => clearInterval(t)
  }, [len, setIdx])
  return null
}
