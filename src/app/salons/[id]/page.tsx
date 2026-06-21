'use client'

import { createClient } from '@/lib/supabase/client'
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

type SalonService = {
  name?: string
  price?: number
  duration_min?: number
  description?: string
  phase_tags?: string[]
  phase_tag?: string
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
  services?: SalonService[] | null
  open_hours?: Record<string, string> | null
  avg_rating?: number | null
  review_count?: number | null
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
        .select('id,rating,content,hormone_phase,skin_type,effect_tags,helpful_count,created_at,author_id,users(name)')
        .eq('target_id', id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(20)
      if (!cancelled) setReviews((reviewRows as ReviewRow[]) || [])

      const { data: auth } = await sb.auth.getUser()
      if (auth.user && !cancelled) {
        const { data: urow } = await sb.from('users').select('id').eq('auth_id', auth.user.id).maybeSingle()
        if (urow?.id) {
          const { data: hcRows } = await sb
            .from('hormone_cycle')
            .select('last_period_date')
            .eq('user_id', urow.id)
            .order('created_at', { ascending: false })
            .limit(1)
          const last = ((hcRows as { last_period_date?: string }[]) || [])[0]?.last_period_date
          setCustomerPhase(calcPhase(last))
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

  const services = useMemo(() => parseServices(salon?.services), [salon?.services])
  const hoursToday = useMemo(() => todayHours(salon?.open_hours ?? null), [salon?.open_hours])
  const openNow = useMemo(() => isOpenNow(salon?.open_hours ?? null), [salon?.open_hours])
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

  const filteredReviews = useMemo(() => {
    if (phaseFilter === '전체') return reviews
    return reviews.filter((r) => String(r.hormone_phase || '') === phaseFilter)
  }, [reviews, phaseFilter])

  const visibleReviews = filteredReviews.slice(0, reviewLimit)

  const bookingHref = `/dashboard/customer/booking?salon_id=${encodeURIComponent(id)}&salon_name=${encodeURIComponent(salonName)}`
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
    <div style={{ minHeight: '100vh', background: BG, color: TEXT, paddingBottom: tab === 'menu' ? 88 : 24 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: BG, display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <button type="button" onClick={() => router.back()} style={{ border: 'none', background: 'transparent', color: TEXT, fontSize: 22, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 500 }}>{salonName}</div>
        <button type="button" onClick={() => void share()} style={{ border: 'none', background: 'transparent', color: TEXT_SUB, fontSize: 13, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>
          공유
        </button>
      </header>

      <div
        style={{
          height: 180,
          background: salon.banner_url ? `url(${salon.banner_url}) center/cover no-repeat` : PURPLE_LIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {!salon.banner_url ? <span style={{ fontSize: 48 }}>💜</span> : null}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, background: 'linear-gradient(transparent, rgba(13,11,9,0.92))' }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{salonName}</div>
          <div style={{ fontSize: 12, color: TEXT_SUB, marginTop: 4 }}>
            {[salon.area, hoursToday ? `영업 ${hoursToday}` : null].filter(Boolean).join(' · ')}
          </div>
          {serviceTags.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {serviceTags.map((t) => (
                <span key={t} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: SURFACE, color: TEXT_SUB }}>
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 13, color: GOLD }}>★ {avgRating.toFixed(1)} ({reviewTotal}개)</span>
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: openNow ? 'rgba(76,173,126,0.2)' : SURFACE, color: openNow ? '#4CAD7E' : TEXT_SUB }}>
              {openNow ? '영업 중' : '영업 종료'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '12px 16px' }}>
        <button type="button" onClick={() => router.push(bookingHref)} style={{ flex: 1, height: 44, borderRadius: 10, border: 'none', background: PURPLE, color: TEXT, fontSize: 14, cursor: 'pointer' }}>
          예약하기
        </button>
        <button type="button" onClick={() => router.push(chatHref)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${PURPLE}`, background: 'transparent', color: PURPLE, fontSize: 14, cursor: 'pointer' }}>
          상담 요청
        </button>
        {salon.phone ? (
          <a href={`tel:${salon.phone}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, color: TEXT_SUB, fontSize: 12, textDecoration: 'none' }}>
            전화
          </a>
        ) : null}
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, padding: '0 16px' }}>
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
            ) : null}
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', color: TEXT_SUB, fontSize: 13, padding: 32 }}>등록된 시술 메뉴가 없어요</div>
            ) : (
              services.map((s, idx) => {
                const tag = (s.phase_tags && s.phase_tags[0]) || s.phase_tag || '전체'
                return (
                  <div key={`${s.name}-${idx}`} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{s.name || '시술'}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, ...phaseBadgeStyle(String(tag)) }}>{tag}</span>
                    </div>
                    {s.description ? <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 6, lineHeight: 1.5 }}>{s.description}</div> : null}
                    <div style={{ fontSize: 12, color: TEXT_SUB, marginBottom: 8 }}>{s.duration_min ? `${s.duration_min}분 · ` : ''}소요</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 16, color: GOLD }}>{Number(s.price || 0).toLocaleString()}원</span>
                      <button type="button" onClick={() => router.push(bookingHref)} style={{ border: `1px solid ${PURPLE}`, background: 'transparent', color: PURPLE, borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
                        예약
                      </button>
                    </div>
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
              {PHASE_FILTERS.map((p) => (
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
              ))}
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
                      {r.hormone_phase ? (
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
                    <div style={{ fontSize: 11, color: TEXT_SUB, marginTop: 8 }}>도움돼요 {Number(r.helpful_count || 0)}</div>
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
          </div>
        ) : null}
      </div>

      {tab === 'menu' ? (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: BG, borderTop: `1px solid ${BORDER}` }}>
          <button type="button" onClick={() => router.push(bookingHref)} style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: PURPLE, color: TEXT, fontSize: 15, cursor: 'pointer' }}>
            예약하기
          </button>
        </div>
      ) : null}

      {shareToast ? (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 24, background: PURPLE, color: TEXT, borderRadius: 12, padding: '10px 16px', fontSize: 13, zIndex: 50 }}>
          {shareToast}
        </div>
      ) : null}
    </div>
  )
}
