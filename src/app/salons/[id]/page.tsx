'use client'

import { createClient } from '@/lib/supabase/client'
import { canShowCyclePhase } from '@/lib/hormoneUtils'
import StoreHeroGreeting from '@/components/salon-store/StoreHeroGreeting'
import StoreRelationshipCard from '@/components/salon-store/StoreRelationshipCard'
import StoreRepurchaseCard from '@/components/salon-store/StoreRepurchaseCard'
import StoreSnsMapInfo from '@/components/salon-store/StoreSnsMapInfo'
import { EmptyBannerHook } from '@/components/salon-store/EmptyBannerHook'
import { useSalonBookingMessage } from '@/hooks/useSalonBookingMessage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

const BG = '#0D0B09'
const PURPLE = '#7B5EA7'
const PURPLE_LIGHT = 'rgba(123,94,167,0.15)'
const GOLD = '#C9A96E'
const GOLD_LIGHT = 'rgba(201,169,110,0.12)'
const TEXT = '#ffffff'
const TEXT_SUB = 'rgba(255,255,255,0.55)'
const BORDER = 'rgba(255,255,255,0.08)'
const CARD = 'rgba(255,255,255,0.05)'
const SURFACE = 'rgba(255,255,255,0.08)'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']
const PHASE_FILTERS = ['전체', '황금기', '달빛기', '만개기', '물들기'] as const
const PHASE_EMOJI: Record<string, string> = { 달빛기: '🌙', 황금기: '✨', 만개기: '🌸', 물들기: '🍂' }
const PHASE_TIP: Record<string, string> = {
  달빛기: '진정 · 수분 케어가 좋아요',
  황금기: 'MTS · 스피큘 · 화학필링 최적기입니다',
  만개기: '리프팅 · 활력 케어를 추천해요',
  물들기: '수분 · 진정 케어로 균형을 잡아주세요',
}
const SKIN_CONCERN_CHIPS = ['건조', '탄력', '색소', '진정'] as const

const SESSION_PACKAGES = [
  { sessions: 1, label: '1회권', desc: '1회 이용', discount: 0 },
  { sessions: 5, label: '5회권', desc: '5회 이용', discount: 5 },
  { sessions: 10, label: '10회권', desc: '10회 이용', discount: 10 },
] as const

type SalonService = {
  id?: string
  name?: string
  price?: number
  duration_min?: number
  duration?: number
  description?: string
  phase_tags?: string[]
  phase_tag?: string
  thumbnail_url?: string
  review_count?: number
  avg_rating?: number
}

type SalonRow = {
  id: string
  owner_id?: string | null
  name?: string | null
  description?: string | null
  area?: string | null
  address?: string | null
  phone?: string | null
  banner_url?: string | null
  banner_urls?: string[] | null
  banner_links?: string[] | null
  story_url?: string | null
  story_type?: string | null
  services?: SalonService[] | null
  open_hours?: Record<string, string> | null
  avg_rating?: number | null
  review_count?: number | null
  staff_count?: number | null
  room_count?: number | null
  certificates?: { url: string; label?: string | null }[] | null
}

type ReviewRow = {
  id: string
  rating?: number | null
  content?: string | null
  hormone_phase?: string | null
  skin_type?: string | null
  effect_tags?: string[] | null
  helpful_count?: number | null
  created_at: string
  author_id?: string | null
  service_name?: string | null
  users?: { name?: string | null } | { name?: string | null }[] | null
}

function relOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function parseServices(raw: unknown): SalonService[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as SalonService[]
  return []
}

function calcPhase(lastPeriod: string | null | undefined): string | null {
  if (!lastPeriod) return null
  const start = new Date(lastPeriod)
  if (Number.isNaN(start.getTime())) return null
  const diff = Math.floor((Date.now() - start.getTime()) / 86400000)
  const day = ((diff % 28) + 28) % 28
  if (day < 5) return '달빛기'
  if (day < 13) return '황금기'
  if (day < 20) return '만개기'
  return '물들기'
}

async function fetchSlotCount(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
  date: string,
  time: string,
): Promise<number> {
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('salon_id', salonId)
    .eq('booking_date', date)
    .eq('booking_time', time)
    .not('status', 'in', '("cancelled","rejected")')
  return count ?? 0
}

function todayHours(openHours: Record<string, string> | null | undefined): string | null {
  if (!openHours || typeof openHours !== 'object') return null
  const key = DAY_KEYS[new Date().getDay()]
  const ko = DAY_KO[new Date().getDay()]
  const val = openHours[key] || openHours[ko] || openHours.default || ''
  return val ? String(val).replace('-', '~') : null
}

function isOpenNow(openHours: Record<string, string> | null | undefined): boolean {
  const raw = todayHours(openHours)
  if (!raw || raw.includes('휴무') || raw === 'closed') return false
  const m = raw.match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/)
  if (!m) return true
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const open = Number(m[1]) * 60 + Number(m[2])
  const close = Number(m[3]) * 60 + Number(m[4])
  return cur >= open && cur <= close
}

function phaseBadgeStyle(phase: string) {
  if (phase === '황금기') return { background: GOLD_LIGHT, color: GOLD }
  if (phase === '달빛기') return { background: PURPLE_LIGHT, color: '#AFA9EC' }
  if (phase === '만개기') return { background: 'rgba(212,83,126,0.15)', color: '#ED93B1' }
  if (phase === '물들기') return { background: 'rgba(215,107,48,0.15)', color: '#F0997B' }
  return { background: PURPLE_LIGHT, color: PURPLE }
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function stars(n: number) {
  const r = Math.round(Number(n) || 0)
  return '★'.repeat(Math.min(5, Math.max(0, r))) + '☆'.repeat(5 - Math.min(5, Math.max(0, r)))
}

export default function SalonHomePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ? String(params.id) : ''
  const supabaseRef = useRef(createClient())
  const sendSalonBookingMessage = useSalonBookingMessage()

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [salon, setSalon] = useState<SalonRow | null>(null)
  const [ownerName, setOwnerName] = useState('')
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [customerPhase, setCustomerPhase] = useState<string | null>(null)
  const [tab, setTab] = useState<'menu' | 'reviews' | 'info'>('menu')
  const [phaseFilter, setPhaseFilter] = useState<string>('전체')
  const [reviewLimit, setReviewLimit] = useState(5)
  const [shareToast, setShareToast] = useState('')
  const [showMapSheet, setShowMapSheet] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [bookingSalonId, setBookingSalonId] = useState<string>('')
  const [bookingSalonName, setBookingSalonName] = useState<string>('')
  const [bookingServiceName, setBookingServiceName] = useState<string | undefined>(undefined)
  const [bookingServicePrice, setBookingServicePrice] = useState<number | undefined>(undefined)
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [bookingSessions, setBookingSessions] = useState(1)
  const [purchaseId, setPurchaseId] = useState<string>('')
  const [reviewerId, setReviewerId] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const bookingPaidReturnRef = useRef(false)
  const [bookingDate, setBookingDate] = useState('')
  const [bookingTime, setBookingTime] = useState('')
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({})
  const [bookingNotes, setBookingNotes] = useState('')
  const [bookingAgree, setBookingAgree] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [customerUserId, setCustomerUserId] = useState<string | null>(null)
  const [lastPeriodDate, setLastPeriodDate] = useState<string | null>(null)
  const [hormoneTrack, setHormoneTrack] = useState<string | null>(null)
  const [customerGender, setCustomerGender] = useState<string | null>(null)
  const [skinConcernFilter, setSkinConcernFilter] = useState<string | null>(null)
  const [bannerIndex, setBannerIndex] = useState(0)
  const [showStory, setShowStory] = useState(false)
  const [certLightbox, setCertLightbox] = useState<{ url: string; label: string } | null>(null)
  const bannerTouchX = useRef(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      const sb = supabaseRef.current
      const { data: salonData, error } = await sb.from('salons').select('*').eq('id', id).eq('status', 'active').single()
      if (cancelled) return
      if (error || !salonData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setSalon(salonData as SalonRow)
      setNotFound(false)

      if (salonData.owner_id) {
        const { data: owner } = await sb.from('users').select('name').eq('id', salonData.owner_id).maybeSingle()
        if (!cancelled && owner?.name) setOwnerName(String(owner.name))
      }

      const { data: reviewRows } = await sb
        .from('reviews')
        .select('id,rating,content,hormone_phase,skin_type,effect_tags,helpful_count,created_at,author_id,service_name,users(name)')
        .eq('target_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20)
      if (!cancelled) setReviews((reviewRows as ReviewRow[]) || [])

      const { data: auth } = await sb.auth.getUser()
      if (auth.user && !cancelled) {
        const { data: urow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
        if (urow?.id) {
          setCustomerUserId(String(urow.id))
          const [{ data: hcRows }, { data: prof }] = await Promise.all([
            sb
              .from('hormone_cycle')
              .select('last_period_date, track')
              .eq('user_id', urow.id)
              .order('created_at', { ascending: false })
              .limit(1),
            sb.from('profiles').select('gender').eq('auth_id', auth.user.id).maybeSingle(),
          ])
          const hcRow = ((hcRows as { last_period_date?: string; track?: string }[]) || [])[0]
          const last = hcRow?.last_period_date
          const track = hcRow?.track != null ? String(hcRow.track) : null
          const gender = prof?.gender != null ? String(prof.gender) : null
          setHormoneTrack(track)
          setCustomerGender(gender)
          setLastPeriodDate(last || null)
          setCustomerPhase(canShowCyclePhase(track, gender) ? calcPhase(last) : null)
        }
      }

      if (!cancelled) setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!shareToast) return
    const t = setTimeout(() => setShareToast(''), 2000)
    return () => clearTimeout(t)
  }, [shareToast])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const reviewerIdParam = p.get('reviewer_id') || ''
    if (reviewerIdParam) setReviewerId(reviewerIdParam)
    if (p.get('booking_paid') === 'true') {
      bookingPaidReturnRef.current = true
      const pid = p.get('purchase_id') || ''
      setPurchaseId(pid)
      setShowBooking(true)
      setBookingStep(3)
      setBookingMonth({
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
      })
      window.history.replaceState({}, '', window.location.pathname)
      if (pid) {
        void (async () => {
          const { data: pur } = await supabaseRef.current
            .from('purchases')
            .select('service_name, service_price, total_sessions, salon_id, payment_amount')
            .eq('id', pid)
            .maybeSingle()
          if (pur) {
            setBookingServiceName(pur.service_name || '')
            setBookingServicePrice(Number(pur.service_price || 0))
            setBookingSessions(Number(pur.total_sessions || 1))
            setBookingSalonId(String(pur.salon_id || id || ''))
          }
        })()
      }
    }
  }, [])

  useEffect(() => {
    if (!showBooking) return
    if (bookingPaidReturnRef.current) {
      bookingPaidReturnRef.current = false
      return
    }
    setBookingStep(1)
    setBookingSessions(1)
    setPurchaseId('')
    setBookingDate('')
    setBookingTime('')
    setSlotCounts({})
    setBookingNotes('')
    setBookingAgree(false)
  }, [showBooking])

  useEffect(() => {
    if (bookingStep !== 5 || !showBooking) return
    setShareToast('예약 완료! 💜')
    const t = setTimeout(() => {
      setShowBooking(false)
      setBookingStep(1)
    }, 3000)
    return () => clearTimeout(t)
  }, [bookingStep, showBooking])

  useEffect(() => {
    setBannerIndex(0)
  }, [id])

  const services = useMemo(() => parseServices(salon?.services), [salon?.services])
  const bookingAmount = useMemo(() => {
    const unit = Number(bookingServicePrice || 0)
    const pkg = SESSION_PACKAGES.find((p) => p.sessions === bookingSessions)
    const discount = pkg?.discount ?? 0
    return Math.floor(unit * bookingSessions * (1 - discount / 100))
  }, [bookingServicePrice, bookingSessions])
  const salonCertificates = useMemo(() => {
    const raw = salon?.certificates
    if (!Array.isArray(raw)) return []
    return raw
      .filter((c) => c?.url)
      .map((c) => ({ url: String(c.url), label: String(c.label || '') }))
  }, [salon?.certificates])
  const hoursToday = useMemo(() => todayHours(salon?.open_hours ?? null), [salon?.open_hours])
  const openNow = useMemo(() => isOpenNow(salon?.open_hours ?? null), [salon?.open_hours])
  const salonBannerUrls = useMemo(() => {
    const raw = salon?.banner_urls
    return Array.isArray(raw) ? raw.filter(Boolean).map(String) : []
  }, [salon?.banner_urls])
  const salonBannerLinks = useMemo(() => {
    const raw = salon?.banner_links
    return Array.isArray(raw) ? raw.map(String) : []
  }, [salon?.banner_links])
  const salonName = String(salon?.name || '샵')
  const ownerId = salon?.owner_id ? String(salon.owner_id) : ''

  const serviceTags = useMemo(() => {
    const tags = new Set<string>()
    for (const s of services) {
      if (s.name) tags.add(String(s.name))
      for (const t of s.phase_tags || []) tags.add(String(t))
    }
    return Array.from(tags).slice(0, 6)
  }, [services])

  const avgRating = useMemo(() => {
    if (reviews.length) {
      const sum = reviews.reduce((a, r) => a + Number(r.rating || 0), 0)
      return sum / reviews.length
    }
    return Number(salon?.avg_rating) || 0
  }, [reviews, salon?.avg_rating])

  const reviewTotal = salon?.review_count ?? reviews.length

  const ratingBars = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0]
    for (const r of reviews) {
      const n = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 0)))
      counts[n] += 1
    }
    const max = Math.max(1, ...counts.slice(1))
    return [5, 4, 3, 2, 1].map((star) => ({ star, count: counts[star], pct: (counts[star] / max) * 100 }))
  }, [reviews])

  const showCyclePhase = canShowCyclePhase(hormoneTrack, customerGender)

  const filteredReviews = useMemo(() => {
    if (!showCyclePhase) {
      if (!skinConcernFilter) return reviews
      return reviews.filter((r) => {
        const effects = Array.isArray(r.effect_tags) ? r.effect_tags.map(String) : []
        return effects.some((t) => t.includes(skinConcernFilter))
      })
    }
    if (phaseFilter === '전체') return reviews
    return reviews.filter((r) => String(r.hormone_phase || '') === phaseFilter)
  }, [reviews, phaseFilter, showCyclePhase, skinConcernFilter])

  const visibleReviews = filteredReviews.slice(0, reviewLimit)

  const [bookingMonth, setBookingMonth] = useState(() => {
    const t = new Date()
    return { year: t.getFullYear(), month: t.getMonth() }
  })
  const bookingCalendarDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { year, month } = bookingMonth
    const firstDow = new Date(year, month, 1).getDay()
    const lastDate = new Date(year, month + 1, 0).getDate()
    const days: {
      iso: string | null
      label: number | null
      disabled: boolean
      empty: boolean
      dowIdx: number
    }[] = []
    for (let i = 0; i < firstDow; i++) {
      days.push({ iso: null, label: null, disabled: true, empty: true, dowIdx: i })
    }
    for (let d = 1; d <= lastDate; d++) {
      const date = new Date(year, month, d)
      date.setHours(0, 0, 0, 0)
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        iso,
        label: d,
        disabled: date <= today,
        empty: false,
        dowIdx: date.getDay(),
      })
    }
    while (days.length < 42) {
      days.push({ iso: null, label: null, disabled: true, empty: true, dowIdx: 0 })
    }
    days.length = 42
    return days
  }, [bookingMonth])

  const bookingTimeSlots = useMemo(() => {
    const slots: string[] = []
    let openH = 9
    let closeH = 19
    const oh = salon?.open_hours
    if (oh && bookingDate) {
      const d = new Date(bookingDate + 'T12:00:00')
      const key = DAY_KEYS[d.getDay()]
      const ko = DAY_KO[d.getDay()]
      const raw = oh[key] || oh[ko] || oh.default || ''
      const m = String(raw).match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/)
      if (m) {
        openH = Number(m[1])
        closeH = Number(m[3])
      }
    }
    for (let h = openH; h < closeH; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
    }
    return slots
  }, [salon?.open_hours, bookingDate])

  const nextGoldenLabel = useMemo(() => {
    if (!showCyclePhase || !lastPeriodDate) return null
    const start = new Date(lastPeriodDate)
    if (Number.isNaN(start.getTime())) return null
    const diff = Math.floor((Date.now() - start.getTime()) / 86400000)
    const day = ((diff % 28) + 28) % 28
    const daysUntil = day < 5 ? 5 - day : 28 - day + 5
    const d = new Date()
    d.setDate(d.getDate() + daysUntil)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
  }, [lastPeriodDate, showCyclePhase])

  const chatHref = `/dashboard/customer/salon-chat/new?salon_id=${encodeURIComponent(id)}&owner_id=${encodeURIComponent(ownerId)}`

  const share = async () => {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '')
      setShareToast('링크가 복사되었어요')
    } catch {
      setShareToast('복사에 실패했어요')
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB, fontSize: 14 }}>
        불러오는 중…
      </div>
    )
  }

  if (notFound || !salon) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: TEXT_SUB }}>
        <div>샵을 찾을 수 없어요</div>
        <button type="button" onClick={() => router.back()} style={{ border: `1px solid ${BORDER}`, background: CARD, color: TEXT, borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>
          뒤로가기
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: tab === 'menu' ? 88 : 24, maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: BG, display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 22, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 500 }}>{salonName}</div>
        <button type="button" onClick={() => void share()} style={{ border: 'none', background: 'transparent', color: TEXT_SUB, fontSize: 13, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>
          공유
        </button>
      </header>

      <div style={{ position: 'relative', width: '100%' }}>
        {salonBannerUrls.length > 0 ? (
          <div
            role="presentation"
            style={{ width: '100%', aspectRatio: '21/9', minHeight: 100, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
            onTouchStart={(e) => { bannerTouchX.current = e.touches[0]?.clientX ?? 0 }}
            onTouchEnd={(e) => {
              const endX = e.changedTouches[0]?.clientX ?? 0
              const dx = endX - bannerTouchX.current
              if (Math.abs(dx) < 40) return
              if (dx < 0) setBannerIndex((i) => Math.min(i + 1, salonBannerUrls.length - 1))
              else setBannerIndex((i) => Math.max(i - 1, 0))
            }}
            onClick={() => {
              const link = salonBannerLinks[bannerIndex] || 'none'
              if (link === 'booking') {
                setBookingSalonId(salon.id)
                setBookingSalonName(String(salon.name || ''))
                setBookingServiceName(undefined)
                setBookingServicePrice(undefined)
                setBookingMonth({ year: new Date().getFullYear(), month: new Date().getMonth() })
                setBookingStep(1)
                setShowBooking(true)
              } else if (link === 'chat') {
                router.push(`/dashboard/customer/salon-chat/new?salon_id=${salon.id}&owner_id=${salon.owner_id || ''}`)
              } else if (link.startsWith('http')) {
                window.open(link, '_blank', 'noopener,noreferrer')
              }
            }}
          >
            <div style={{ width: '100%', height: '100%', background: `url(${salonBannerUrls[bannerIndex]}) center/cover no-repeat` }} />
            {salonBannerUrls.length > 1 ? (
              <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {salonBannerUrls.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`배너 ${i + 1}`}
                    onClick={(e) => { e.stopPropagation(); setBannerIndex(i) }}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      border: 'none',
                      padding: 0,
                      background: i === bannerIndex ? PURPLE : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyBannerHook salonName={salon.name} />
        )}
        {salon.story_url ? (
          <button
            type="button"
            onClick={() => setShowStory(true)}
            aria-label="스토리 보기"
            style={{
              position: 'absolute',
              bottom: 10,
              left: 12,
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '2px solid #fff',
              padding: 0,
              overflow: 'hidden',
              cursor: 'pointer',
              zIndex: 5,
              background: `url(${salon.story_url}) center/cover no-repeat`,
            }}
          />
        ) : null}
      </div>

      {showStory && salon.story_url ? (
        <div
          role="presentation"
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowStory(false)}
        >
          <button
            type="button"
            onClick={() => setShowStory(false)}
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: TEXT, fontSize: 20, cursor: 'pointer' }}
          >
            ×
          </button>
          {salon.story_type === 'video' ? (
            <video src={salon.story_url} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={salon.story_url} alt="" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      ) : null}

      {certLightbox ? (
        <div
          role="presentation"
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setCertLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setCertLightbox(null)}
            style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: TEXT, fontSize: 20, cursor: 'pointer' }}
          >
            ×
          </button>
          <div style={{ maxWidth: '100%', maxHeight: '90vh', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img src={certLightbox.url} alt={certLightbox.label || ''} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
            {certLightbox.label ? (
              <div style={{ marginTop: 12, fontSize: 14, color: TEXT_SUB }}>{certLightbox.label}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ padding: '12px 15px 0' }}>
        <div style={{ fontSize: 17, fontWeight: 500, color: TEXT, marginBottom: 3 }}>{salon.name}</div>
        <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>
          {salon.area} · {openNow ? '영업 중' : '영업 종료'}
          {hoursToday && hoursToday.includes('~') ? ` · ${hoursToday.split('~')[1]?.trim()} 마감` : ''}
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: GOLD, fontSize: 12 }}>★</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: GOLD }}>{salon.avg_rating?.toFixed(1) ?? '-'}</span>
              <span style={{ fontSize: 11, color: TEXT_SUB }}>리뷰 {salon.review_count ?? 0}개</span>
            </div>
            {customerPhase ? (
              <div style={{ background: 'rgba(123,94,167,0.2)', border: '0.5px solid rgba(123,94,167,0.4)', borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 2 }}>지금 내 위상</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, padding: '2px 6px', borderRadius: 8, background: '#FFF7E6', color: '#854F0B', marginBottom: 2 }}>
                  {PHASE_EMOJI[customerPhase]} {customerPhase}
                </span>
                <div style={{ fontSize: 11, color: GOLD, lineHeight: 1.4 }}>{PHASE_TIP[customerPhase]}</div>
              </div>
            ) : customerUserId && !showCyclePhase ? (
              <div style={{ background: 'rgba(123,94,167,0.12)', border: '0.5px solid rgba(123,94,167,0.25)', borderRadius: 9, padding: '7px 9px' }}>
                <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 6 }}>피부 고민으로 찾기</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {SKIN_CONCERN_CHIPS.map((c) => (
                    <span key={c} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: PURPLE_LIGHT, color: PURPLE }}>{c}</span>
                  ))}
                </div>
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <button
                type="button"
                onClick={() => {
                  setBookingSalonId(salon.id)
                  setBookingSalonName(String(salon.name || ''))
                  setBookingServiceName(undefined)
                  setBookingServicePrice(undefined)
                  setBookingMonth({ year: new Date().getFullYear(), month: new Date().getMonth() })
                  setBookingStep(1)
                  setShowBooking(true)
                }}
                style={{ width: '100%', padding: '7px 0', borderRadius: 9, border: 'none', background: PURPLE, color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                📅 예약하기
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/customer/salon-chat/new?salon_id=${salon.id}&owner_id=${salon.owner_id || ''}`)}
                style={{ width: '100%', padding: '7px 0', borderRadius: 9, border: '0.5px solid rgba(123,94,167,0.4)', background: 'rgba(123,94,167,0.15)', color: '#A98FD0', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                💬 상담 요청
              </button>
              <button
                type="button"
                onClick={() => setShowMapSheet(true)}
                style={{ width: '100%', padding: '7px 0', borderRadius: 9, border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                📍 길찾기
              </button>
            </div>
        </div>
      </div>

      <StoreHeroGreeting salon={salon} customerTrack={hormoneTrack} customerGender={customerGender} />
      <StoreRelationshipCard ownerId={ownerId} customerId={customerUserId} />
      <StoreRepurchaseCard ownerId={ownerId} customerId={customerUserId} />
      <StoreSnsMapInfo mapUrl={(salon as { map_url?: string | null }).map_url} snsLinks={(salon as { sns_links?: Record<string, string> | null }).sns_links} />

      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, padding: '0 16px', marginTop: 12 }}>
        {(
          [
            ['menu', '시술 메뉴'],
            ['reviews', `리뷰 ${reviewTotal}`],
            ['info', '샵 정보'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              padding: '12px 4px',
              fontSize: 13,
              color: tab === key ? TEXT : TEXT_SUB,
              borderBottom: tab === key ? `2px solid ${PURPLE}` : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {tab === 'menu' ? (
          <>
            {customerPhase ? (
              <div style={{ background: PURPLE_LIGHT, borderRadius: 12, padding: 14, marginBottom: 16, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 14, marginBottom: 6 }}>
                  고객님은 지금 {PHASE_EMOJI[customerPhase] || ''} {customerPhase}예요
                </div>
                <div style={{ fontSize: 12, color: TEXT_SUB, lineHeight: 1.5 }}>{PHASE_TIP[customerPhase] || ''}</div>
              </div>
            ) : customerUserId && !showCyclePhase ? (
              <div style={{ background: PURPLE_LIGHT, borderRadius: 12, padding: 14, marginBottom: 16, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>피부 고민으로 찾기</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SKIN_CONCERN_CHIPS.map((c) => (
                    <span key={c} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, background: CARD, border: `1px solid ${BORDER}`, color: TEXT_SUB }}>{c}</span>
                  ))}
                </div>
              </div>
            ) : null}
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 32 }}>등록된 시술 메뉴가 없어요</div>
            ) : (
              services.map((s, idx) => {
                const tag = (s.phase_tags && s.phase_tags[0]) || s.phase_tag || '전체'
                return (
                  <div key={`${s.name}-${idx}`} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 9,
                        flexShrink: 0,
                        background: s.thumbnail_url ? `url(${s.thumbnail_url}) center/cover no-repeat` : PURPLE_LIGHT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        overflow: 'hidden',
                      }}
                    >
                      {!s.thumbnail_url ? '💧' : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 500 }}>{s.name || '시술'}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, ...phaseBadgeStyle(String(tag)) }}>{tag}</span>
                      </div>
                      {s.description ? <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6, lineHeight: 1.5 }}>{s.description}</div> : null}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 16, color: GOLD }}>{Number(s.price || 0).toLocaleString()}원</span>
                        {(s.duration_min ?? s.duration) ? <span style={{ fontSize: 12, color: TEXT_SUB }}>{s.duration_min ?? s.duration}분</span> : null}
                        {Number(s.review_count || 0) > 0 ? (
                          <span style={{ fontSize: 10, color: TEXT_SUB }}>
                            ★{Number(s.avg_rating || 0).toFixed(1)} · 리뷰 {s.review_count}개
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBookingSalonId(salon.id)
                        setBookingSalonName(String(salon.name || ''))
                        setBookingServiceName(s.name)
                        setBookingServicePrice(s.price)
                        setBookingMonth({ year: new Date().getFullYear(), month: new Date().getMonth() })
                        setBookingStep(1)
                        setShowBooking(true)
                      }}
                      style={{ border: `1px solid ${PURPLE}`, background: 'transparent', color: PURPLE, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                    >
                      예약
                    </button>
                  </div>
                )
              })
            )}
          </>
        ) : null}

        {tab === 'reviews' ? (
          <>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 32, color: GOLD, fontWeight: 500 }}>{avgRating.toFixed(1)}</span>
                <div>
                  <div style={{ fontSize: 14, color: GOLD }}>{stars(avgRating)}</div>
                  <div style={{ fontSize: 12, color: TEXT_SUB, marginTop: 4 }}>총 {reviewTotal}개</div>
                </div>
              </div>
              {ratingBars.map((b) => (
                <div key={b.star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: TEXT_SUB, width: 24 }}>{b.star}점</span>
                  <div style={{ flex: 1, height: 6, background: SURFACE, borderRadius: 3 }}>
                    <div style={{ width: `${b.pct}%`, height: '100%', background: GOLD, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 10, color: TEXT_SUB, width: 20 }}>{b.count}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {showCyclePhase ? (
                PHASE_FILTERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPhaseFilter(p)
                      setReviewLimit(5)
                    }}
                    style={{
                      border: `1px solid ${phaseFilter === p ? PURPLE : BORDER}`,
                      background: phaseFilter === p ? PURPLE_LIGHT : CARD,
                      color: phaseFilter === p ? TEXT : TEXT_SUB,
                      borderRadius: 20,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {p === '전체' ? '전체' : `${PHASE_EMOJI[p] || ''}${p}`}
                  </button>
                ))
              ) : (
                <>
                  <span style={{ fontSize: 12, color: TEXT_SUB, width: '100%', marginBottom: 2 }}>피부 고민으로 찾기</span>
                  {SKIN_CONCERN_CHIPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setSkinConcernFilter(skinConcernFilter === c ? null : c)
                        setReviewLimit(5)
                      }}
                      style={{
                        border: `1px solid ${skinConcernFilter === c ? PURPLE : BORDER}`,
                        background: skinConcernFilter === c ? PURPLE_LIGHT : CARD,
                        color: skinConcernFilter === c ? TEXT : TEXT_SUB,
                        borderRadius: 20,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </>
              )}
            </div>
            {visibleReviews.length === 0 ? (
              <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 24 }}>리뷰가 없어요</div>
            ) : (
              visibleReviews.map((r) => {
                const author = relOne(r.users)
                const name = author?.name || '고객'
                const effects = Array.isArray(r.effect_tags) ? r.effect_tags : []
                return (
                  <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: PURPLE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: PURPLE, fontSize: 14 }}>
                        {name.slice(0, 1)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{name}</div>
                        <div style={{ fontSize: 11, color: TEXT_SUB }}>{fmtDate(r.created_at)}</div>
                      </div>
                      <span style={{ fontSize: 12, color: GOLD }}>★ {Number(r.rating || 0).toFixed(1)}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {showCyclePhase && r.hormone_phase ? (
                        <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, ...phaseBadgeStyle(String(r.hormone_phase)) }}>{r.hormone_phase}</span>
                      ) : null}
                      {r.skin_type ? <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: SURFACE, color: TEXT_SUB }}>{r.skin_type}</span> : null}
                      {effects.map((t) => (
                        <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: GOLD_LIGHT, color: GOLD }}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: TEXT_SUB }}>{r.content || ''}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: TEXT_SUB }}>도움돼요 {Number(r.helpful_count || 0)}</div>
                      <span
                        onClick={() => {
                          const params = new URLSearchParams({
                            service: r.service_name ?? '',
                            reviewer_id: r.author_id ?? '',
                          })
                          router.push(`/salons/${id}?${params.toString()}`)
                        }}
                        style={{
                          cursor: 'pointer',
                          fontSize: 12,
                          color: '#C9A96E',
                          border: '1px solid #C9A96E',
                          borderRadius: 20,
                          padding: '4px 12px',
                        }}
                      >
                        나도 관리권 구매하기 🍯
                      </span>
                    </div>
                  </div>
                )
              })
            )}
            {filteredReviews.length > reviewLimit ? (
              <button type="button" onClick={() => setReviewLimit((n) => n + 5)} style={{ width: '100%', height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: TEXT_SUB, fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
                더보기
              </button>
            ) : null}
          </>
        ) : null}

        {tab === 'info' ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
            {salon.address ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>주소</div>
                <div style={{ fontSize: 14 }}>{salon.address}</div>
              </div>
            ) : null}
            {hoursToday ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>영업시간</div>
                <div style={{ fontSize: 14 }}>오늘 {hoursToday}</div>
              </div>
            ) : null}
            {salon.phone ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>전화번호</div>
                <a href={`tel:${salon.phone}`} style={{ fontSize: 14, color: PURPLE, textDecoration: 'none' }}>
                  {salon.phone}
                </a>
              </div>
            ) : null}
            {ownerName ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>원장님 소개</div>
                <div style={{ fontSize: 14 }}>{ownerName} 원장님</div>
              </div>
            ) : null}
            {salon.description ? (
              <div>
                <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>샵 소개</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: TEXT_SUB }}>{salon.description}</div>
              </div>
            ) : null}
            {salonCertificates.length ? (
              <div style={{ marginTop: salon.description || salon.address || hoursToday || salon.phone || ownerName ? 16 : 0, paddingTop: salon.description || salon.address || hoursToday || salon.phone || ownerName ? 16 : 0, borderTop: salon.description || salon.address || hoursToday || salon.phone || ownerName ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 10 }}>자격증 · 경력</div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                  {salonCertificates.map((cert, idx) => (
                    <button
                      key={`${cert.url}-${idx}`}
                      type="button"
                      onClick={() => setCertLightbox(cert)}
                      style={{ flex: '0 0 auto', width: 120, border: `1px solid ${BORDER}`, borderRadius: 10, background: CARD, padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <img src={cert.url} alt={cert.label || ''} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                      {cert.label ? (
                        <div style={{ fontSize: 10, color: TEXT_SUB, padding: '8px 8px 10px', lineHeight: 1.4 }}>{cert.label}</div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {tab === 'menu' ? (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: BG, borderTop: `1px solid ${BORDER}` }}>
          <button
            type="button"
            onClick={() => {
              setBookingSalonId(salon.id)
              setBookingSalonName(String(salon.name || ''))
              setBookingServiceName(undefined)
              setBookingServicePrice(undefined)
              setBookingMonth({ year: new Date().getFullYear(), month: new Date().getMonth() })
              setBookingStep(1)
              setShowBooking(true)
            }}
            style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: PURPLE, color: TEXT, fontSize: 15, cursor: 'pointer' }}
          >
            예약하기
          </button>
        </div>
      ) : null}

      {shareToast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: PURPLE, color: TEXT, borderRadius: 12, padding: '10px 16px', fontSize: 13, zIndex: 50 }}>
          {shareToast}
        </div>
      ) : null}

      {showMapSheet ? (
        <div
          role="presentation"
          onClick={() => setShowMapSheet(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#1A1A2E', borderRadius: '18px 18px 0 0', width: '100%', paddingBottom: 20 }}
          >
            <div style={{ width: 34, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '11px auto 13px' }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', padding: '0 15px 10px', borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>길찾기</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', padding: '8px 15px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
              📍 {salon?.address || salon?.area}
            </div>
            <div style={{ padding: '10px 15px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { name: '카카오맵', desc: '카카오맵으로 길찾기', emoji: '🗺', bg: '#FEE500', url: `kakaomap://route?ep=${encodeURIComponent(salon?.address || '')}` },
                { name: '티맵', desc: '티맵으로 길찾기', emoji: '🧭', bg: '#E8F4FF', url: `tmap://route?goalname=${encodeURIComponent(String(salon?.name || ''))}` },
                { name: '네이버 지도', desc: '네이버 지도로 길찾기', emoji: '🗾', bg: '#E8F5E9', url: `nmap://route?goalname=${encodeURIComponent(String(salon?.name || ''))}` },
              ].map((app) => (
                <div
                  key={app.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    window.location.href = app.url
                    setShowMapSheet(false)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 11, cursor: 'pointer', border: '0.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: app.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{app.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#fff' }}>{app.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{app.desc}</div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 15 }}>›</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowMapSheet(false)}
              style={{ width: 'calc(100% - 30px)', margin: '7px 15px 0', padding: 11, border: '0.5px solid rgba(255,255,255,0.13)', background: 'transparent', borderRadius: 11, color: 'rgba(255,255,255,0.55)', fontSize: 13, cursor: 'pointer' }}
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {showBooking ? (
        <div style={{ position: 'fixed', inset: 0, background: BG, zIndex: 300, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 15px', borderBottom: `0.5px solid ${BORDER}` }}>
            <button
              type="button"
              onClick={() => {
                if (bookingStep > 1 && bookingStep < 5) setBookingStep((bookingStep - 1) as 1 | 2 | 3 | 4 | 5)
                else {
                  setShowBooking(false)
                  setBookingStep(1)
                }
              }}
              style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 14, cursor: 'pointer', minWidth: 44, textAlign: 'left' }}
            >
              ← {bookingStep > 1 && bookingStep < 5 ? '이전' : '닫기'}
            </button>
            <div style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>예약하기</div>
            <button
              type="button"
              onClick={() => {
                setShowBooking(false)
                setBookingStep(1)
              }}
              style={{ width: 28, height: 28, borderRadius: '50%', background: SURFACE, border: 'none', color: TEXT, cursor: 'pointer', fontSize: 14 }}
            >
              ×
            </button>
          </div>

          {bookingStep < 5 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px', borderBottom: `0.5px solid ${BORDER}` }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: salon.banner_url ? `url(${salon.banner_url}) center/cover no-repeat` : PURPLE_LIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {!salon.banner_url ? <span style={{ fontSize: 16 }}>💜</span> : null}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{bookingSalonName}</div>
                  <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 1 }}>{salon.area}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 15px', borderBottom: `0.5px solid ${BORDER}` }}>
                {([1, 2, 3, 4, 5] as const).map((n, idx) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 500,
                        background: bookingStep >= n ? PURPLE : 'transparent',
                        border: `1.5px solid ${bookingStep >= n ? PURPLE : 'rgba(255,255,255,0.2)'}`,
                        color: bookingStep >= n ? '#fff' : 'rgba(255,255,255,0.35)',
                        opacity: bookingStep === n ? 1 : bookingStep > n ? 0.85 : 0.6,
                        transform: bookingStep === n ? 'scale(1.08)' : 'scale(1)',
                      }}
                    >
                      {n}
                    </div>
                    <span style={{ fontSize: 11, color: bookingStep >= n ? (bookingStep === n ? TEXT : TEXT_SUB) : 'rgba(255,255,255,0.2)' }}>
                      {n === 1 ? '시술' : n === 2 ? '결제' : n === 3 ? '날짜' : n === 4 ? '확인' : '완료'}
                    </span>
                    {idx < 4 ? <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10 }}>→</span> : null}
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, padding: '12px 15px 100px' }}>
                {bookingStep === 1 ? (
                  <>
                    <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>시술 선택</div>
                    {customerPhase ? (
                      <div style={{ background: 'rgba(123,94,167,0.12)', border: '0.5px solid rgba(123,94,167,0.25)', borderRadius: 9, padding: '8px 11px', marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: TEXT_SUB, marginBottom: 2 }}>지금 내 위상 기준 추천</div>
                        <div style={{ fontSize: 12, color: GOLD }}>
                          {PHASE_EMOJI[customerPhase]} {customerPhase} — {PHASE_TIP[customerPhase]}
                        </div>
                      </div>
                    ) : null}
                    {services.map((svc) => (
                      <div
                        key={svc.id || svc.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setBookingServiceName(svc.name)
                          setBookingServicePrice(svc.price)
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: `0.5px solid ${BORDER}`, cursor: 'pointer' }}
                      >
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 9,
                            flexShrink: 0,
                            background: svc.thumbnail_url ? `url(${svc.thumbnail_url}) center/cover no-repeat` : PURPLE_LIGHT,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                          }}
                        >
                          {!svc.thumbnail_url ? '💧' : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: TEXT, marginBottom: 2 }}>{svc.name}</div>
                          <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 4 }}>{svc.description}</div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: GOLD }}>₩{Number(svc.price || 0).toLocaleString()}</span>
                            {(svc.duration_min ?? svc.duration) ? (
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{svc.duration_min ?? svc.duration}분</span>
                            ) : null}
                          </div>
                        </div>
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: bookingServiceName === svc.name ? PURPLE : 'transparent',
                            border: `1.5px solid ${bookingServiceName === svc.name ? PURPLE : 'rgba(255,255,255,0.2)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            color: '#fff',
                          }}
                        >
                          {bookingServiceName === svc.name ? '✓' : null}
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}

                {bookingStep === 2 ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 500, color: TEXT, marginBottom: 12 }}>몇 회권을 구매할까요?</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {SESSION_PACKAGES.map((pkg) => {
                        const unit = Number(bookingServicePrice || 0)
                        const basePrice = unit * pkg.sessions
                        const total = Math.floor(basePrice * (1 - pkg.discount / 100))
                        const selected = bookingSessions === pkg.sessions
                        return (
                          <button
                            key={pkg.sessions}
                            type="button"
                            onClick={() => setBookingSessions(pkg.sessions)}
                            style={{
                              textAlign: 'left',
                              padding: '14px 15px',
                              borderRadius: 12,
                              border: selected ? `1.5px solid ${PURPLE}` : `0.5px solid ${BORDER}`,
                              background: selected ? PURPLE_LIGHT : CARD,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{pkg.label}</span>
                              {pkg.discount > 0 ? (
                                <span style={{ fontSize: 10, color: GOLD, background: GOLD_LIGHT, padding: '2px 6px', borderRadius: 6 }}>
                                  {pkg.discount}% 할인
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>{pkg.desc}</div>
                            {pkg.discount > 0 ? (
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through', marginBottom: 2 }}>
                                ₩{basePrice.toLocaleString()}
                              </div>
                            ) : null}
                            <div style={{ fontSize: 15, fontWeight: 500, color: GOLD }}>₩{total.toLocaleString()}</div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                ) : null}

                {bookingStep === 3 ? (
                  <>
                    <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>날짜 선택</div>
                    {customerPhase && nextGoldenLabel ? (
                      <div style={{ background: GOLD_LIGHT, border: `0.5px solid rgba(201,169,110,0.25)`, borderRadius: 9, padding: '8px 11px', marginBottom: 10, fontSize: 12, color: GOLD }}>
                        다음 황금기: {nextGoldenLabel} 예약 추천 ✨
                      </div>
                    ) : null}
                    {bookingDate ? (
                      <div style={{ fontSize: 14, fontWeight: 500, color: TEXT, marginBottom: 10, textAlign: 'center' }}>
                        {(() => {
                          const d = new Date(bookingDate + 'T12:00:00')
                          return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_KO[d.getDay()]})`
                        })()}
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setBookingMonth((p) => {
                            const d = new Date(p.year, p.month - 1, 1)
                            return { year: d.getFullYear(), month: d.getMonth() }
                          })
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: `0.5px solid ${BORDER}`,
                          background: 'transparent',
                          color: TEXT,
                          cursor: 'pointer',
                          fontSize: 16,
                        }}
                      >
                        ‹
                      </button>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>
                        {bookingMonth.year}년 {bookingMonth.month + 1}월
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setBookingMonth((p) => {
                            const d = new Date(p.year, p.month + 1, 1)
                            return { year: d.getFullYear(), month: d.getMonth() }
                          })
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          border: `0.5px solid ${BORDER}`,
                          background: 'transparent',
                          color: TEXT,
                          cursor: 'pointer',
                          fontSize: 16,
                        }}
                      >
                        ›
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                      {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <div
                          key={d}
                          style={{
                            textAlign: 'center',
                            fontSize: 10,
                            padding: '4px 0',
                            color: i === 0 ? '#F87171' : i === 6 ? '#60A5FA' : TEXT_SUB,
                          }}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
                      {bookingCalendarDays.map((day, idx) => (
                        <button
                          key={day.iso || `e-${idx}`}
                          type="button"
                          disabled={day.disabled || day.empty}
                          onClick={() => {
                            if (!day.iso || day.disabled) return
                            void (async () => {
                              const dateStr = day.iso!
                              setBookingDate(dateStr)
                              setBookingTime('')
                              setSlotCounts({})
                              const slots: string[] = []
                              let openH = 9
                              let closeH = 19
                              const oh = salon.open_hours
                              if (oh) {
                                const d = new Date(dateStr + 'T12:00:00')
                                const key = DAY_KEYS[d.getDay()]
                                const ko = DAY_KO[d.getDay()]
                                const raw = oh[key] || oh[ko] || oh.default || ''
                                const m = String(raw).match(/(\d{1,2}):(\d{2})\s*[~\-]\s*(\d{1,2}):(\d{2})/)
                                if (m) {
                                  openH = Number(m[1])
                                  closeH = Number(m[3])
                                }
                              }
                              for (let h = openH; h < closeH; h++) {
                                slots.push(`${String(h).padStart(2, '0')}:00`)
                              }
                              const sb = supabaseRef.current
                              const counts: Record<string, number> = {}
                              await Promise.all(
                                slots.map(async (t) => {
                                  counts[t] = await fetchSlotCount(sb, salon.id, dateStr, t)
                                }),
                              )
                              setSlotCounts(counts)
                            })()
                          }}
                          style={{
                            aspectRatio: '1/1',
                            borderRadius: 8,
                            border:
                              bookingDate === day.iso
                                ? `1.5px solid ${PURPLE}`
                                : `0.5px solid ${day.empty ? 'transparent' : BORDER}`,
                            background: day.empty ? 'transparent' : bookingDate === day.iso ? PURPLE_LIGHT : CARD,
                            color: day.empty
                              ? 'transparent'
                              : day.disabled
                                ? 'rgba(255,255,255,0.2)'
                                : day.dowIdx === 0
                                  ? '#F87171'
                                  : day.dowIdx === 6
                                    ? '#60A5FA'
                                    : bookingDate === day.iso
                                      ? TEXT
                                      : TEXT_SUB,
                            fontSize: 13,
                            cursor: day.disabled || day.empty ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {day.empty ? '' : day.label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 8 }}>시간 선택</div>
                    {!bookingDate ? (
                      <div style={{ fontSize: 12, color: TEXT_SUB, padding: '12px 0' }}>날짜를 먼저 선택해주세요</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {bookingTimeSlots.map((slot) => {
                          const maxCapacity = Math.min(salon.staff_count ?? 1, salon.room_count ?? 1)
                          const isFull = (slotCounts[slot] ?? 0) >= maxCapacity
                          return (
                          <button
                            key={slot}
                            type="button"
                            disabled={isFull}
                            onClick={() => {
                              if (isFull) {
                                setShareToast('이 시간은 마감됐어요. 상담으로 문의해보세요 💜')
                                return
                              }
                              setBookingTime(slot)
                            }}
                            style={{
                              padding: '10px 0',
                              borderRadius: 9,
                              border: bookingTime === slot ? `1.5px solid ${PURPLE}` : `0.5px solid ${BORDER}`,
                              background: bookingTime === slot ? PURPLE_LIGHT : CARD,
                              color: bookingTime === slot ? TEXT : TEXT_SUB,
                              fontSize: 13,
                              cursor: isFull ? 'default' : 'pointer',
                              opacity: isFull ? 0.35 : 1,
                            }}
                          >
                            {slot}{isFull ? ' 마감' : ''}
                          </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : null}

                {bookingStep === 4 ? (
                  <>
                    <div style={{ background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '14px 15px', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 10 }}>{bookingSalonName}</div>
                      <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>시술 · {bookingServiceName} · {bookingSessions}회권</div>
                      <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6 }}>
                        날짜 · {bookingDate ? fmtDate(bookingDate + 'T12:00:00') : '-'} {bookingTime}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: GOLD }}>₩{bookingAmount.toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: 11, color: TEXT_SUB, marginBottom: 6 }}>요청사항</div>
                    <textarea
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="원장님께 전달할 내용"
                      rows={4}
                      style={{ width: '100%', boxSizing: 'border-box', background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: '10px 12px', color: TEXT, fontSize: 13, resize: 'none', marginBottom: 14 }}
                    />
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: TEXT_SUB, cursor: 'pointer' }}>
                      <input type="checkbox" checked={bookingAgree} onChange={(e) => setBookingAgree(e.target.checked)} style={{ marginTop: 2 }} />
                      <span>예약 취소/변경 정책에 동의합니다</span>
                    </label>
                  </>
                ) : null}
              </div>

              <div style={{ position: 'sticky', bottom: 0, background: BG, borderTop: `0.5px solid ${BORDER}`, padding: '12px 15px calc(12px + env(safe-area-inset-bottom))' }}>
                {bookingStep === 1 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: TEXT_SUB }}>{bookingServiceName || '시술을 선택해주세요'}</span>
                      <span style={{ fontSize: 15, fontWeight: 500, color: GOLD }}>{bookingServicePrice ? `₩${bookingServicePrice.toLocaleString()}` : ''}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!bookingServiceName}
                      onClick={() => setBookingStep(2)}
                      style={{
                        width: '100%',
                        padding: 13,
                        border: 'none',
                        borderRadius: 12,
                        background: bookingServiceName ? PURPLE : SURFACE,
                        color: bookingServiceName ? '#fff' : 'rgba(255,255,255,0.3)',
                        fontSize: 14,
                        cursor: bookingServiceName ? 'pointer' : 'default',
                      }}
                    >
                      {bookingServiceName ? '다음 → 회차 선택' : '시술을 먼저 선택해주세요'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBooking(false)
                        router.push(
                          `/dashboard/customer/salon-chat/new?salon_id=${salon.id}&owner_id=${salon.owner_id || ''}`,
                        )
                      }}
                      style={{
                        width: '100%',
                        padding: '11px',
                        marginTop: 8,
                        border: `0.5px solid ${PURPLE}`,
                        background: 'transparent',
                        borderRadius: 12,
                        color: PURPLE,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      💬 상담으로 예약 문의하기
                    </button>
                  </>
                ) : null}
                {bookingStep === 2 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: TEXT_SUB }}>
                        {bookingServiceName} · {bookingSessions}회권
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 500, color: GOLD }}>₩{bookingAmount.toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!bookingServiceName || paymentLoading || bookingAmount < 1000}
                      onClick={() => {
                        const svc = services.find((s) => s.name === bookingServiceName)
                        const partnerRate = (svc as any)?.partner_fee_rate ?? 0
                        router.push(
                          `/checkout/booking` +
                            `?salon_id=${encodeURIComponent(salon.id)}` +
                            `&salon_name=${encodeURIComponent(salon.name || '')}` +
                            `&salon_area=${encodeURIComponent(salon.area || '')}` +
                            `&service_name=${encodeURIComponent(bookingServiceName || '')}` +
                            `&service_price=${bookingServicePrice || 0}` +
                            `&service_cost=${bookingServicePrice || 0}` +
                            `&partner_fee_rate=${partnerRate}` +
                            `&sessions=${bookingSessions}` +
                            `&reviewer_id=${encodeURIComponent(reviewerId)}`,
                        )
                      }}
                      style={{
                        width: '100%',
                        padding: 13,
                        border: 'none',
                        borderRadius: 12,
                        background: bookingServiceName && !paymentLoading && bookingAmount >= 1000 ? PURPLE : SURFACE,
                        color: bookingServiceName && !paymentLoading && bookingAmount >= 1000 ? '#fff' : 'rgba(255,255,255,0.3)',
                        fontSize: 14,
                        cursor: bookingServiceName && !paymentLoading && bookingAmount >= 1000 ? 'pointer' : 'default',
                      }}
                    >
                      {paymentLoading ? '결제창으로 이동 중…' : `결제하기 ₩${bookingAmount.toLocaleString()}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBooking(false)
                        router.push(
                          `/dashboard/customer/salon-chat/new?salon_id=${salon.id}&owner_id=${salon.owner_id || ''}`,
                        )
                      }}
                      style={{
                        width: '100%',
                        padding: '11px',
                        marginTop: 8,
                        border: `0.5px solid ${PURPLE}`,
                        background: 'transparent',
                        borderRadius: 12,
                        color: PURPLE,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      💬 상담으로 예약 문의하기
                    </button>
                  </>
                ) : null}
                {bookingStep === 3 ? (
                  <button
                    type="button"
                    disabled={!bookingDate || !bookingTime}
                    onClick={() => setBookingStep(4)}
                    style={{
                      width: '100%',
                      padding: 13,
                      border: 'none',
                      borderRadius: 12,
                      background: bookingDate && bookingTime ? PURPLE : SURFACE,
                      color: bookingDate && bookingTime ? '#fff' : 'rgba(255,255,255,0.3)',
                      fontSize: 14,
                      cursor: bookingDate && bookingTime ? 'pointer' : 'default',
                    }}
                  >
                    예약 확인하기
                  </button>
                ) : null}
                {bookingStep === 4 ? (
                  <>
                  <button
                    type="button"
                    disabled={!bookingAgree || bookingSubmitting}
                    onClick={() => {
                      void (async () => {
                        if (!bookingAgree || bookingSubmitting) return
                        if (!customerUserId) {
                          setShareToast('로그인이 필요해요')
                          return
                        }
                        setBookingSubmitting(true)
                        const { error } = await supabaseRef.current.from('bookings').insert({
                          customer_id: customerUserId,
                          salon_id: bookingSalonId,
                          owner_id: salon.owner_id,
                          service_name: bookingServiceName,
                          service_price: bookingServicePrice,
                          booking_date: bookingDate,
                          booking_time: bookingTime,
                          notes: bookingNotes,
                          purchase_id: purchaseId || null,
                          status: 'pending',
                        })
                        setBookingSubmitting(false)
                        if (error) {
                          setShareToast('예약에 실패했어요')
                          return
                        }
                        const svcName = bookingServiceName || '시술'
                        const dateTime = `${bookingDate} ${bookingTime}`
                        const oid = salon?.owner_id ? String(salon.owner_id) : ''
                        try {
                          await sendSalonBookingMessage(
                            oid,
                            customerUserId,
                            null,
                            `${svcName} 예약이 접수됐어요. 원장님 확인 후 곧 확정될 예정이에요 🌙`,
                          )
                        } catch { /* ignore */ }
                        try {
                          await supabaseRef.current.from('notifications').insert({
                            user_id: customerUserId,
                            type: 'booking',
                            title: '예약이 접수됐어요',
                            body: `${svcName} · ${dateTime}`,
                            link_url: '/my/orders',
                            is_read: false,
                          } as any)
                        } catch { /* ignore */ }
                        if (oid) {
                          try {
                            await supabaseRef.current.from('notifications').insert({
                              user_id: oid,
                              type: 'booking',
                              title: '새 예약 요청',
                              body: `${svcName} · ${dateTime}`,
                              is_read: false,
                            } as any)
                          } catch { /* ignore */ }
                        }
                        setBookingStep(5)
                      })()
                    }}
                    style={{
                      width: '100%',
                      padding: 13,
                      border: 'none',
                      borderRadius: 12,
                      background: bookingAgree && !bookingSubmitting ? PURPLE : SURFACE,
                      color: bookingAgree && !bookingSubmitting ? '#fff' : 'rgba(255,255,255,0.3)',
                      fontSize: 14,
                      cursor: bookingAgree && !bookingSubmitting ? 'pointer' : 'default',
                    }}
                  >
                    {bookingSubmitting ? '처리 중…' : '예약 확정하기'}
                  </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBooking(false)
                        router.push(
                          `/dashboard/customer/salon-chat/new?salon_id=${salon.id}&owner_id=${salon.owner_id || ''}`,
                        )
                      }}
                      style={{
                        width: '100%',
                        padding: '11px',
                        marginTop: 8,
                        border: `0.5px solid ${PURPLE}`,
                        background: 'transparent',
                        borderRadius: 12,
                        color: PURPLE,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      💬 상담으로 예약 문의하기
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💜</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: TEXT, marginBottom: 20 }}>예약이 완료됐어요!</div>
              <div style={{ width: '100%', maxWidth: 320, background: CARD, border: `0.5px solid ${BORDER}`, borderRadius: 12, padding: '14px 15px', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 8 }}>{bookingSalonName}</div>
                <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 4 }}>{bookingServiceName} · {bookingSessions}회권</div>
                <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 4 }}>
                  {bookingDate ? fmtDate(bookingDate + 'T12:00:00') : ''} · {bookingTime}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: GOLD }}>₩{bookingAmount.toLocaleString()}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBooking(false)
                  setBookingStep(1)
                }}
                style={{ width: '100%', maxWidth: 320, padding: 13, border: 'none', borderRadius: 12, background: PURPLE, color: '#fff', fontSize: 14, cursor: 'pointer' }}
              >
                확인
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
